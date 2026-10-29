export type IntroMode = 'none' | 'full' | 'reduced';

const KEY = 'bio-intro-seen';

/** Full intro once per browser session; reduced-motion users get a short static fade. */
export function introMode(seen: boolean, reducedMotion: boolean): IntroMode {
  if (seen) return 'none';
  return reducedMotion ? 'reduced' : 'full';
}

export function readSeen() {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markSeen() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // storage unavailable: intro simply shows again next load
  }
}
