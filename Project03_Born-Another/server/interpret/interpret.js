import { readConfig } from './config.js'
import { PROVIDERS } from './providers/index.js'
import { neutralInterpretation, normalizeInterpretation } from './schema.js'

/**
 * One expression → one interpretation, in the shared schema, plus `meta`
 * describing who answered. Never throws: on a missing key, timeout, HTTP
 * error or invalid output it falls back (rule-based parser, or neutral).
 */
export async function interpretText(rawText, env = {}, { fetchImpl = globalThis.fetch } = {}) {
  const config = readConfig(env)
  const started = Date.now()
  const original = String(rawText ?? '')
  const text = original.replace(/\s+/g, ' ').trim().slice(0, config.maxInputChars)
  const meta = {
    provider: config.provider,
    model: config.model,
    truncated: original.trim().length > config.maxInputChars,
    fallback: null,
    latencyMs: 0,
  }
  if (!text) {
    return { ...neutralInterpretation('Nothing was said.'), meta: { ...meta, latencyMs: 0 } }
  }

  const provider = PROVIDERS[config.provider]
  try {
    if (config.unknownProvider) throw tagged(`unknown provider "${config.requestedProvider}"`, 'unknown_provider')
    if (provider.needsKey && !config.apiKey) throw tagged(`${config.keyEnv} is not set`, 'missing_api_key')
    const raw = await withTimeout(
      (signal) => provider.interpret({ text, model: config.model, apiKey: config.apiKey, signal, fetchImpl, options: config.options }),
      config.timeoutMs,
    )
    const result = normalizeInterpretation(raw)
    return { ...result, meta: { ...meta, latencyMs: Date.now() - started } }
  } catch (error) {
    const reason = error?.code ?? (error?.name === 'AbortError' ? 'timeout' : 'provider_error')
    const fallback =
      config.fallback === 'neutral'
        ? neutralInterpretation('Interpreter unavailable; the water stays as it was.')
        : normalizeInterpretation(await PROVIDERS.local.interpret({ text }))
    return {
      ...fallback,
      meta: {
        ...meta,
        fallback: { reason, by: config.fallback, message: String(error?.message ?? error).slice(0, 200) },
        latencyMs: Date.now() - started,
      },
    }
  }
}

async function withTimeout(run, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise((_, reject) =>
        controller.signal.addEventListener('abort', () => reject(Object.assign(new Error(`timed out after ${ms} ms`), { name: 'AbortError', code: 'timeout' })), { once: true }),
      ),
    ])
  } finally {
    clearTimeout(timer)
  }
}

function tagged(message, code) {
  return Object.assign(new Error(message), { code })
}
