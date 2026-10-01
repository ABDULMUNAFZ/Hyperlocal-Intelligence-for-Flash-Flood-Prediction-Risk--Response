// WebGL capability check. The 3D map (MapLibre) needs WebGL; some laptops have it switched off
// (browser hardware acceleration disabled, GPU/driver blocklisted, remote desktop / VM) and the
// browser then refuses to create any WebGL context. Detect that up front so the app can fall back
// to the 2D map instead of failing.

export interface WebGLSupport {
  ok: boolean;
  /** human-readable renderer (when available) or the reason WebGL is unavailable */
  detail: string;
}

let cached: WebGLSupport | null = null;

export function detectWebGL(): WebGLSupport {
  if (cached) return cached;
  if (typeof document === 'undefined') return { ok: false, detail: 'no document' };
  let detail = 'WebGL is not available in this browser';
  try {
    const canvas = document.createElement('canvas');
    let reason = '';
    canvas.addEventListener('webglcontextcreationerror', (e) => { reason = (e as WebGLContextEvent).statusMessage || reason; }, false);
    const attrs: WebGLContextAttributes = { failIfMajorPerformanceCaveat: false, antialias: false, depth: true, stencil: true };
    const gl = (canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs)) as WebGLRenderingContext | null;
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
      gl.getExtension('WEBGL_lose_context')?.loseContext(); // release it right away; the map creates its own
      cached = { ok: true, detail: renderer };
      return cached;
    }
    if (reason) detail = reason;
  } catch (err) {
    detail = err instanceof Error ? err.message : String(err);
  }
  cached = { ok: false, detail };
  return cached;
}

/** True for errors thrown when the browser cannot create a WebGL context. */
export function isWebGLError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err ?? '');
  return /webgl|webglcontextcreationerror|could not create a webgl context/i.test(msg);
}
