import { test } from 'node:test'
import assert from 'node:assert/strict'
import { habitatTone, toneCssVars, TONE_BASE, TONE_REFERENCE } from './habitatTone.js'

const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6)

test('the starting environment keeps the base palette', () => {
  const tone = habitatTone(TONE_REFERENCE)
  for (const key of Object.keys(TONE_BASE)) assert.ok(close(tone[key], TONE_BASE[key]), key)
  assert.ok(Math.abs(tone.fogDensity - 0.0105) < 1e-9)
})

test('cold water is bluer, warm water is rosier', () => {
  const cold = habitatTone({ ...TONE_REFERENCE, temperature: 0 })
  const warm = habitatTone({ ...TONE_REFERENCE, temperature: 1 })
  assert.ok(cold.fog[2] - cold.fog[0] > warm.fog[2] - warm.fog[0])
  assert.ok(warm.fog[0] > cold.fog[0])
})

test('wet is hazier, dry is clearer; storms darken and dim the light', () => {
  assert.ok(habitatTone({ ...TONE_REFERENCE, moisture: 1 }).fogDensity > habitatTone({ ...TONE_REFERENCE, moisture: 0 }).fogDensity)
  const storm = habitatTone({ ...TONE_REFERENCE, turbulence: 1 })
  const lum = (c) => c[0] + c[1] + c[2]
  assert.ok(lum(storm.fog) < lum(TONE_BASE.fog))
  assert.ok(storm.keyIntensity < 1.5)
})

test('every value stays in range at the extremes', () => {
  for (const temperature of [0, 1]) for (const moisture of [0, 1]) for (const turbulence of [0, 1]) {
    const tone = habitatTone({ temperature, moisture, turbulence })
    for (const key of Object.keys(TONE_BASE)) for (const v of tone[key]) assert.ok(v >= 0 && v <= 1)
    assert.ok(tone.fogDensity >= 0.0045 && tone.fogDensity <= 0.05)
  }
})

test('dusk darkens everything toward night, and the page overlay follows', () => {
  const day = habitatTone(TONE_REFERENCE, 0)
  const night = habitatTone(TONE_REFERENCE, 1)
  const lum = (c) => c[0] + c[1] + c[2]
  for (const key of ['fog', 'top', 'ground']) assert.ok(lum(night[key]) < lum(day[key]) * 0.6, key)
  assert.ok(night.keyIntensity < day.keyIntensity * 0.3)
  assert.ok(night.caustic === 0)
  const vars = toneCssVars(night)
  assert.match(vars['--exp07-floor'], /^rgba\(/)
})

test('a storm thickens the haze and high moisture brings the film in', () => {
  const calm = habitatTone(TONE_REFERENCE)
  const storm = habitatTone({ ...TONE_REFERENCE, turbulence: 1 })
  assert.ok(calm.storm === 0)
  assert.ok(calm.film < 0.25)
  assert.ok(storm.fogDensity > calm.fogDensity * 2.2)
  assert.ok(storm.storm > 0.9)
  const wet = habitatTone({ ...TONE_REFERENCE, moisture: 1 })
  const dry = habitatTone({ ...TONE_REFERENCE, moisture: 0.4 })
  assert.ok(wet.film > 0.95)
  assert.ok(dry.film === 0)
})

test('the change is clearly visible: cold vs warm fog differ strongly', () => {
  const cold = habitatTone({ ...TONE_REFERENCE, temperature: 0 })
  const warm = habitatTone({ ...TONE_REFERENCE, temperature: 1 })
  const dist = Math.hypot(...cold.fog.map((v, i) => v - warm.fog[i]))
  assert.ok(dist > 0.2, `fog distance ${dist}`)
})
