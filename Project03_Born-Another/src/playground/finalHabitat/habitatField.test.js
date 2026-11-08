import assert from 'node:assert/strict'
import test from 'node:test'
import { habitatColor, habitatHeight, habitatNormal, habitatRng } from './habitatField.js'

test('height field is deterministic', () => {
  assert.equal(habitatHeight(1.3, -2.7), habitatHeight(1.3, -2.7))
})

test('clearing under the organism is near-flat', () => {
  const samples = []
  for (let a = 0; a < 12; a++) {
    const t = (a / 12) * Math.PI * 2
    samples.push(habitatHeight(Math.cos(t) * 1.2, Math.sin(t) * 1.2))
  }
  const spread = Math.max(...samples) - Math.min(...samples)
  assert.ok(spread < 0.25, `clearing spread ${spread}`)
})

test('banks rise behind the clearing', () => {
  assert.ok(habitatHeight(0, -16) > habitatHeight(0, 0) + 1.5)
})

test('normals are unit length and mostly up in the clearing', () => {
  const n = habitatNormal(0.4, 0.3)
  assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-6)
  assert.ok(n[1] > 0.9)
})

test('colours stay in 0..1 and rng is seeded', () => {
  for (const [x, z] of [[0, 0], [5, -5], [-8, 3]]) {
    for (const c of habitatColor(x, z, habitatHeight(x, z), 0.3)) assert.ok(c >= 0 && c <= 1)
  }
  const a = habitatRng(9)
  const b = habitatRng(9)
  assert.equal(a(), b())
})

test('veils never sink below the sand and the far field rises', async () => {
  const { habitatVeilHeight, habitatHeight: h } = await import('./habitatField.js')
  for (const [x, z] of [[3, 1], [-12, -20], [40, -30]]) {
    assert.ok(habitatVeilHeight(x, z) >= h(x, z))
  }
  assert.ok(h(0, -250) > h(0, -20) + 10)
})
