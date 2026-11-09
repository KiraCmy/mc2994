import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pushOutOfSpires, SPIRE_CLEARING, SPIRE_MINERAL, SPIRES, spireColliders, spireParts } from './crystalSpires.js'
import { ARRIVAL } from './worldOpening.js'

test('spires stay out of the clearing and away from the landing', () => {
  for (const s of SPIRES) {
    const c = Math.hypot(s.x - SPIRE_CLEARING.centre[0], s.z - SPIRE_CLEARING.centre[1])
    assert.ok(c > SPIRE_CLEARING.radius, `${s.id} too close to the clearing (${c.toFixed(1)})`)
    assert.ok(Math.hypot(s.x - ARRIVAL[0], s.z - ARRIVAL[1]) > 20, `${s.id} too close to the landing`)
  }
})

test('every lineage has spires of its own mineral, built from parts', () => {
  const minerals = new Set()
  for (const s of SPIRES) {
    const { mineral, parts } = spireParts(s, () => 0)
    assert.equal(mineral, SPIRE_MINERAL[s.species])
    minerals.add(mineral)
    assert.ok(parts.length > 8 && parts.length < 140, `${s.id}: ${parts.length} parts`)
    const top = Math.max(...parts.map((p) => p.p[1]))
    assert.ok(top > s.height * 0.6 && top < s.height * 1.25, `${s.id} height ${top.toFixed(1)} vs ${s.height}`)
    for (const p of parts) assert.ok(p.s.every((v) => v > 0 && Number.isFinite(v)))
  }
  assert.deepEqual([...minerals].sort(), ['calcite', 'quartz', 'selenite'])
})

test('spires are deterministic', () => {
  assert.deepEqual(spireParts(SPIRES[3], () => 0), spireParts(SPIRES[3], () => 0))
})

test('the camera is pushed out of a spire, not over one', () => {
  const cols = spireColliders(() => 0)
  const c = cols[0]
  const [dx, dz] = pushOutOfSpires([c.x + 0.2, 2, c.z], cols)
  assert.ok(Math.hypot(c.x + 0.2 + dx - c.x, dz) >= c.r - 1e-6)
  assert.deepEqual(pushOutOfSpires([c.x, c.top + 2, c.z], cols), [0, 0])
  assert.deepEqual(pushOutOfSpires([0, 2, -5], cols), [0, 0])
})
