import { useSyncExternalStore } from 'react';

/* ============================== types ============================== */

export interface ManifestFile {
  url: string;
  bytes: number;
}
export interface OfflineManifest {
  version: string;
  core: ManifestFile[];
  pack: { id: string; files: ManifestFile[] }[];
}
/** Rows shown to the learner; each maps to real files of the build. */
export type GroupId = 'app' | 'audio' | '3d' | 'interactive';
export const GROUP_LABEL: Record<GroupId, string> = {
  app: 'Darslar va testlar',
  audio: 'Test audiolari',
  '3d': '3D modellar',
  interactive: 'Interaktiv mashqlar',
};
export type PackStatus = 'unknown' | 'idle' | 'partial' | 'downloading' | 'ready' | 'error' | 'unsupported';
export interface PackProgress {
  status: PackStatus;
  doneBytes: number;
  totalBytes: number;
  groups: Record<GroupId, { done: number; total: number }>;
}
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export interface PwaState {
  standalone: boolean;
  ios: boolean;
  canPrompt: boolean;
  installed: boolean;
  online: boolean;
  /** the core app (shell, lessons, quizzes, audio) is in the offline cache */
  coreReady: boolean;
  pack: PackProgress;
  updateAvailable: boolean;
  usageMB: number | null;
  dismissedAt: number | null;
}

/* ============================== pure logic (tested) ============================== */

export const DISMISS_DAYS = 14;
const DAY = 86_400_000;

export function isStandalone(w: { matchMedia?: (q: string) => { matches: boolean }; navigator?: { standalone?: boolean } }) {
  return !!(w.matchMedia?.('(display-mode: standalone)').matches || w.navigator?.standalone === true);
}
/** iPhone/iPad (iPadOS reports a Mac with touch). No install prompt exists there, so we show the Share-sheet guide. */
export function isIOS(ua: string, platform = '', maxTouchPoints = 0) {
  return /iphone|ipad|ipod/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
}
/** Whether to offer “Ilovani o‘rnatish”: not when installed, only where installing is possible, and quiet after a dismiss. */
export function shouldOfferInstall(s: Pick<PwaState, 'standalone' | 'installed' | 'canPrompt' | 'ios' | 'dismissedAt'>, now = Date.now()) {
  if (s.standalone || s.installed) return false;
  if (!s.canPrompt && !s.ios) return false;
  return s.dismissedAt === null || now - s.dismissedAt > DISMISS_DAYS * DAY;
}

/** Splits the build manifest into the learner-facing groups. */
export function groupsOf(m: OfflineManifest): Record<GroupId, ManifestFile[]> {
  return {
    app: m.core.filter((f) => !f.url.startsWith('/audio/')),
    audio: m.core.filter((f) => f.url.startsWith('/audio/')),
    '3d': m.pack.find((g) => g.id === '3d')?.files ?? [],
    interactive: m.pack.find((g) => g.id === 'interactive')?.files ?? [],
  };
}

/** A new version is installed and waiting while an older one still controls the page. */
export const hasWaitingUpdate = (reg: Pick<ServiceWorkerRegistration, 'waiting'> | null, controlled: boolean) => !!reg?.waiting && controlled;

const emptyGroups = (): PackProgress['groups'] => ({ app: { done: 0, total: 0 }, audio: { done: 0, total: 0 }, '3d': { done: 0, total: 0 }, interactive: { done: 0, total: 0 } });

/** What is already cached, without downloading anything (also used to resume after the app was closed mid-way). */
export async function inspectCache(m: OfflineManifest, cache: Pick<CacheStorage, 'match'>): Promise<PackProgress & { coreReady: boolean }> {
  const groups = emptyGroups();
  let doneBytes = 0;
  let totalBytes = 0;
  let coreMissing = 0;
  for (const [id, files] of Object.entries(groupsOf(m)) as [GroupId, ManifestFile[]][]) {
    for (const f of files) {
      const hit = !!(await cache.match(f.url));
      groups[id].total++;
      totalBytes += f.bytes;
      if (hit) {
        groups[id].done++;
        doneBytes += f.bytes;
      } else if (id === 'app' || id === 'audio') coreMissing++;
    }
  }
  const all = Object.values(groups).every((g) => g.done === g.total);
  return { status: all ? 'ready' : doneBytes > 0 ? 'partial' : 'idle', doneBytes, totalBytes, groups, coreReady: coreMissing === 0 };
}

