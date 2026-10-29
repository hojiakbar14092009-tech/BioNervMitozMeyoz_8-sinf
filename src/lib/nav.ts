/** Sensible parent when there is no in-app history to go back to (deep link, new tab). */
export function parentOf(pathname: string): string {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts.length >= 2 && (parts[0] === '8-sinf' || parts[0] === '10-sinf')) return `/${parts[0]}`;
  return '/';
}

/** React Router stores the history index in history.state.idx; >0 means an in-app page precedes this one. */
export const hasInAppHistory = () => ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
