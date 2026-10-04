// Tiny shared state for the landing story: current chapter, background mood and page progress.
// Progress listeners are called every scroll frame, so they write to the DOM directly instead of
// triggering React renders; chapter/mood changes are rare and go through useSyncExternalStore.
import { useSyncExternalStore } from 'react';

export type Mood = 'paper' | 'storm' | 'navy' | 'dawn';

interface StoryState {
  chapter: string;
  mood: Mood;
}

let state: StoryState = { chapter: 'hero', mood: 'paper' };
const listeners = new Set<() => void>();
const progressListeners = new Set<(p: number) => void>();
const rainListeners = new Set<(v: number) => void>();

export const storyStore = {
  get: () => state,
  set(patch: Partial<StoryState>) {
    const next = { ...state, ...patch };
    if (next.chapter === state.chapter && next.mood === state.mood) return;
    state = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** page scroll progress 0..1 */
  setProgress(p: number) {
    progressListeners.forEach((l) => l(p));
  },
  onProgress(l: (p: number) => void) {
    progressListeners.add(l);
    return () => progressListeners.delete(l);
  },
  /** extra rain intensity requested by a scene (0..1); the background adds it to the mood's base */
  setRainBoost(v: number) {
    rainListeners.forEach((l) => l(v));
  },
  onRainBoost(l: (v: number) => void) {
    rainListeners.add(l);
    return () => rainListeners.delete(l);
  },
  reset() {
    state = { chapter: 'hero', mood: 'paper' };
    listeners.forEach((l) => l());
  },
};

export function useStory(): StoryState {
  return useSyncExternalStore(storyStore.subscribe, storyStore.get, storyStore.get);
}

export const DARK_MOODS: Mood[] = ['storm', 'navy'];
