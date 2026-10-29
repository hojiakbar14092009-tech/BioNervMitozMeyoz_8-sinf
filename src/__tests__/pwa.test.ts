import { describe, expect, it, vi } from 'vitest';
import { DISMISS_DAYS, applyUpdate, groupsOf, hasWaitingUpdate, inspectCache, isIOS, isStandalone, preparePack, shouldOfferInstall, type OfflineManifest, type PackProgress } from '../features/pwa/pwa';

const manifest: OfflineManifest = {
  version: 'v1',
  core: [
    { url: '/index.html', bytes: 1000 },
    { url: '/assets/index-a.js', bytes: 5000 },
    { url: '/audio/correct-answer.wav', bytes: 2000 },
  ],
  pack: [
    { id: '3d', files: [{ url: '/assets/Brain-b.js', bytes: 300 }, { url: '/assets/Dna-c.js', bytes: 200 }] },
    { id: 'interactive', files: [{ url: '/assets/Microscope-d.js', bytes: 500 }] },
  ],
};

/** Minimal Cache Storage: a set of URLs; open() returns a cache that adds to the same set. */
function fakeCaches(initial: string[] = []) {
  const stored = new Set(initial);
  return {
    stored,
    match: async (url: RequestInfo | URL) => (stored.has(String(url)) ? new Response('x') : undefined),
    open: async () => ({ put: async (url: RequestInfo | URL) => void stored.add(String(url)) }) as unknown as Cache,
  };
}
const ok = () => Promise.resolve(new Response('x', { status: 200 }));

