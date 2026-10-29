import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  text: string;
  link?: { to: string; label: string };
}

let current: Toast | null = null;
let timer = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** One small, non-blocking confirmation at a time. */
export function toast(text: string, link?: Toast['link']) {
  current = { id: Date.now(), text, link };
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    current = null;
    emit();
  }, 2600);
  emit();
}

export function useToast() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
