import { useSyncExternalStore } from 'react';

const mq = () => window.matchMedia('(prefers-reduced-motion: reduce)');

export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = mq();
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => mq().matches,
  );
}