describe('install state', () => {
  it('detects standalone mode (display-mode or iOS navigator.standalone)', () => {
    expect(isStandalone({ matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } })).toBe(true);
    expect(isStandalone({ matchMedia: () => ({ matches: false }), navigator: {} })).toBe(false);
  });

  it('recognises iPhone, iPad and iPadOS-as-Mac, not Android or desktop', () => {
    expect(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
    expect(isIOS('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(false);
  });

  it('offers install only where possible, never when installed, and stays quiet after a dismiss', () => {
    const base = { standalone: false, installed: false, canPrompt: true, ios: false, dismissedAt: null };
    expect(shouldOfferInstall(base)).toBe(true);
    expect(shouldOfferInstall({ ...base, standalone: true })).toBe(false);
    expect(shouldOfferInstall({ ...base, installed: true })).toBe(false);
    expect(shouldOfferInstall({ ...base, canPrompt: false })).toBe(false); // e.g. Firefox desktop: nothing to offer
    expect(shouldOfferInstall({ ...base, canPrompt: false, ios: true })).toBe(true); // iOS: the Share-sheet guide
    const now = Date.now();
    expect(shouldOfferInstall({ ...base, dismissedAt: now - 86_400_000 }, now)).toBe(false);
    expect(shouldOfferInstall({ ...base, dismissedAt: now - (DISMISS_DAYS + 1) * 86_400_000 }, now)).toBe(true);
  });
});

describe('offline pack', () => {
  it('groups the build manifest into lessons, audio, 3D and exercises', () => {
    const g = groupsOf(manifest);
    expect(g.app.map((f) => f.url)).toEqual(['/index.html', '/assets/index-a.js']);
    expect(g.audio.map((f) => f.url)).toEqual(['/audio/correct-answer.wav']);
    expect(g['3d']).toHaveLength(2);
    expect(g.interactive).toHaveLength(1);
  });

  it('reports what is cached without downloading (core ready, pack not yet)', async () => {
    const r = await inspectCache(manifest, fakeCaches(['/index.html', '/assets/index-a.js', '/audio/correct-answer.wav']));
    expect(r.coreReady).toBe(true);
    expect(r.status).toBe('partial');
    expect(r.groups['3d']).toEqual({ done: 0, total: 2 });
    expect(r.doneBytes).toBe(8000);
    expect(r.totalBytes).toBe(9000);
  });

  it('downloads only missing files, reports real byte progress and ends ready', async () => {
    const c = fakeCaches(['/index.html', '/assets/index-a.js', '/audio/correct-answer.wav']);
    const fetch = vi.fn<(url: string) => Promise<Response>>(ok);
    const seen: PackProgress[] = [];
    const r = await preparePack(manifest, { fetch: fetch as unknown as typeof globalThis.fetch, caches: c }, (p) => seen.push(p), undefined, 1);
    expect(fetch.mock.calls.map((x) => x[0])).toEqual(['/assets/Brain-b.js', '/assets/Dna-c.js', '/assets/Microscope-d.js']);
    expect(seen.map((p) => p.doneBytes)).toEqual([8000, 8300, 8500, 9000, 9000]);
    expect(r.status).toBe('ready');
    expect(Object.values(r.groups).every((g) => g.done === g.total)).toBe(true);
  });

  it('a failed file ends in the error state; a retry continues from what is already stored', async () => {
    const c = fakeCaches(['/index.html', '/assets/index-a.js', '/audio/correct-answer.wav']);
    const flaky = vi.fn((url: string) => (url.includes('Dna') ? Promise.reject(new TypeError('offline')) : ok()));
    const first = await preparePack(manifest, { fetch: flaky as unknown as typeof globalThis.fetch, caches: c }, () => {}, undefined, 1);
    expect(first.status).toBe('error');
    expect(c.stored.has('/assets/Brain-b.js')).toBe(true);
    expect(c.stored.has('/assets/Dna-c.js')).toBe(false); // nothing half-written
    const retry = vi.fn<(url: string) => Promise<Response>>(ok);
    const second = await preparePack(manifest, { fetch: retry as unknown as typeof globalThis.fetch, caches: c }, () => {}, undefined, 1);
    expect(retry.mock.calls.map((x) => x[0])).toEqual(['/assets/Dna-c.js']);
    expect(second.status).toBe('ready');
  });

  it('cancelling stops early and leaves a consistent partial cache', async () => {
    const c = fakeCaches();
    const ac = new AbortController();
    const fetch = vi.fn(async () => {
      ac.abort(); // the learner presses “Bekor qilish” during the first download
      return new Response('x');
    });
    const r = await preparePack(manifest, { fetch: fetch as unknown as typeof globalThis.fetch, caches: c }, () => {}, ac.signal, 1);
    expect(r.status).toBe('partial');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(c.stored.size).toBeLessThanOrEqual(1);
  });

  it('a cleared core cache is refilled by the same download (recovery)', async () => {
    const c = fakeCaches();
    const r = await preparePack(manifest, { fetch: vi.fn(ok) as unknown as typeof globalThis.fetch, caches: c }, () => {});
    expect(r.status).toBe('ready');
    expect([...c.stored].sort()).toEqual([...manifest.core, ...manifest.pack.flatMap((g) => g.files)].map((f) => f.url).sort());
  });
});

describe('update flow', () => {
  it('an update is available only when a new worker waits and an old one controls the page', () => {
    const waiting = {} as ServiceWorker;
    expect(hasWaitingUpdate({ waiting }, true)).toBe(true);
    expect(hasWaitingUpdate({ waiting }, false)).toBe(false); // first install: nothing to replace
    expect(hasWaitingUpdate({ waiting: null }, true)).toBe(false);
  });

  it('applying asks the waiting worker to take over, then reloads once it controls the page', () => {
    const postMessage = vi.fn();
    const listeners: Record<string, () => void> = {};
    const container = { addEventListener: (t: string, f: () => void) => void (listeners[t] = f) } as unknown as ServiceWorkerContainer;
    const reload = vi.fn();
    expect(applyUpdate({ waiting: { postMessage } as unknown as ServiceWorker }, container, reload)).toBe(true);
    expect(postMessage).toHaveBeenCalledWith('SKIP_WAITING');
    expect(reload).not.toHaveBeenCalled(); // no reload until the new worker is actually active
    listeners.controllerchange();
    expect(reload).toHaveBeenCalledOnce();
    expect(applyUpdate({ waiting: null }, container, reload)).toBe(false);
  });
});
