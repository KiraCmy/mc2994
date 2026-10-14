import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDissolveParticles,
  crystalDissolveProgress,
  crystalDissolves,
  dissolutionField,
} from './crystalDissolution.js'

test('dissolution field stays off until late AGE', () => {
  assert.equal(dissolutionField(0.5, 0), 0)
  assert.ok(dissolutionField(0.86, 0.05) > 0)
  assert.ok(dissolutionField(0.98, 1) > 0.9)
})

test('crystal dissolve selection is deterministic from seed + id', () => {
  const a = crystalDissolves(7319, 3)
  const b = crystalDissolves(7319, 3)
  const c = crystalDissolves(7319, 4)
  assert.equal(a, b)
  // Different ids usually diverge; if equal, progress still must be stable.
  assert.equal(crystalDissolveProgress(7319, 3, 0.95, 0.4), crystalDissolveProgress(7319, 3, 0.95, 0.4))
  assert.ok(typeof c === 'boolean')
})

test('only selected crystals gain dissolve progress', () => {
  const ids = Array.from({ length: 24 }, (_, index) => index)
  const dissolving = ids.filter((id) => crystalDissolves(7319, id))
  const remaining = ids.filter((id) => !crystalDissolves(7319, id))
  assert.ok(dissolving.length > 0)
  assert.ok(remaining.length > 0)
  for (const id of remaining) {
    assert.equal(crystalDissolveProgress(7319, id, 0.99, 1), 0)
  }
  for (const id of dissolving) {
    assert.ok(crystalDissolveProgress(7319, id, 0.99, 1) > 0.5)
  }
})

test('particle build is scrub-stable and quiet', () => {
  const emitters = [
    {
      id: 2,
      root: [0, 2, 0],
      axis: [0, 1, 0],
      length: 0.4,
      progress: crystalDissolveProgress(7319, 2, 0.94, 0.5),
    },
  ]
  if (emitters[0].progress <= 0) {
    emitters[0].id = Array.from({ length: 40 }, (_, i) => i).find((id) =>
      crystalDissolves(7319, id),
    )
    emitters[0].progress = crystalDissolveProgress(
      7319,
      emitters[0].id,
      0.94,
      0.5,
    )
  }
  const first = buildDissolveParticles(7319, 0.94, 0.5, emitters)
  const second = buildDissolveParticles(7319, 0.94, 0.5, emitters)
  assert.deepEqual(first.positions, second.positions)
  assert.ok(first.count > 0)
  assert.ok(first.count <= 18)
  const early = buildDissolveParticles(7319, 0.5, 0, emitters)
  assert.equal(early.count, 0)
  const death = buildDissolveParticles(7319, 1, 1, [
    { ...emitters[0], progress: 1 },
  ])
  assert.ok(death.count > 0)
  // Settled dust must remain visible at AGE = 1.
  let brightness = 0
  for (let i = 0; i < death.colors.length; i += 1) brightness += death.colors[i]
  assert.ok(brightness / death.colors.length > 0.15)
})
