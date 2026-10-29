import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

type Entry = { url: string; bytes: number }

/**
 * Offline manifest built from the real production output (no hand-written asset list):
 * - core: everything needed to boot and read every lesson and quiz offline — the entry, page and data chunks,
 *   all their static imports, CSS, HTML shell, icons and quiz audio. The service worker precaches it on install.
 * - pack: chunks that only load lazily for 3D scenes and interactive exercises, downloaded by
 *   “Offline uchun tayyorlash” (or cached as lessons are visited).
 * The version is a hash of every file's name and content, so any change ships a new sw.js and triggers an update.
 */
function offlineManifest(): Plugin {
  let publicDir = 'public'
  return {
    name: 'bio-offline-manifest',
    apply: 'build',
    enforce: 'post',
    configResolved(c) {
      publicDir = c.publicDir
    },
    generateBundle(_, bundle) {
      const files = Object.values(bundle)
      const chunks = files.filter((f) => f.type === 'chunk')
      const byName = new Map(chunks.map((c) => [c.fileName, c]))
      const packKind = (c: (typeof chunks)[number]) => {
        const id = (c.facadeModuleId ?? '').replace(/\\/g, '/')
        return c.isDynamicEntry && /\/src\/features\/three\//.test(id) ? '3d' : c.isDynamicEntry && /\/src\/features\/interactives\//.test(id) ? 'interactive' : null
      }
      // core = closure of static imports from every chunk that is not a pack entry
      const core = new Set<string>()
      const visit = (name: string) => {
        if (core.has(name)) return
        core.add(name)
        byName.get(name)?.imports.forEach(visit)
      }
      chunks.filter((c) => !packKind(c)).forEach((c) => visit(c.fileName))
      const pack: Record<string, Set<string>> = { '3d': new Set(), interactive: new Set() }
      for (const c of chunks) {
        if (core.has(c.fileName)) continue
        // a pack chunk only shared with other pack chunks goes with the first group that needs it
        const owner = chunks.find((p) => packKind(p) && p.imports.includes(c.fileName))
        pack[packKind(c) ?? (owner && packKind(owner)) ?? '3d'].add(c.fileName)
      }
      const cssOf = (name: string) => [...((byName.get(name) as { viteMetadata?: { importedCss: Set<string> } } | undefined)?.viteMetadata?.importedCss ?? [])]
      const size = (name: string) => {
        const f = bundle[name]
        return f ? (f.type === 'chunk' ? Buffer.byteLength(f.code) : typeof f.source === 'string' ? Buffer.byteLength(f.source) : f.source.byteLength) : 0
      }
      const entry = (name: string): Entry => ({ url: `/${name}`, bytes: size(name) })
      const packCss = new Set(Object.values(pack).flatMap((s) => [...s].flatMap(cssOf)))
      const assets = files.filter((f) => f.type === 'asset' && !f.fileName.endsWith('.html') && !f.fileName.endsWith('.map') && !packCss.has(f.fileName))

      const publicFiles: Entry[] = []
      const walk = (dir: string) => {
        for (const n of readdirSync(dir)) {
          const p = join(dir, n)
          if (statSync(p).isDirectory()) walk(p)
          else publicFiles.push({ url: '/' + relative(publicDir, p).replace(/\\/g, '/'), bytes: statSync(p).size })
        }
      }
      walk(publicDir)

      const html = bundle['index.html']
      const manifest = {
        version: '',
        core: [
          { url: '/index.html', bytes: html && html.type === 'asset' ? Buffer.byteLength(String(html.source)) : 0 },
          ...[...core].map(entry),
          ...assets.map((a) => entry(a.fileName)),
          ...publicFiles,
        ],
        pack: [
          { id: '3d', files: [...pack['3d']].flatMap((n) => [n, ...cssOf(n)]).map(entry) },
          { id: 'interactive', files: [...pack.interactive].flatMap((n) => [n, ...cssOf(n)]).map(entry) },
        ],
      }
      const h = createHash('sha256')
      for (const f of [...manifest.core, ...manifest.pack.flatMap((g) => g.files)]) h.update(f.url + ':' + f.bytes)
      if (html && html.type === 'asset') h.update(String(html.source))
      for (const f of publicFiles) h.update(readFileSync(join(publicDir, f.url)))
      const template = readFileSync(new URL('./pwa/sw.js', import.meta.url), 'utf8')
      h.update(template)
      manifest.version = h.digest('hex').slice(0, 12)

      this.emitFile({ type: 'asset', fileName: 'offline-manifest.json', source: JSON.stringify(manifest) })
      const sw = template.replaceAll('__BIO_VERSION__', manifest.version)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlineManifest()],
})
