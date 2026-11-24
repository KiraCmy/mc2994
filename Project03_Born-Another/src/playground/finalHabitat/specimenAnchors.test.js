import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { specimenAnchors, specimenBox } from './specimenAnchors.js'

/** A body: crystals on a unit sphere, a skin of sphere vertices, centre at 0. */
function makeBody() {
  const group = new THREE.Group()
  group.position.set(2, 0, 0)
  const dirs = [
    [-0.6, 0.6, 0.5],
    [0.6, -0.6, 0.5],
    [-0.6, 0.6, -0.5],
  ].map((d) => new THREE.Vector3(...d).normalize())
  const matrices = new Float32Array(16 * dirs.length)
  dirs.forEach((d, i) => new THREE.Matrix4().makeTranslation(d.x, d.y, d.z).toArray(matrices, i * 16))
  const crystals = { count: dirs.length, instanceMatrix: { array: matrices } }
  const sphere = new THREE.SphereGeometry(1, 24, 16)
  const n = sphere.attributes.position.count
  sphere.setAttribute('aCoilOffset', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  sphere.setAttribute('aFacetOffset', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  return { group, crystals, geo: sphere, coil: 1, facet: 0, center: [0, 0, 0] }
}

function makeCamera(angle = 0) {
  const cam = new THREE.PerspectiveCamera(34, 1, 0.05, 100)
  cam.position.set(2 + Math.sin(angle) * 8, 0, Math.cos(angle) * 8)
  cam.lookAt(2, 0, 0)
  cam.updateMatrixWorld()
  cam.updateProjectionMatrix()
  return cam
}

const toScreen = (camera) => (p) => {
  p.project(camera)
  return [(p.x * 0.5 + 0.5) * 1000, (-p.y * 0.5 + 0.5) * 1000]
}

test('mineral is a front, upper-left crystal; membrane on the right rim; core at the centre', () => {
  const ctx = makeBody()
  const cam = makeCamera()
  const state = {}
  const a = specimenAnchors(state, ctx, cam, 1, toScreen(cam), 0)
  assert.equal(state.mineral.kind, 'crystal')
  assert.equal(state.mineral.i, 0)
  assert.equal(state.membrane.kind, 'vertex')
  assert.ok(a.mineral[0] < 500 && a.mineral[1] < 500, `mineral ${a.mineral}`)
  assert.ok(a.membrane[0] > 540, `membrane ${a.membrane}`)
  assert.ok(Math.abs(a.core[0] - 500) < 1 && Math.abs(a.core[1] - 500) < 1)
})

test('the points stay on the same places while the view turns a little', () => {
  const ctx = makeBody()
  const state = {}
  const c0 = makeCamera(0)
  specimenAnchors(state, ctx, c0, 1, toScreen(c0), 0)
  const first = { ...state.mineral }
  const c1 = makeCamera(0.15)
  const a1 = specimenAnchors(state, ctx, c1, 1, toScreen(c1), 1)
  assert.deepEqual(state.mineral, first)
  /* And it moved on screen with the body (it is a real place, not a fixed spot). */
  const expect = new THREE.Vector3(-0.6, 0.6, 0.5).normalize().add(new THREE.Vector3(2, 0, 0))
  const [ex, ey] = toScreen(c1)(expect)
  assert.ok(Math.hypot(a1.mineral[0] - ex, a1.mineral[1] - ey) < 1e-3)
})

test('chooses again once the point has turned behind the body', () => {
  const ctx = makeBody()
  const state = {}
  const c0 = makeCamera(0)
  specimenAnchors(state, ctx, c0, 1, toScreen(c0), 0)
  const c1 = makeCamera(Math.PI)
  specimenAnchors(state, ctx, c1, 1, toScreen(c1), 5)
  assert.notEqual(state.mineral.i, 0)
})

test('follows the body when it moves', () => {
  const ctx = makeBody()
  const state = {}
  const cam = makeCamera()
  const a0 = specimenAnchors(state, ctx, cam, 1, toScreen(cam), 0)
  ctx.group.position.y -= 0.3
  const a1 = specimenAnchors(state, ctx, cam, 1, toScreen(cam), 0.1)
  assert.ok(a1.mineral[1] > a0.mineral[1] + 5)
})

test('the box hugs the geometry and is the same every frame', () => {
  const ctx = makeBody()
  const cam = makeCamera()
  const ndc = (x, y) => [(x * 0.5 + 0.5) * 1000, (-y * 0.5 + 0.5) * 1000]
  const b = specimenBox(ctx, cam, ndc)
  /* Unit sphere at distance 8, fov 34: radius on screen ≈ 1000/2 / (8·tan 17°) ≈ 204 px. */
  const expect = 500 / (Math.sqrt(64 - 1) * Math.tan((17 * Math.PI) / 180)) 
  assert.ok(Math.abs((b.x1 - b.x0) / 2 - expect) < expect * 0.06, `${(b.x1 - b.x0) / 2} vs ${expect}`)
  assert.ok(Math.abs((b.x0 + b.x1) / 2 - 500) < 2)
  assert.deepEqual(specimenBox(ctx, cam, ndc), b)
  /* A crystal sticking out widens it. */
  const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4)
  const m = new Float32Array(16)
  new THREE.Matrix4().makeTranslation(1.6, 0, 0).toArray(m, 0)
  ctx.crystals = { count: 1, geometry: geo, instanceMatrix: { array: m } }
  const wide = specimenBox(ctx, cam, ndc)
  assert.ok(wide.x1 > b.x1 + 40)
})
