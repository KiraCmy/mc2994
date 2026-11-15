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

test('the grove varies: every form and frost kind, a spread of heights, and a far grove in the fog', async () => {
  const { FAR_SPIRES, SPIRE_FORMS, SPIRE_FROSTS } = await import('./crystalSpires.js')
  assert.deepEqual([...new Set(SPIRES.map((s) => s.form))].sort(), [...SPIRE_FORMS].sort())
  assert.deepEqual([...new Set(SPIRES.map((s) => s.frost))].sort(), [...SPIRE_FROSTS].sort())
  const hs = SPIRES.map((s) => s.height)
  assert.ok(Math.max(...hs) / Math.min(...hs) > 2.5)
  assert.ok(FAR_SPIRES.length >= 16)
  for (const s of FAR_SPIRES) {
    const d = Math.hypot(s.x - SPIRE_CLEARING.centre[0], s.z - SPIRE_CLEARING.centre[1])
    assert.ok(d > 65 && d < 160, `${s.id} at ${d.toFixed(0)}`)
    const { parts, segs } = spireParts(s, () => 0)
    assert.ok(parts.length < 140 && segs.length > 0)
  }
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

test('every spire is hoarfrosted: dense needles, crown-heavy, finite and deterministic', async () => {
  const { frostParts } = await import('./crystalSpires.js')
  for (const s of SPIRES) {
    const { segs } = spireParts(s, () => 0)
    const frost = frostParts(s, segs, () => 0)
    assert.ok(frost.length > 200 && frost.length < 2500, `${s.id}: ${frost.length}`)
    for (const f of frost) assert.ok([...f.p, ...f.s, ...f.dir].every(Number.isFinite) && f.s.every((v) => v > 0))
    const high = frost.filter((f) => f.p[1] > s.height * 0.5).length
    const low = frost.filter((f) => f.p[1] > 0.5 && f.p[1] < s.height * 0.5).length
    /* Column trees are frosted all the way up; the others are crown-heavy. */
    assert.ok(s.form === 'column' ? high > low * 0.5 : high > low, `${s.id}: crown ${high} vs trunk ${low}`)
  }
  const { segs } = spireParts(SPIRES[2], () => 0)
  assert.deepEqual(frostParts(SPIRES[2], segs, () => 0), frostParts(SPIRES[2], segs, () => 0))
})