/**
 * Downloads every file of the build that is not cached yet (core files too, so a cleared cache recovers).
 * Progress is real: bytes of files actually stored. A file is stored only once fully fetched, so cancelling
 * or failing leaves a consistent partial cache that the next run continues from.
 */
export async function preparePack(
  m: OfflineManifest,
  deps: { fetch: typeof fetch; caches: Pick<CacheStorage, 'match' | 'open'> },
  onProgress: (p: PackProgress) => void,
  signal?: AbortSignal,
  concurrency = 4,
): Promise<PackProgress> {
  const start = await inspectCache(m, deps.caches);
  const p: PackProgress = { ...start, status: 'downloading' };
  onProgress({ ...p });
  const cache = await deps.caches.open(`bio-pack-${m.version}`);
  const todo: [GroupId, ManifestFile][] = [];
  for (const [id, files] of Object.entries(groupsOf(m)) as [GroupId, ManifestFile[]][])
    for (const f of files) if (!(await deps.caches.match(f.url))) todo.push([id, f]);
  let failed = false;
  const worker = async () => {
    for (let job = todo.shift(); job; job = todo.shift()) {
      if (signal?.aborted) return;
      const [id, f] = job;
      try {
        const res = await deps.fetch(f.url, { signal, cache: 'reload' });
        if (!res.ok) throw new Error(String(res.status));
        await cache.put(f.url, res);
        p.groups[id].done++;
        p.doneBytes += f.bytes;
        onProgress({ ...p, groups: { ...p.groups } });
      } catch {
        if (signal?.aborted) return;
        failed = true;
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  const complete = Object.values(p.groups).every((g) => g.done === g.total);
  p.status = complete ? 'ready' : signal?.aborted ? 'partial' : failed ? 'error' : 'partial';
  onProgress({ ...p });
  return p;
}

/* ============================== store ============================== */

const PREF_KEY = 'bio-pwa';
const readPrefs = (): { dismissedAt: number | null; persistAsked: boolean; packWanted: boolean } => {
  try {
    const v = JSON.parse(localStorage.getItem(PREF_KEY) ?? 'null');
    return { dismissedAt: typeof v?.dismissedAt === 'number' ? v.dismissedAt : null, persistAsked: v?.persistAsked === true, packWanted: v?.packWanted === true };
  } catch {
    return { dismissedAt: null, persistAsked: false, packWanted: false };
  }
};
const writePrefs = (p: Partial<ReturnType<typeof readPrefs>>) => {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ ...readPrefs(), ...p }));
  } catch {
    // no storage: preference simply isn't remembered
  }
};

const hasWindow = typeof window !== 'undefined';
let state: PwaState = {
  standalone: hasWindow && isStandalone(window as unknown as Parameters<typeof isStandalone>[0]),
  ios: hasWindow && isIOS(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
  canPrompt: false,
  installed: false,
  online: !hasWindow || navigator.onLine,
  coreReady: false,
  pack: { status: 'unknown', doneBytes: 0, totalBytes: 0, groups: emptyGroups() },
  updateAvailable: false,
  usageMB: null,
  dismissedAt: hasWindow ? readPrefs().dismissedAt : null,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const getPwa = () => state;
export function usePwa<T>(select: (s: PwaState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
  );
}

/* ============================== browser wiring ============================== */

let deferred: BeforeInstallPromptEvent | null = null;
let registration: ServiceWorkerRegistration | null = null;
let manifest: OfflineManifest | null = null;
let abort: AbortController | null = null;
const log = (...a: unknown[]) => {
  if (import.meta.env.DEV) console.info('[pwa]', ...a);
};

async function loadManifest() {
  const res = await fetch('/offline-manifest.json');
  if (!res.ok) throw new Error('no offline manifest');
  manifest = (await res.clone().json()) as OfflineManifest;
  // keep a copy beside the downloaded files, so the offline status still works after the core cache was cleared
  if ('caches' in window) void caches.open(`bio-pack-${manifest.version}`).then((c) => c.put('/offline-manifest.json', res));
  return manifest;
}

async function measure() {
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.usage !== undefined) set({ usageMB: Math.round((est.usage / 1048576) * 10) / 10 });
  } catch {
    // estimate unsupported
  }
}

