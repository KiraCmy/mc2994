import { publicStatus, readConfig } from './interpret/config.js'
import { interpretText } from './interpret/interpret.js'

const MAX_BODY_BYTES = 16 * 1024

/**
 * Dev / preview server route for the language interpreter:
 *   GET  /api/interpret   → { provider, model, keyPresent }   (never the key)
 *   POST /api/interpret   { text } → interpretation (shared schema) + meta
 * `env` comes from loadEnv() in vite.config.js (.env.local etc.) and stays
 * on the server: none of it is exposed to the browser bundle.
 */
export function interpretApi(env) {
  const handler = async (req, res, next) => {
    const path = (req.url ?? '').split('?')[0]
    if (path !== '/' && path !== '') return next()
    try {
      if (req.method === 'GET') return send(res, 200, publicStatus(readConfig(env)))
      if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' })
      const body = await readBody(req)
      const text = typeof body?.text === 'string' ? body.text : ''
      const result = await interpretText(text, env)
      if (result.meta.fallback) {
        console.warn(`[interpret] ${result.meta.provider}/${result.meta.model} fell back (${result.meta.fallback.reason}): ${result.meta.fallback.message}`)
      }
      return send(res, 200, result)
    } catch (error) {
      return send(res, error.status ?? 400, { error: String(error.message ?? error) })
    }
  }
  const mount = (server) => server.middlewares.use('/api/interpret', handler)
  return {
    name: 'born-another-interpret-api',
    configureServer(server) {
      const c = readConfig(env)
      server.config.logger.info(`  ➜  Language interpreter: ${c.provider} / ${c.model}${c.needsKey && !c.apiKey ? `  (no ${c.keyEnv} — using ${c.fallback} fallback)` : ''}`)
      mount(server)
    },
    configurePreviewServer: mount,
  }
}

function send(res, status, json) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(json))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('request too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(Object.assign(new Error('invalid JSON'), { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}
