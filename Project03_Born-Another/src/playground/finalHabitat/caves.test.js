import { test } from 'node:test'
import assert from 'node:assert/strict'
import { centreDistance, clearance, remainNiches, underworldCeiling, underworldDepth, underworldFloor, underworldSpan, UNDERWORLD } from './caves.js'
import { habitatHeight, habitatSurfaceHeight, holeDistance } from './habitatField.js'
import { SPIRE_CLEARING, SPIRES, spireWidth } from './crystalSpires.js'

const { hole, centre, radius } = UNDERWORLD

test('the hole drops to the cavern floor; the cavern lies under the sand', () => {
  assert.ok(Math.hypot(hole.x - SPIRE_CLEARING.centre[0], hole.z - SPIRE_CLEARING.centre[1]) > SPIRE_CLEARING.radius + hole.rim)
  for (const s of SPIRES) assert.ok(Math.hypot(hole.x - s.x, hole.z - s.z) > hole.rim + spireWidth(s.height) * 2)
  assert.equal(habitatHeight(hole.x, hole.z), underworldFloor(hole.x, hole.z))
  assert.ok(habitatSurfaceHeight(hole.x + hole.r + 2, hole.z) - underworldFloor(hole.x, hole.z) > 10)
  /* Under the hole it is wide open. */
  assert.ok(clearance(hole.x + hole.r + 1, hole.z) > 6)
  /* Walls at the edge. */
  assert.ok(clearance(centre.x + radius * 0.99, centre.z) < 0.05)
})

test('ceiling stays between floor and sand everywhere', () => {
  for (let i = 0; i < 400; i++) {
    const a = i * 2.39996
    const d = Math.sqrt(i / 400) * radius
    const x = centre.x + Math.cos(a) * d
    const z = centre.z + Math.sin(a) * d
    const c = underworldCeiling(x, z)
    assert.ok(c >= underworldFloor(x, z) - 1e-9)
    assert.ok(c <= habitatSurfaceHeight(x, z) - 1.39)
  }
})

test('underground span, depth, and niches', () => {
  const x = hole.x + hole.r + 3
  const z = hole.z
  const f = underworldFloor(x, z)
  const span = underworldSpan(x, f + 1.5, z)
  assert.ok(span && span.ceiling - span.floor > 3)
  assert.equal(underworldSpan(x, habitatSurfaceHeight(x, z) + 1, z), null)
  assert.ok(underworldDepth([x, f + 1.5, z]) >= 0.5)
  assert.equal(underworldDepth([0, 2, 0]), 0)
  const niches = remainNiches(24)
  assert.ok(niches.length >= 18, `only ${niches.length} niches`)
  for (const [nx, ny, nz] of niches) {
    assert.ok(centreDistance(nx, nz) < radius)
    assert.ok(ny < underworldCeiling(nx, nz))
    assert.ok(holeDistance(nx, nz) > hole.r)
  }
  /* Newer first, nearer the hole. */
  assert.ok(holeDistance(niches[0][0], niches[0][2]) < holeDistance(niches.at(-1)[0], niches.at(-1)[2]))
})
