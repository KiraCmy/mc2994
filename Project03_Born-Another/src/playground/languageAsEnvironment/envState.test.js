import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ENV_NEUTRAL,
  disturbanceToTurbulence,
  quantizeEnvChannel,
} from './envState.js'

test('disturbanceToTurbulence maps neutral to calm', () => {
  assert.equal(disturbanceToTurbulence(ENV_NEUTRAL), 0)
  assert.equal(disturbanceToTurbulence(0), 0)
  assert.equal(disturbanceToTurbulence(1), 1)
  assert.ok(Math.abs(disturbanceToTurbulence(0.75) - 0.5) < 1e-9)
})

test('quantizeEnvChannel rounds to step', () => {
  assert.equal(quantizeEnvChannel(0.504), 0.5)
  assert.equal(quantizeEnvChannel(0.516), 0.52)
})
