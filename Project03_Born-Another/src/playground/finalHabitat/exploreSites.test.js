import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildExploreSites, EXPLORE_SITES } from './exploreSites.js'
import { SPIRE_CLEARING, SPIRES } from './crystalSpires.js'

test('sites ring the clearing in every direction, clear of spires and the clearing', () => {
  assert.ok(EXPLORE_SITES.length >= 20)
  const quadrants = new Set(EXPLORE_SITES.map((s) => `${s.x > 0}${s.z > 0}`))
  assert.equal(quadrants.size, 4)
  const [cx, cz] = SPIRE_CLEARING.centre
  for (const s of EXPLORE_SITES) {
    assert.ok(Math.hypot(s.x - cx, s.z - cz) > SPIRE_CLEARING.radius)
    for (const sp of SPIRES) assert.ok(Math.hypot(s.x - sp.x, s.z - sp.z) > 5)
  }
  assert.ok(EXPLORE_SITES.some((s) => s.kind === 'garden'))
  assert.deepEqual(buildExploreSites(), JSON.parse(JSON.stringify(EXPLORE_SITES)))
})

test('every other druse is an ember druse, at least one near the clearing', () => {
  const druses = EXPLORE_SITES.filter((s) => s.kind === 'druse')
  const ember = druses.filter((s) => s.outcrop.style === 'ember')
  assert.ok(ember.length >= Math.floor(druses.length / 2))
  assert.ok(ember.some((s) => Math.hypot(s.x, s.z) < 42))
})
