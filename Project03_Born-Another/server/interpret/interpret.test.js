import { test } from 'node:test'
import assert from 'node:assert/strict'
import { interpretText } from './interpret.js'
import { publicStatus, readConfig } from './config.js'
import { normalizeInterpretation } from './schema.js'

const GOOD = { temperatureDelta: 0.4, moistureDelta: 0.7, turbulenceDelta: -0.1, intensity: 0.6, confidence: 0.9, durationSeconds: 40, emotionalTone: 'longing', semanticSummary: 'Warm rain.' }

function fakeFetch(handler) {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) })
    const { status = 200, json } = await handler(url, init)
    return { ok: status < 300, status, text: async () => JSON.stringify(json) }
  }
  impl.calls = calls
  return impl
}

test('config: OpenAI by default, unknown providers fall back to local, keys stay private', () => {
  const c = readConfig({})
  assert.equal(c.provider, 'openai')
  assert.equal(c.model, 'gpt-5.4-mini')
  assert.equal(readConfig({ BA_AI_PROVIDER: 'nope' }).provider, 'local')
  const s = publicStatus(readConfig({ BA_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'secret' }))
  assert.equal(s.keyPresent, true)
  assert.ok(!JSON.stringify(s).includes('secret'))
})

test('normalize clamps every field and rejects non-objects', () => {
  const n = normalizeInterpretation({ temperatureDelta: 9, moistureDelta: '-0.5', turbulenceDelta: null, intensity: -1, durationSeconds: 999, emotionalTone: 'ecstatic', semanticSummary: 'x'.repeat(400) })
  assert.equal(n.temperatureDelta, 1)
  assert.equal(n.moistureDelta, -0.5)
  assert.equal(n.turbulenceDelta, 0)
  assert.equal(n.intensity, 0)
  assert.equal(n.durationSeconds, 90)
  assert.equal(n.emotionalTone, 'other')
  assert.ok(n.semanticSummary.length <= 160)
  assert.throws(() => normalizeInterpretation('rain'))
})

test('missing key → rule-based fallback, with the reason', async () => {
  const r = await interpretText("It's raining.", { BA_AI_PROVIDER: 'openai' })
  assert.equal(r.meta.fallback.reason, 'missing_api_key')
  assert.ok(r.moistureDelta > 0)
})

test('OpenAI: strict json_schema request; output_text parsed', async () => {
  const f = fakeFetch(async () => ({ json: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(GOOD) }] }] } }))
  const r = await interpretText('I miss the summer rain.', { OPENAI_API_KEY: 'k', BA_AI_MODEL: 'some-model' }, { fetchImpl: f })
  assert.equal(r.meta.fallback, null)
  assert.equal(r.moistureDelta, 0.7)
  const call = f.calls[0]
  assert.match(call.url, /\/v1\/responses$/)
  assert.equal(call.init.headers.authorization, 'Bearer k')
  assert.equal(call.body.model, 'some-model')
  assert.equal(call.body.text.format.type, 'json_schema')
  assert.equal(call.body.text.format.strict, true)
})

test('Anthropic: forced tool call; tool input returned', async () => {
  const f = fakeFetch(async () => ({ json: { content: [{ type: 'tool_use', name: 'report_environment_interpretation', input: GOOD }], stop_reason: 'tool_use' } }))
  const r = await interpretText('x', { BA_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }, { fetchImpl: f })
  assert.equal(r.temperatureDelta, 0.4)
  assert.equal(f.calls[0].init.headers['x-api-key'], 'k')
  assert.equal(f.calls[0].body.tool_choice.type, 'tool')
  assert.equal(r.meta.model, 'claude-haiku-5-5')
})

test('Gemini: JSON mode with a response schema', async () => {
  const f = fakeFetch(async () => ({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify(GOOD) }] } }] } }))
  const r = await interpretText('x', { BA_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' }, { fetchImpl: f })
  assert.equal(r.intensity, 0.6)
  assert.match(f.calls[0].url, /models\/gemini-3\.5-flash-lite:generateContent$/)
  assert.equal(f.calls[0].body.generationConfig.responseMimeType, 'application/json')
})

test('HTTP errors and timeouts fall back instead of throwing', async () => {
  const err = fakeFetch(async () => ({ status: 429, json: { error: { message: 'rate limited' } } }))
  const r1 = await interpretText('Hello.', { OPENAI_API_KEY: 'k' }, { fetchImpl: err })
  assert.equal(r1.meta.fallback.reason, 'provider_error')
  assert.match(r1.meta.fallback.message, /429/)
  const slow = async (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
  const r2 = await interpretText('Hello.', { OPENAI_API_KEY: 'k', BA_AI_TIMEOUT_MS: '1000', BA_AI_FALLBACK: 'neutral' }, { fetchImpl: slow })
  assert.equal(r2.meta.fallback.reason, 'timeout')
  assert.equal(r2.intensity, 0)
})

test('input length limit', async () => {
  const r = await interpretText('a'.repeat(900), { BA_AI_PROVIDER: 'mock', BA_AI_MAX_INPUT_CHARS: '100' })
  assert.equal(r.meta.truncated, true)
})

test('mock mode: the acceptance sentences', async () => {
  const env = { BA_AI_PROVIDER: 'mock' }
  const get = (t) => interpretText(t, env)
  const rain = await get("It's raining.")
  assert.ok(rain.moistureDelta > 0.5)
  const summer = await get('I miss the summer rain.')
  assert.ok(summer.temperatureDelta > 0 && summer.moistureDelta > 0)
  const hello = await get('Hello.')
  assert.ok(Math.abs(hello.temperatureDelta) + Math.abs(hello.moistureDelta) + Math.abs(hello.turbulenceDelta) < 0.05)
  const quiet = await get('Everything feels quiet today.')
  assert.ok(quiet.turbulenceDelta < 0)
  const zh = await get('今天我想起了小时候的一个下午。')
  assert.equal(zh.emotionalTone, 'longing')
  const story = await get('My brother and I used to argue about everything, and then one winter he moved away and now we only talk on holidays, and I am not sure what I feel about it.')
  assert.equal(story.meta.provider, 'mock')
  for (const r of [rain, summer, hello, quiet, zh, story]) assert.equal(r.meta.fallback, null)
})
