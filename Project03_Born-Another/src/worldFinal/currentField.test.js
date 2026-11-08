import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceCurrent,
  createCurrentField,
  createCurrentState,
  meanCurrent,
  sampleCurrentDisplacement,
  sampleCurrentVelocity,
} from './currentField.js'

const field = createCurrentField()

function stateAt(flowTime, strength = 1, speed = 1) {
  const s = createCurrentState()
  s.flowTime = flowTime
  s.strength = strength
  s.speed = speed
  return s
}

test('field is deterministic', () => {
  assert.deepEqual(createCurrentField().modes, field.modes)
})

test('eddies are divergence-free (no bunching or thinning)', () => {
  const s = stateAt(37.5)
  const h = 0.01
  const a = [0, 0, 0]
  const b = [0, 0, 0]
  for (const [x, y, z] of [[0, 0, 0], [120, 14, -80], [-260, 40, 310]]) {
    let div = 0
    for (let axis = 0; axis < 3; axis += 1) {
      const p = [x, y, z]
      const q = [x, y, z]
      p[axis] += h
      q[axis] -= h
      sampleCurrentVelocity(field, s, ...p, a)
      sampleCurrentVelocity(field, s, ...q, b)
      div += (a[axis] - b[axis]) / (2 * h)
    }
    assert.ok(Math.abs(div) < 1e-6, `divergence ${div}`)
  }
})

test('particle displacement moves at the eddy velocity', () => {
  const dt = 0.01
  const speed = 1.7
  const p = [40, 8, -25]
  const before = sampleCurrentDisplacement(field, stateAt(100, 1.3, speed), ...p)
  const after = sampleCurrentDisplacement(field, stateAt(100 + dt * speed, 1.3, speed), ...p)
  const s = stateAt(100 + (dt * speed) / 2, 1.3, speed)
  const v = sampleCurrentVelocity(field, s, ...p)
  for (let i = 0; i < 3; i += 1) v[i] -= s.mean[i]
  for (let i = 0; i < 3; i += 1) {
    assert.ok(Math.abs((after[i] - before[i]) / dt - v[i]) < 1e-3)
  }
})

test('flow is subtle and mostly horizontal', () => {
  const s = advanceCurrent(createCurrentState(), 1 / 60)
  let maxSpeed = 0
  let vertical = 0
  let horizontal = 0
  const v = [0, 0, 0]
  for (let i = 0; i < 200; i += 1) {
    sampleCurrentVelocity(field, s, i * 37.1 - 3700, (i % 7) * 9, i * -23.7 + 2000, v)
    maxSpeed = Math.max(maxSpeed, Math.hypot(...v))
    vertical += Math.abs(v[1])
    horizontal += Math.hypot(v[0], v[2])
  }
  assert.ok(maxSpeed < 2.5, `max speed ${maxSpeed.toFixed(2)} u/s`)
  assert.ok(vertical < horizontal * 0.4, 'vertical motion stays secondary')
})

test('current is locally coherent and varies only at large scales', () => {
  const s = advanceCurrent(createCurrentState(), 1 / 60, { currentSpeed: 0.7 })
  const a = [0, 0, 0]
  const b = [0, 0, 0]
  const cosineAt = (sep) => {
    let sum = 0
    let n = 0
    for (let i = 0; i < 120; i += 1) {
      const x = i * 53.3 - 3000
      const z = i * -41.9 + 2200
      const y = (i % 5) * 6
      sampleCurrentVelocity(field, s, x, y, z, a)
      sampleCurrentVelocity(field, s, x + sep * 0.8, y, z + sep * 0.6, b)
      sum += (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))
      n += 1
    }
    return sum / n
  }
  const near = cosineAt(5)
  const far = cosineAt(120)
  assert.ok(near > 0.97, `neighbours 5 u apart move together (cos ${near.toFixed(3)})`)
  assert.ok(far < near - 0.05, `distant water differs (cos ${far.toFixed(3)})`)
})

test('mean drift wanders without a short repeat', () => {
  const ref = meanCurrent(0)
  const v = [0, 0, 0]
  let closest = Infinity
  /* Any return to the starting direction within ~1.5 h of flow time? */
  for (let t = 120; t < 5400; t += 5) {
    meanCurrent(t, v)
    closest = Math.min(closest, Math.hypot(v[0] - ref[0], v[1] - ref[1], v[2] - ref[2]))
  }
  assert.ok(closest > 1e-3, 'mean direction never exactly repeats')
  meanCurrent(600, v)
  assert.ok(Math.hypot(v[0] - ref[0], v[2] - ref[2]) > 0.05, 'direction actually changes')
})

test('changing speed never makes the current jump', () => {
  const s = createCurrentState()
  for (let i = 0; i < 120; i += 1) advanceCurrent(s, 1 / 60, { currentSpeed: 1 })
  const t = s.flowTime
  const drift = [...s.drift]
  advanceCurrent(s, 1 / 60, { currentSpeed: 3 })
  assert.ok(s.flowTime - t < 0.06)
  assert.ok(Math.hypot(...s.drift.map((d, i) => d - drift[i])) < 0.1)
  advanceCurrent(s, 1 / 60, { currentSpeed: 0, currentStrength: 1 })
  const frozen = s.flowTime
  advanceCurrent(s, 1 / 60, { currentSpeed: 0 })
  assert.equal(s.flowTime, frozen)
})
