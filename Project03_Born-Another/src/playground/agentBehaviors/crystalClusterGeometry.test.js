import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createClusterShardGeometry,
  createMembraneTissueGeometry,
  createTransitionBladeGeometry,
  exp03Hash01,
  planCrystalCluster,
} from './crystalClusterGeometry.js'
import {
  createCrystalPolyhedronGeometry,
  estimateCrystalRadiusAt,
} from './crystalPolyhedronGeometry.js'

test('exp03Hash01 is deterministic in [0,1)', () => {
  const a = exp03Hash01(1, 2, 3)
  const b = exp03Hash01(1, 2, 3)
  assert.equal(a, b)
  assert.ok(a >= 0 && a < 1)
  assert.notEqual(exp03Hash01(1, 2, 4), a)
})

test('createCrystalPolyhedronGeometry builds convex planar facets', () => {
  const geo = createCrystalPolyhedronGeometry({
    sides: 6,
    aspect: 0.78,
    asymmetry: 0.45,
    tipStyle: 'pyramid',
    seed: 3,
  })
  assert.ok(geo.attributes.position.count >= 24)
  assert.ok(geo.attributes.normal)
  assert.equal(geo.attributes.normal.count, geo.attributes.position.count)
  geo.dispose()
})

test('createClusterShardGeometry delegates to polyhedron hull', () => {
  const geo = createClusterShardGeometry({
    sides: 5,
    aspect: 0.72,
    asymmetry: 0.5,
    tipStyle: 'chisel',
    seed: 9,
  })
  assert.ok(geo.attributes.position.count >= 24)
  geo.dispose()
})

test('estimateCrystalRadiusAt tapers toward tip', () => {
  const base = estimateCrystalRadiusAt(0.1, 0.2, 0.16)
  const tip = estimateCrystalRadiusAt(0.9, 0.2, 0.16)
  assert.ok(base > tip)
})

test('primary crystals stay volumetric rather than spike-like', () => {
  const site = {
    id: 1,
    direction: [0, 1, 0],
    roll: 0.1,
    scale: 1,
    crystal: {
      id: 1,
      length: 0.26,
      maxLength: 0.26,
      radius: 0.06,
      growthDirection: [0, 1, 0],
      direction: [0, 1, 0],
      branches: [],
    },
  }
  const plan = planCrystalCluster(site, {
    seed: 4,
    clusterDensity: 0.88,
    crystalOnly: true,
  })
  const primaries = plan.filter((p) => p.role === 'primary')
  assert.ok(primaries.length >= 2 && primaries.length <= 3)
  for (const p of primaries) {
    const ratio = p.length / p.width
    assert.ok(ratio >= 1.6 && ratio <= 2.8, `ratio ${ratio}`)
    assert.ok(typeof p.meshSeed === 'number')
  }
})

test('tissue and transition geometries still build meshes', () => {
  const tissue = createMembraneTissueGeometry({ seed: 2 })
  const blade = createTransitionBladeGeometry({ seed: 3 })
  assert.ok(tissue.attributes.position.count > 24)
  assert.ok(blade.attributes.position.count > 24)
  tissue.dispose()
  blade.dispose()
})

test('planCrystalCluster builds parent-child mineral hierarchy with micro carpet', () => {
  const site = {
    id: 2,
    direction: [0, 1, 0],
    roll: 0.2,
    scale: 1,
    crystal: {
      id: 2,
      length: 0.32,
      maxLength: 0.4,
      radius: 0.01,
      growthDirection: [0.1, 1, 0],
      direction: [0.1, 1, 0],
      branches: [],
    },
  }
  const crystals = planCrystalCluster(site, {
    seed: 7,
    clusterDensity: 0.88,
    branching: 0.78,
    crystalOnly: true,
  })
  assert.equal(crystals.filter((s) => s.role === 'tissue').length, 0)
  const primaries = crystals.filter((s) => s.role === 'primary')
  const secondaries = crystals.filter((s) => s.role === 'secondary')
  const tertiaries = crystals.filter((s) => s.role === 'tertiary')
  const micros = crystals.filter((s) => s.role === 'micro')
  assert.ok(primaries.length >= 2 && primaries.length <= 3)
  assert.ok(secondaries.length >= 3 && secondaries.length <= 7)
  assert.ok(tertiaries.length >= 2)
  assert.ok(micros.length >= 18)
  assert.ok(crystals.every((s) => s.kind === 'crystal'))

  const primaryIds = new Set(primaries.map((p) => p.id))
  for (const s of secondaries) {
    assert.ok(primaryIds.has(s.parentId))
    assert.equal(s.parentRole, 'primary')
    assert.ok(s.sideOffset != null)
    assert.ok(s.attachAlong != null)
  }

  const secondaryIds = new Set(secondaries.map((s) => s.id))
  for (const t of tertiaries) {
    assert.ok(secondaryIds.has(t.parentId))
    assert.equal(t.parentRole, 'secondary')
  }
})
