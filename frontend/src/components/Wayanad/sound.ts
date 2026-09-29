// FloodGuard sound manager — all sounds are synthesised with WebAudio (no bundled audio assets).
// Off until the user enables it (browser autoplay policy); master volume; no endless loops.

type Ambient = { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode };

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rain: Ambient | null = null;
  private water: Ambient | null = null;
  private alarmTimer: ReturnType<typeof setTimeout> | null = null;
  enabled = localStorage.getItem('fg-sound') === 'on';
  volume = parseFloat(localStorage.getItem('fg-volume') ?? '0.6');
  private listeners = new Set<() => void>();

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((f) => f()); }

  /** Must be called from a user gesture the first time. */
  async enable(on: boolean) {
    this.enabled = on;
    localStorage.setItem('fg-sound', on ? 'on' : 'off');
    if (on) {
      this.ensure();
      await this.ctx?.resume();
    } else {
      this.stopAmbient();
      this.stopAlarm();
    }
    this.emit();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    localStorage.setItem('fg-volume', String(this.volume));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    this.emit();
  }

  private ensure() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }

  private ready() {
    if (!this.enabled) return false;
    this.ensure();
    return !!this.ctx && this.ctx.state === 'running';
  }

  private noise(seconds = 2, brown = false) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  private startAmbient(brown: boolean, freq: number): Ambient {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise(3, brown);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = brown ? 'lowpass' : 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = brown ? 0.7 : 0.5;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master!);
    src.start();
    return { src, gain, filter };
  }

  /** Rain ambience scaled to precipitation intensity (mm/h); 0 stops it. */
  setRain(mmPerHour: number) {
    if (!this.ready()) return;
    const level = mmPerHour <= 0 ? 0 : Math.min(0.35, 0.06 + Math.log10(1 + mmPerHour) * 0.18);
    if (!this.rain && level > 0) this.rain = this.startAmbient(false, 2600);
    if (this.rain) this.rain.gain.gain.setTargetAtTime(level, this.ctx!.currentTime, 1.2);
  }

  /** Low water-flow ambience (0–1). */
  setWater(level: number) {
    if (!this.ready()) return;
    const g = Math.max(0, Math.min(0.3, level * 0.3));
    if (!this.water && g > 0) this.water = this.startAmbient(true, 420);
    if (this.water) this.water.gain.gain.setTargetAtTime(g, this.ctx!.currentTime, 1.5);
  }

  stopAmbient() {
    for (const a of [this.rain, this.water]) {
      try { a?.src.stop(); } catch { /* already stopped */ }
    }
    this.rain = this.water = null;
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', peak = 0.5) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(this.master!);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  notify() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(880, t, 0.18);
    this.tone(1320, t + 0.16, 0.28);
  }

  warning() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    for (let i = 0; i < 3; i++) this.tone(740, t + i * 0.32, 0.22, 'triangle', 0.45);
  }

  /** Short two-tone emergency pattern repeated a limited number of times (default 4 cycles). */
  critical(cycles = 4) {
    if (!this.ready()) return;
    this.stopAlarm();
    let n = 0;
    const cycle = () => {
      if (!this.ctx || n >= cycles) { this.alarmTimer = null; this.emit(); return; }
      const t = this.ctx.currentTime;
      this.tone(960, t, 0.34, 'square', 0.22);
      this.tone(640, t + 0.38, 0.34, 'square', 0.22);
      n += 1;
      this.alarmTimer = setTimeout(cycle, 1200);
    };
    cycle();
    this.emit();
  }

  get alarming() { return this.alarmTimer !== null; }

  stopAlarm() {
    if (this.alarmTimer) clearTimeout(this.alarmTimer);
    this.alarmTimer = null;
    this.emit();
  }
}

export const sound = new SoundManager();
