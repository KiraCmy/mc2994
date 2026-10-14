import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CRYSTAL_MIN_OUTWARD_DOT,
  crystalRootAndLength,
  ensureFacingDirection,
  secondaryFacingDirection,
  surfaceGrowthAxes,
} from './crystalOrientation.js'

test('ensureFacingDirection flips inward axes and enforces minimum outward dot', () => {
  const normal = [0, 1, 0]
  const flipped = ensureFacingDirection([0, -1, 0], normal)
  assert.ok(flipped[1] > 0.99)

  const shallow = ensureFacingDirection([1, 0.05, 0], normal, CRYSTAL_MIN_OUTWARD_DOT)
  const dot =
    shallow[0] * normal[0] + shallow[1] * normal[1] + shallow[2] * normal[2]
  assert.ok(dot >= CRYSTAL_MIN_OUTWARD_DOT - 1e-6)
})

test('surfaceGrowthAxes pair exterior outward with interior into the cavity', () => {
  const { exteriorAxis, interiorAxis, outwardNormal, inwardNormal } =
    surfaceGrowthAxes([0.2, 1, 0], [0, 1, 0])
  assert.ok(
    exteriorAxis[0] * outwardNormal[0] +
      exteriorAxis[1] * outwardNormal[1] +
      exteriorAxis[2] * outwardNormal[2] >
      0.7,
  )
  assert.equal(interiorAxis[0], -exteriorAxis[0])
  assert.equal(interiorAxis[1], -exteriorAxis[1])
  assert.equal(interiorAxis[2], -exteriorAxis[2])
  assert.ok(Math.abs(inwardNormal[0]) < 1e-12)
  assert.ok(inwardNormal[1] < -0.99)
  assert.ok(Math.abs(inwardNormal[2]) < 1e-12)
})

test('crystal roots seat along the facing normal, not a tilted growth axis', () => {
  const surface = [0, 2, 0]
  const { root, visualLength, facing } = crystalRootAndLength({
    surface,
    facingNormal: [0, 1, 0],
    growthAxis: [0.3, 1, 0],
    length: 0.2,
    embed: 0.08,
  })
  assert.ok(root[1] < surface[1])
  assert.ok(Math.abs(root[0] - surface[0]) < 1e-9)
  assert.ok(facing > 0.9)
  assert.ok(visualLength >= 0.2)
})

test('secondaryFacingDirection keeps children out of the membrane', () => {
  const parent = [0, 1, 0]
  const face = [0, 1, 0]
  const child = secondaryFacingDirection([0.9, 0.1, 0], parent, face, 0.35)
  const faceDot = child[0] * face[0] + child[1] * face[1] + child[2] * face[2]
  const parentDot =
    child[0] * parent[0] + child[1] * parent[1] + child[2] * parent[2]
  assert.ok(faceDot >= 0.35 - 1e-6)
  assert.ok(parentDot > 0)
})
