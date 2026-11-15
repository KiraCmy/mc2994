// TEMPORARY (README screenshots) — remove after use.
import fs from 'node:fs'
import path from 'node:path'
export function snapApi() {
  const out = path.resolve(process.cwd(), '../docs/assets/image/final/_raw')
  return {
    name: 'ba-snap-tmp',
    configureServer(server) {
      server.middlewares.use('/__snap', (req, res) => {
        if (req.method !== 'POST') { res.end('snap ok'); return }
        const name = path.basename(decodeURIComponent(req.url.replace(/^\//, ''))) || 'x.png'
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          fs.mkdirSync(out, { recursive: true })
          const buf = Buffer.concat(chunks)
          fs.writeFileSync(path.join(out, name), buf)
          res.end(String(buf.length))
        })
      })
    },
  }
}
