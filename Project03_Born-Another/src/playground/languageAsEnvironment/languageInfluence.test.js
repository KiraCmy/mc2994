import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeEnvironment, effectFromInterpretation, envelope, influenceAt, INFLUENCE_RULES, pruneEffects } from './languageInfluence.js'

const rain = { temperatureDelta: -0.15, moistureDelta: 0.8, turbulenceDelta: 0.1, intensity: 0.6, confidence: 0.95, durationSeconds: 40 }
const hello = { temperatureDelta: 0, moistureDelta: 0, turbulenceDelta: 0.02, intensity: 0.05, confidence: 0.9, durationSeconds: 10 }

test('neutral language makes no change', () => {
  const e = effectFromInterpretation(hello, 0)
  assert.equal(e.active, false)
  assert.deepEqual(influenceAt([e], 5), { temperature: 0, moisture: 0, turbulence: 0 })
})

test('an effect eases in, holds, and relaxes back to nothing', () => {
  const e = effectFromInterpretation(rain, 0)
  assert.ok(e.deltas.moisture > 0 && e.deltas.moisture <= INFLUENCE_RULES.maxStep)
  assert.ok(envelope(e, 1) < envelope(e, 3))
  assert.equal(envelope(e, 20), 1)
  assert.ok(envelope(e, 45) < 1)
  assert.equal(envelope(e, 40 + e.release + 1), 0)
  assert.equal(pruneEffects([e], 40 + e.release + 1).length, 0)
})

test('repeated expressions overlap but stay bounded and in range', () => {
  const effects = Array.from({ length: 30 }, (_, i) => effectFromInterpretation({ ...rain, intensity: 1, confidence: 1, moistureDelta: 1 }, i * 0.5))
  const inf = influenceAt(effects, 20)
  assert.equal(inf.moisture, INFLUENCE_RULES.maxTotal)
  const env = composeEnvironment({ temperature: 0.5, moisture: 0.9, turbulence: 0.1 }, inf)
  for (const v of Object.values(env)) assert.ok(v >= 0 && v <= 1)
  assert.equal(env.moisture, 1)
})
