import type { AudioKey } from '../types';
import { getState } from './store';

// Semantic mapping verified by duration/creation order (see README): 8.49s / 4.83s / 1.29s.
const FILES: Record<Exclude<AudioKey, 'click'>, string> = {
  wrong1: `${import.meta.env.BASE_URL}audio/wrong-attempt-1.wav`,
  wrong2: `${import.meta.env.BASE_URL}audio/wrong-attempt-2.wav`,
  correct: `${import.meta.env.BASE_URL}audio/correct-answer.wav`,
};

const voices = new Map<string, HTMLAudioElement>();
let current: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;

function voice(key: keyof typeof FILES) {
  let el = voices.get(key);
  if (!el) {
    el = new Audio(FILES[key]);
    el.preload = 'auto';
    el.addEventListener('error', () => console.warn(`[audio] missing asset: ${FILES[key]}`), { once: true });
    voices.set(key, el);
  }
  return el;
}

/** Very quiet synthesized tick; never interrupts speech. */
function click() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.03);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch {
    // Web Audio unavailable — silent
  }
}

export function play(key: AudioKey) {
  if (!getState().audioEnabled) return;
  if (key === 'click') return click();
  // One voice at a time: stop the previous recording before starting the next.
  if (current) {
    current.pause();
    current.currentTime = 0;
  }
  const el = voice(key);
  el.currentTime = 0;
  current = el;
  el.play().catch(() => {
    // autoplay restriction or missing file — quiz continues silently
  });
}

export function stopAudio() {
  current?.pause();
  current = null;
}

export function preloadVoices() {
  (Object.keys(FILES) as (keyof typeof FILES)[]).forEach(voice);
}
