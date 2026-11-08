import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { normalizeWorldFinalConfig, WORLD_FINAL_DEFAULTS } from '../config.js'
import { KEY_DIRECTION } from '../atmosphere.js'
import { applyPoseToCamera, HERO_FOV, organismAnchorFor, poseForMode } from '../cameraPoses.js'
import { advanceCurrent, createCurrentField, createCurrentState } from '../currentField.js'
import { heightAt } from '../heightField.js'
import { FLOAT_LIMIT, organismFloat, organismHover } from './organismPlacement.js'

const VARIANTS = [
  {},
  { organismScale: 3 },
  { organismScale: 8 },
  { seed: 31, basinAsymmetry: 1 },
  { basinDepth: 120, ridgeHeight: 18 },
  { basinWidth: 0.45 },
]

test('anchor clears the seabed under the whole footprint', () => {
  for (const over of VARIANTS) {
    const cfg = normalizeWorldFinalConfig({ ...WORLD_FINAL_DEFAULTS, ...over })
    const a = organismAnchorFor(cfg)
    const bottom = a.y - a.radius
    for (let i = 0; i < 64; i += 1) {
      const t = (i / 64) * Math.PI * 2
      for (const r of [0, 0.5, 1]) {
        const g = heightAt(a.x + Math.cos(t) * a.radius * r, a.z + Math.sin(t) * a.radius * r, cfg)
        /* Footprint is sampled on two rings; allow sub-sample terrain variation. */
        assert.ok(bottom - g >= organismHover(cfg) - 0.2, `${JSON.stringify(over)} clips seabed`)
      }
    }
    const gap = a.y - a.radius - a.ground
    assert.ok(gap <= organismHover(cfg) + a.radius + 1e-6, `${JSON.stringify(over)} floats too high (${gap})`)
  }
})

test('anchor is a midground subject inside the Explore view', () => {
  const cfg = normalizeWorldFinalConfig(WORLD_FINAL_DEFAULTS)
  const pose = poseForMode('explore', cfg)
  const a = organismAnchorFor(cfg)
  const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.35, 5000)
  applyPoseToCamera(cam, pose)
  cam.updateProjectionMatrix()
  const ndc = new THREE.Vector3(a.x, a.y, a.z).project(cam)
  assert.ok(Math.abs(ndc.x) < 0.4 && ndc.y < 0 && ndc.y > -0.4 && ndc.z < 1, `ndc ${ndc.toArray()}`)
  const dist = pose.position.distanceTo(new THREE.Vector3(a.x, a.y, a.z))
  assert.ok(dist > 60 && dist < 95, `distance ${dist}`)
})

test('observe frames the organism closely from above the seabed', () => {
  for (const over of VARIANTS) {
    const cfg = normalizeWorldFinalConfig({ ...WORLD_FINAL_DEFAULTS, ...over })
    const pose = poseForMode('observe', cfg)
    const a = organismAnchorFor(cfg)
    const dist = pose.position.distanceTo(new THREE.Vector3(a.x, a.y, a.z))
    assert.ok(dist > a.radius * 3 && dist < a.radius * 4, `${JSON.stringify(over)} distance ${dist}`)
    assert.ok(pose.position.y > heightAt(pose.position.x, pose.position.z, cfg) + 1)
    const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.35, 5000)
    applyPoseToCamera(cam, pose)
    const ndc = new THREE.Vector3(a.x, a.y, a.z).project(cam)
    assert.ok(Math.hypot(ndc.x, ndc.y) < 0.05, 'organism centred')
  }
})

