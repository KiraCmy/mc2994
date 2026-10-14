import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import {
  CRYSTAL_MAX_ASPECT,
  CRYSTAL_MIN_ASPECT,
  countDegenerateCrystalFaces,
  createPrimaryCrystalGeometry,
  primaryCrystalRenderMetrics,
} from './primaryCrystalGeometry.js'
import { createWorldGeometry, disposeWorldGeometry } from './worldGeometry.js'
import {
  applyLifeToWorld,
  captureWorldRestState,
  deformRadialPoint,
  formMorphAmount,
  morphRestPoint,
  ORGANISM_BIRTH_RADIUS,
} from './life/worldLifeAdapter.js'
import {
  addLifeStimulus,
  createLifeState,
  runLifeSteps,
} from './life/lifeEngine.js'

function vertexKey(position, index) {
  const x = position.getX(index)
  const y = position.getY(index)
  const z = position.getZ(index)
  return `${(x === 0 ? 0 : x).toFixed(6)},${(y === 0 ? 0 : y).toFixed(6)},${(z === 0 ? 0 : z).toFixed(6)}`
}

function inspectHull(geometry) {
  const position = geometry.attributes.position
  const centroid = new THREE.Vector3()
  for (let index = 0; index < position.count; index += 1) {
    centroid.add(new THREE.Vector3().fromBufferAttribute(position, index))
  }
  centroid.divideScalar(position.count)
  const edges = new Map()
  let flipped = 0
  for (let index = 0; index < position.count; index += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, index)
    const b = new THREE.Vector3().fromBufferAttribute(position, index + 1)
    const c = new THREE.Vector3().fromBufferAttribute(position, index + 2)
    const normal = new THREE.Vector3()
      .crossVectors(b.clone().sub(a), c.clone().sub(a))
      .normalize()
    const mid = a.add(b).add(c).divideScalar(3)
    if (normal.dot(mid.sub(centroid)) < 0) flipped += 1
    const keys = [
      vertexKey(position, index),
      vertexKey(position, index + 1),
      vertexKey(position, index + 2),
    ]
    for (const pair of [
      [keys[0], keys[1]],
      [keys[1], keys[2]],
      [keys[2], keys[0]],
    ]) {
      const edge = pair[0] < pair[1] ? pair.join('|') : `${pair[1]}|${pair[0]}`
      edges.set(edge, (edges.get(edge) || 0) + 1)
    }
  }
  return {
    degenerate: countDegenerateCrystalFaces(geometry),
    flipped,
    boundary: [...edges.values()].filter((count) => count === 1).length,
  }
}

test('primary crystal geometry is a closed volumetric prism', () => {
  const geometry = createPrimaryCrystalGeometry({
    sides: 6,
    taper: 0.16,
  })
  const position = geometry.attributes.position
  assert.equal(position.count % 3, 0)
  assert.ok(position.count >= 6 * 8)
  geometry.computeBoundingBox()
  const { min, max } = geometry.boundingBox
  assert.ok(Math.abs(min.y) < 1e-6)
  assert.ok(Math.abs(max.y - 1) < 1e-6)
  assert.ok(max.x - min.x > 1.5)
  assert.ok(max.z - min.z > 1.5)
  const normals = geometry.attributes.normal
  for (let index = 0; index < normals.count; index += 1) {
    const length = Math.hypot(
      normals.getX(index),
      normals.getY(index),
      normals.getZ(index),
    )
    assert.ok(length > 0.5)
  }
  const hull = inspectHull(geometry)
  assert.equal(hull.degenerate, 0)
  assert.equal(hull.flipped, 0)
  assert.equal(hull.boundary, 0)
  geometry.dispose()
})

test('early baked crystal growth keeps valid triangles', () => {
  const world = createWorldGeometry(7319)
  const rest = captureWorldRestState(world)
  applyLifeToWorld(world, rest, createLifeState({ seed: 7319 }))
  assert.equal(countDegenerateCrystalFaces(world.outside), 0)
  assert.equal(countDegenerateCrystalFaces(world.inside), 0)
  disposeWorldGeometry(world)
})

test('early growth morphs from a small sphere toward the mature form', () => {
  const mature = [0, 2.4, 0]
  const birth = morphRestPoint(...mature, 0)
  const grown = morphRestPoint(...mature, 1)
  assert.ok(Math.abs(Math.hypot(...birth) - ORGANISM_BIRTH_RADIUS) < 1e-9)
  assert.ok(Math.abs(Math.hypot(...grown) - 2.4) < 1e-9)
  assert.ok(formMorphAmount(0) < 0.05)
  assert.ok(formMorphAmount(1) > 0.95)

  const world = createWorldGeometry(7319)
  const rest = captureWorldRestState(world)
  const newborn = createLifeState({ seed: 7319 })
  applyLifeToWorld(world, rest, newborn)
  const positions = world.surface.attributes.position.array
  let minR = Infinity
  let maxR = 0
  for (let i = 0; i < positions.length; i += 3) {
    const radius = Math.hypot(positions[i], positions[i + 1], positions[i + 2])
    minR = Math.min(minR, radius)
    maxR = Math.max(maxR, radius)
  }
  assert.ok(maxR - minR < 0.08, 'newborn body should be nearly spherical')
  assert.ok(maxR < ORGANISM_BIRTH_RADIUS + 0.05)
  const birthColors = world.surface.attributes.color.array
  let colorSpread = 0
  for (let i = 0; i < birthColors.length; i += 3) {
    colorSpread = Math.max(
      colorSpread,
      Math.abs(birthColors[i] - birthColors[0]),
      Math.abs(birthColors[i + 1] - birthColors[1]),
      Math.abs(birthColors[i + 2] - birthColors[2]),
    )
  }
  assert.ok(colorSpread < 0.02, 'newborn surface color should be uniform')

  const matureLife = runLifeSteps(createLifeState({ seed: 7319 }), 900)
  applyLifeToWorld(world, rest, matureLife)
  let matureMin = Infinity
  let matureMax = 0
  const grownPos = world.surface.attributes.position.array
  for (let i = 0; i < grownPos.length; i += 3) {
    const radius = Math.hypot(grownPos[i], grownPos[i + 1], grownPos[i + 2])
    matureMin = Math.min(matureMin, radius)
    matureMax = Math.max(matureMax, radius)
  }
  assert.ok(matureMax - matureMin > 0.35, 'mature body should be differentiated')
  assert.ok(matureMax > maxR + 0.4)
  disposeWorldGeometry(world)
})