/** Re-reads what is cached (after start-up, activation, reconnection or a download). */
export async function refreshOffline() {
  if (!('caches' in window)) return set({ pack: { ...state.pack, status: 'unsupported' } });
  try {
    const m = manifest ?? (await loadManifest());
    const r = await inspectCache(m, caches);
    set({ coreReady: r.coreReady, pack: { status: r.status, doneBytes: r.doneBytes, totalBytes: r.totalBytes, groups: r.groups } });
    void measure();
    // the learner already chose offline: after an app update (changed files) or a cleared cache, refill quietly
    if (r.status !== 'ready' && readPrefs().packWanted && navigator.onLine) void prepareOffline();
  } catch {
    // not built with the offline manifest (dev server) or offline before the first visit completed
  }
}

export async function prepareOffline() {
  if (!('caches' in window) || state.pack.status === 'downloading') return;
  abort = new AbortController();
  try {
    const m = manifest ?? (await loadManifest());
    const r = await preparePack(m, { fetch: window.fetch.bind(window), caches }, (pack) => set({ pack }), abort.signal);
    if (r.status === 'ready') {
      set({ coreReady: true });
      writePrefs({ packWanted: true });
      // ask once for durable storage; the app works the same if the browser says no
      if (!readPrefs().persistAsked) {
        writePrefs({ persistAsked: true });
        void navigator.storage?.persist?.().catch(() => false);
      }
    }
  } catch {
    set({ pack: { ...state.pack, status: 'error' } });
  } finally {
    abort = null;
    void measure();
  }
}

export function cancelOffline() {
  abort?.abort();
}

/** Removes downloaded learning files only. Progress, highlights and settings live in localStorage and stay. */
export async function clearOffline() {
  cancelOffline();
  writePrefs({ packWanted: false });
  for (const name of await caches.keys()) if (name.startsWith('bio-pack-') || name.startsWith('bio-runtime-')) await caches.delete(name);
  await refreshOffline();
}

export async function install() {
  if (!deferred) return;
  await deferred.prompt();
  const choice = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  deferred = null;
  set({ canPrompt: false, installed: choice.outcome === 'accepted' });
}

export function dismissInstall() {
  const now = Date.now();
  writePrefs({ dismissedAt: now });
  set({ dismissedAt: now });
}

/** Activates a waiting new version. Called only from the learner's “Yangilash”, so a lesson or quiz is never cut off. */
export function applyUpdate(
  reg: Pick<ServiceWorkerRegistration, 'waiting'> | null = registration,
  container: Pick<ServiceWorkerContainer, 'addEventListener'> = navigator.serviceWorker,
  reload: () => void = () => location.reload(),
) {
  const waiting = reg?.waiting;
  if (!waiting) return false;
  container.addEventListener('controllerchange', reload, { once: true });
  waiting.postMessage('SKIP_WAITING');
  return true;
}

let started = false;
/** Wires install, connectivity and the service worker once per page (safe to call again). */
export function startPwa(onReconnect?: () => void) {
  if (started || !hasWindow) return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep it for our own button instead of the browser's mini-bar
    deferred = e as BeforeInstallPromptEvent;
    set({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    set({ installed: true, canPrompt: false });
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', (e) => set({ standalone: e.matches }));
  window.addEventListener('offline', () => set({ online: false }));
  window.addEventListener('online', () => {
    set({ online: true });
    onReconnect?.();
    void registration?.update().catch(() => {});
    void refreshOffline();
  });

  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      log('registered', registration.scope);
      const flag = () => set({ updateAvailable: hasWaitingUpdate(registration, !!navigator.serviceWorker.controller) });
      flag();
      registration.addEventListener('updatefound', () => {
        const w = registration!.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed') flag();
          if (w.state === 'activated') void refreshOffline();
        });
      });
      await navigator.serviceWorker.ready;
      await refreshOffline();
      // look for a new version now and then while the app stays open
      setInterval(() => void registration?.update().catch(() => {}), 60 * 60 * 1000);
    } catch (err) {
      log('registration failed', err);
    }
  });
}
