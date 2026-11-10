import { PROVIDERS } from './providers/index.js'

/**
 * Server-side configuration, read from environment variables
 * (.env.local in development). Nothing here is sent to the browser except
 * the provider id, model name and whether a key is present.
 *
 *   BA_AI_PROVIDER         openai | anthropic | gemini | mock | local   (default openai)
 *   BA_AI_MODEL            model id; empty = the provider's default
 *   OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY
 *   BA_AI_TIMEOUT_MS       default 8000
 *   BA_AI_MAX_INPUT_CHARS  default 500
 *   BA_AI_FALLBACK         local | neutral   (default local)
 *   BA_AI_REASONING_EFFORT optional, OpenAI reasoning models only (e.g. minimal, low)
 */
export function readConfig(env = {}) {
  const requested = String(env.BA_AI_PROVIDER ?? 'openai').trim().toLowerCase() || 'openai'
  const known = Object.hasOwn(PROVIDERS, requested)
  const id = known ? requested : 'local'
  const provider = PROVIDERS[id]
  const model = String(env.BA_AI_MODEL ?? '').trim() || provider.defaultModel
  const apiKey = provider.keyEnv ? String(env[provider.keyEnv] ?? '').trim() : ''
  return {
    provider: id,
    requestedProvider: requested,
    unknownProvider: !known,
    model,
    apiKey,
    keyEnv: provider.keyEnv ?? null,
    needsKey: provider.needsKey,
    timeoutMs: intIn(env.BA_AI_TIMEOUT_MS, 1000, 30000, 8000),
    maxInputChars: intIn(env.BA_AI_MAX_INPUT_CHARS, 20, 4000, 500),
    fallback: String(env.BA_AI_FALLBACK ?? 'local').trim().toLowerCase() === 'neutral' ? 'neutral' : 'local',
    options: {
      reasoningEffort: String(env.BA_AI_REASONING_EFFORT ?? '').trim() || undefined,
    },
  }
}

/** What the browser may see about the configuration (never the key). */
export function publicStatus(config) {
  return {
    provider: config.provider,
    model: config.model,
    keyPresent: config.needsKey ? Boolean(config.apiKey) : null,
    unknownProvider: config.unknownProvider ? config.requestedProvider : undefined,
    fallback: config.fallback,
  }
}

function intIn(value, min, max, fallback) {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
