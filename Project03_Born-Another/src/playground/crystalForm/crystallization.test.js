import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CRYSTAL_PRESETS,
  crystalGrowth,
  crystallizationState,
  crystallizationTarget,
  rimeAmount,
  stepCrystallization,
} from './crystallization.js'

const preset = (id) => CRYSTAL_PRESETS.find((p) => p.id === id)

test('cold + moist freezes far more than neutral', () => {
  const freeze = crystallizationTarget(preset('freeze'))
  const neutral = crystallizationTarget(preset('neutral'))
  assert.ok(freeze > 0.8, `freeze target ${freeze}`)
  assert.ok(neutral > 0 && neutral < 0.4, `neutral target ${neutral}`)
})

test('warmth thaws the lattice completely', () => {
  assert.equal(crystallizationTarget(preset('thaw')), 0)
})

test('turbulence lowers the target', () => {
  const calm = crystallizationTarget({ temperature: 0.2, moisture: 0.6, turbulence: 0 })
  const storm = crystallizationTarget({ temperature: 0.2, moisture: 0.6, turbulence: 0.9 })
  assert.ok(storm < calm * 0.4)
})

test('level eases toward target and stays in range', () => {
  let level = 0
  for (let i = 0; i < 600; i++) level = stepCrystallization(level, 0.7, { dt: 1 / 60 })
  assert.ok(level > 0.6 && level <= 0.7, `after 10 s ${level}`)
  for (let i = 0; i < 600; i++) level = stepCrystallization(level, 0, { dt: 1 / 60, turbulence: 0.9 })
  assert.ok(level < 0.01)
  assert.equal(stepCrystallization(0.5, 0.9, { dt: 0 }), 0.5)
})

test('melting is faster than growth', () => {
  const grown = stepCrystallization(0, 1, { dt: 1 })
  const melted = 1 - stepCrystallization(1, 0, { dt: 1 })
  assert.ok(melted > grown)
})

test('rime needs moisture; crystals wait for their threshold', () => {
  assert.ok(rimeAmount(1, 0) < rimeAmount(1, 1))
  assert.equal(crystalGrowth(0.1, 0.3), 0)
  assert.equal(crystalGrowth(0.9, 0.3), 1)
})

test('state labels follow level and rate', () => {
  assert.equal(crystallizationState(0, 0), 'Fluid')
  assert.equal(crystallizationState(0.1, 0.05), 'Nucleating')
  assert.equal(crystallizationState(0.5, 0.05), 'Crystallizing')
  assert.equal(crystallizationState(0.8, 0), 'Crystalline')
  assert.equal(crystallizationState(0.5, -0.05, 0.1), 'Thawing')
  assert.equal(crystallizationState(0.5, -0.05, 0.8), 'Fracturing')
})
