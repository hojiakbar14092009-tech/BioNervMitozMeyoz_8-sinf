/* Biologiya service worker. Built by vite.config.ts (bio-offline-manifest), which stamps the version below.
 * Caches (all prefixed "bio-"; learner data lives in localStorage and is never touched here):
 *   bio-core-<v>     app shell + every lesson, quiz and audio file — precached on install
 *   bio-pack-<v>     3D-scene and interactive chunks — “Offline uchun tayyorlash” or first visit
 *   bio-runtime-<v>  any other same-origin build file fetched while online
 */
const VERSION = '__BIO_VERSION__';
const CORE = `bio-core-${VERSION}`;
const PACK = `bio-pack-${VERSION}`;
const RUNTIME = `bio-runtime-${VERSION}`;
const MANIFEST = '/offline-manifest.json';
const HASHED = /^\/assets\//; // content-hashed file names: the same URL always means the same bytes

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch(MANIFEST, { cache: 'no-store' });
      const manifest = await res.json();
      if (manifest.version !== VERSION) throw new Error('manifest/worker version mismatch (deploy in progress)');
      const core = await caches.open(CORE);
      await core.put(MANIFEST, new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/json' } }));
      await Promise.all(
        manifest.core.map(async ({ url }) => {
          // unchanged hashed files are reused from the previous version instead of downloading again
          const old = HASHED.test(url) && (await caches.match(url));
          if (old) return core.put(url, old);
          const r = await fetch(url, { cache: 'reload' });
          if (!r.ok) throw new Error(`precache failed: ${url}`);
          await core.put(url, r);
        }),
      );
      // the first install has nothing to wait for; later versions wait for the learner's “Yangilash”
      if (!self.registration.active) await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const manifest = await (await caches.match(MANIFEST, { cacheName: CORE }))?.json();
      const wanted = new Set((manifest?.pack ?? []).flatMap((g) => g.files.map((f) => f.url)));
      const pack = await caches.open(PACK);
      for (const name of await caches.keys()) {
        if (!name.startsWith('bio-') || [CORE, PACK, RUNTIME].includes(name)) continue;
        // keep offline-pack files that did not change, so an update does not undo “offline ready”
        const old = await caches.open(name);
        for (const req of await old.keys()) {
          const path = new URL(req.url).pathname;
          if (wanted.has(path) && !(await pack.match(path))) await pack.put(path, await old.match(req));
        }
        await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname === '/sw.js') return; // never cache third-party or the worker
  if (req.mode === 'navigate') return event.respondWith(shell(req));
  event.respondWith(cacheFirst(req, url));
});

/** SPA navigation: the cached app shell of this exact version (matches its cached JS/CSS), else network. */
async function shell(req) {
  const hit = (await caches.match('/index.html', { cacheName: CORE })) || (await caches.match('/index.html'));
  if (hit) return hit;
  try {
    return await fetch(req);
  } catch {
    return offlinePage();
  }
}

async function cacheFirst(req, url) {
  const key = url.pathname;
  const hit = await caches.match(key);
  if (hit) return req.headers.has('range') ? ranged(hit, req.headers.get('range')) : hit;
  try {
    const res = await fetch(req);
    // keep same-origin build files and public media for offline use (never partial or error responses)
    // (cache: 'reload' = the page's own offline-pack download, which stores the file itself)
    if (res.status === 200 && req.cache !== 'reload' && (HASHED.test(key) || /^\/(audio|icons)\//.test(key))) {
      const copy = res.clone();
      caches.open(RUNTIME).then((c) => c.put(key, copy));
    }
    return res;
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

/** Media elements ask for byte ranges (Safari insists on 206): slice the cached file. */
async function ranged(res, header) {
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(header || '');
  const start = m && m[1] ? Number(m[1]) : 0;
  const end = m && m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'content-type': res.headers.get('content-type') || 'application/octet-stream',
      'content-range': `bytes ${start}-${end}/${buf.byteLength}`,
      'content-length': String(end - start + 1),
      'accept-ranges': 'bytes',
    },
  });
}

function offlinePage() {
  const html = `<!doctype html><html lang="uz"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Internet mavjud emas</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#f4f2ee;color:#1d212c;padding:24px;box-sizing:border-box}
@media (prefers-color-scheme:dark){body{background:#171a21;color:#eef0f6}}main{max-width:420px}h1{font-size:1.4rem}</style>
<main><h1>Internet mavjud emas</h1><p>Ilova hali bu qurilmada saqlanmagan. Internetga ulangach saytni bir marta oching — keyin u internet bo‘lmasa ham ishlaydi.</p></main></html>`;
  return new Response(html, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