test('baked crystals ride the same radial deformation as the membrane', () => {
  const world = createWorldGeometry(7319)
  const rest = captureWorldRestState(world)
  // Reach a grown morph so crystal roots sit on the mature body.
  let life = runLifeSteps(createLifeState({ seed: 7319 }), 900)
  applyLifeToWorld(world, rest, life)

  const origin = rest.outside.origins
  let sample = 0
  let best = -2
  for (let i = 0; i < origin.length; i += 3) {
    const radius = Math.hypot(origin[i], origin[i + 1], origin[i + 2]) || 1
    const score = origin[i + 1] / radius
    if (score > best) {
      best = score
      sample = i
    }
  }

  const restOriginR = Math.hypot(
    origin[sample],
    origin[sample + 1],
    origin[sample + 2],
  )
  const sampleDir = [
    origin[sample] / restOriginR,
    origin[sample + 1] / restOriginR,
    origin[sample + 2] / restOriginR,
  ]
  const morph = formMorphAmount(life.variables.growth)
  const beforeRoot = Math.hypot(
    ...morphRestPoint(origin[sample], origin[sample + 1], origin[sample + 2], morph),
  )
  const beforeLive = Math.hypot(
    world.outside.attributes.position.array[sample],
    world.outside.attributes.position.array[sample + 1],
    world.outside.attributes.position.array[sample + 2],
  )

  life = addLifeStimulus(life, sampleDir)
  life = runLifeSteps(life, 90)
  applyLifeToWorld(world, rest, life)

  const afterMorph = formMorphAmount(life.variables.growth)
  const shaped = morphRestPoint(
    origin[sample],
    origin[sample + 1],
    origin[sample + 2],
    afterMorph,
  )
  const deformedRoot = deformRadialPoint(
    shaped[0],
    shaped[1],
    shaped[2],
    life.outputs.form.localDeformations,
  )
  const afterRoot = Math.hypot(...deformedRoot)
  const liveVertex = Math.hypot(
    world.outside.attributes.position.array[sample],
    world.outside.attributes.position.array[sample + 1],
    world.outside.attributes.position.array[sample + 2],
  )

  const surface = world.surface.attributes.position.array
  let membraneRadius = 0
  let membraneBest = -2
  for (let i = 0; i < surface.length; i += 3) {
    const radius = Math.hypot(surface[i], surface[i + 1], surface[i + 2]) || 1
    const dot =
      (surface[i] * sampleDir[0] +
        surface[i + 1] * sampleDir[1] +
        surface[i + 2] * sampleDir[2]) /
      radius
    if (dot > membraneBest) {
      membraneBest = dot
      membraneRadius = radius
    }
  }

  assert.ok(afterRoot - beforeRoot > 0.05, 'root must move with stimulus')
  assert.ok(liveVertex - beforeLive > 0.02, 'baked mesh must follow expansion')
  assert.ok(
    membraneRadius - afterRoot < 0.12,
    `membrane must not overtake root (gap ${membraneRadius - afterRoot})`,
  )
  assert.ok(
    afterRoot <= membraneRadius + 1e-6,
    'root remains at or under the membrane',
  )
  disposeWorldGeometry(world)
})

test('render metrics prevent needle and pancake proportions', () => {
  const needle = primaryCrystalRenderMetrics(
    { length: 0.5, radius: 0.001 },
    { id: 0, scale: 1 },
  )
  const squat = primaryCrystalRenderMetrics(
    { length: 0.2, radius: 0.2 },
    { id: 1, scale: 1 },
  )
  const typical = primaryCrystalRenderMetrics(
    { length: 0.36, radius: 0.05 },
    { id: 2, scale: 0.9 },
  )
  assert.ok(needle.length / needle.width <= CRYSTAL_MAX_ASPECT + 1e-6)
  assert.ok(squat.length / squat.width >= CRYSTAL_MIN_ASPECT - 1e-6)
  assert.ok(typical.length / typical.width >= CRYSTAL_MIN_ASPECT)
  assert.ok(typical.length / typical.width <= CRYSTAL_MAX_ASPECT)
  assert.ok(typical.depth / typical.width >= 0.85)
})
