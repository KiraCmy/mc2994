/**
 * Browser side of the interpreter: one POST per submitted expression to the
 * server route (/api/interpret), which holds the provider and its API key.
 * If the route is missing (static hosting), slow or failing, the offline
 * rule-based interpreter answers instead. Never throws.
 */
import { normalizeInterpretation } from '../../../server/interpret/schema.js'
import { localInterpretation } from './localInterpretation.js'

export const INTERPRET_ENDPOINT = '/api/interpret'

export async function interpretExpression(text, { timeoutMs = 12000, fetchImpl = globalThis.fetch } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(INTERPRET_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!String(res.headers.get('content-type') ?? '').includes('json')) throw new Error('no interpreter route')
    const data = await res.json()
    return { ...normalizeInterpretation(data), meta: sanitizeMeta(data.meta) }
  } catch (error) {
    return {
      ...localInterpretation(text),
      meta: {
        provider: 'local',
        model: 'rules',
        fallback: { reason: error?.name === 'AbortError' ? 'timeout' : 'api_unreachable', by: 'local', message: String(error?.message ?? error).slice(0, 120) },
      },
    }
  } finally {
    clearTimeout(timer)
  }
}

function sanitizeMeta(meta) {
  const m = meta && typeof meta === 'object' ? meta : {}
  return {
    provider: String(m.provider ?? 'unknown'),
    model: String(m.model ?? ''),
    fallback: m.fallback ? { reason: String(m.fallback.reason ?? ''), by: String(m.fallback.by ?? ''), message: String(m.fallback.message ?? '').slice(0, 200) } : null,
    latencyMs: Number(m.latencyMs) || 0,
    truncated: Boolean(m.truncated),
  }
}