test('hero view: back-lit, sun on the left, organism right of centre, seabed under the camera', () => {
  for (const over of VARIANTS) {
    const cfg = normalizeWorldFinalConfig({ ...WORLD_FINAL_DEFAULTS, ...over })
    const pose = poseForMode('hero', cfg)
    const a = organismAnchorFor(cfg)
    const centre = new THREE.Vector3(a.x, a.y, a.z)
    const label = JSON.stringify(over)
    assert.equal(pose.fov, HERO_FOV)
    assert.ok(pose.position.y > heightAt(pose.position.x, pose.position.z, cfg) + 1, `${label} above seabed`)
    const cam = new THREE.PerspectiveCamera(pose.fov, 16 / 9, 0.35, 5000)
    applyPoseToCamera(cam, pose)
    cam.updateMatrixWorld(true)
    const ndc = centre.clone().project(cam)
    assert.ok(ndc.x > 0.05 && ndc.x < 0.2, `${label} ndc.x ${ndc.x}`)
    assert.ok(ndc.y > -0.05 && ndc.y < 0.15, `${label} ndc.y ${ndc.y}`)
    /* Key light comes from beside / behind the organism, not over the lens. */
    const toCam = pose.position.clone().sub(centre).setY(0).normalize()
    const key = new THREE.Vector3(KEY_DIRECTION.x, 0, KEY_DIRECTION.z).normalize()
    assert.ok(toCam.dot(key) < -0.5, `${label} back-lit`)
    const sunNdc = cam.position.clone().add(KEY_DIRECTION.clone().multiplyScalar(1000)).project(cam)
    assert.ok(sunNdc.x < -0.8, `${label} sun left of frame (ndc.x ${sunNdc.x})`)
    /* Looking slightly down so the basin, not open water, backs the organism. */
    assert.ok(pose.pitch < 0 && pose.pitch > -0.35, `${label} pitch ${pose.pitch}`)
  }
})

function simulate(strength, seconds, { currentStrength = 1, currentSpeed = 0.7 } = {}) {
  const cfg = normalizeWorldFinalConfig(WORLD_FINAL_DEFAULTS)
  const anchor = organismAnchorFor(cfg)
  const field = createCurrentField()
  const state = createCurrentState()
  const samples = []
  const dt = 1 / 30
  for (let i = 0; i * dt < seconds; i += 1) {
    advanceCurrent(state, dt, { currentStrength, currentSpeed })
    const f = organismFloat(field, state, anchor, i * dt, strength)
    samples.push({ offset: [...f.offset], tilt: [...f.tilt] })
  }
  return samples
}

test('float sway is bounded, slow and continuous', () => {
  for (const currentStrength of [1, 3]) {
    const samples = simulate(1, 300, { currentStrength, currentSpeed: 3 })
    let maxMag = 0
    let maxStep = 0
    let maxTilt = 0
    for (let i = 0; i < samples.length; i += 1) {
      const o = samples[i].offset
      maxMag = Math.max(maxMag, Math.hypot(...o))
      maxTilt = Math.max(maxTilt, ...samples[i].tilt.map(Math.abs))
      if (i > 0) {
        const p = samples[i - 1].offset
        maxStep = Math.max(maxStep, Math.hypot(o[0] - p[0], o[1] - p[1], o[2] - p[2]))
      }
    }
    assert.ok(maxMag <= FLOAT_LIMIT + 0.36, `sway ${maxMag}`)
    /* ≤ ~2 u/s even at Current strength 3 × speed 3 (before the component's easing). */
    assert.ok(maxStep < 0.07, `per-frame step ${maxStep}`)
    assert.ok(maxTilt <= 0.1 + 1e-9, `tilt ${maxTilt}`)
  }
  const calm = simulate(1, 120)
  const spread = Math.max(...calm.map((s) => Math.hypot(s.offset[0], s.offset[2])))
  assert.ok(spread > 0.15, `the current should visibly move it, spread ${spread}`)
})

test('float strength 0 holds the organism still', () => {
  for (const s of simulate(0, 30)) {
    assert.deepEqual(s.offset.map((v) => Math.abs(v)), [0, 0, 0])
    assert.deepEqual(s.tilt.map((v) => Math.abs(v)), [0, 0])
  }
})
