import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { WORLD_FINAL_DEFAULTS } from './config.js'
import { applyPoseToCamera, OVERVIEW_FIT, poseForMode } from './cameraPoses.js'
import { basinFrame, heightAt } from './heightField.js'

function forward(pose) {
  const cam = new THREE.PerspectiveCamera()
  applyPoseToCamera(cam, pose)
  assert.deepEqual(cam.up.toArray(), [0, 1, 0])
  assert.ok(Math.abs(cam.rotation.z) < 1e-9, 'roll must be zero')
  const fwd = new THREE.Vector3()
  cam.getWorldDirection(fwd)
  return fwd
}

function clearance(pose) {
  return pose.position.y - heightAt(pose.position.x, pose.position.z, WORLD_FINAL_DEFAULTS)
}

test('drift spawns at hover height looking toward the nursery', () => {
  const pose = poseForMode('drift', WORLD_FINAL_DEFAULTS)
  assert.ok(Math.abs(clearance(pose) - WORLD_FINAL_DEFAULTS.hoverHeight) < 1e-6)
  const fwd = forward(pose)
  assert.ok(fwd.x < -0.9, `drift should face −X toward center, got ${fwd.toArray()}`)
})

test('explore fixed looks low across the basin centre to the far rim', () => {
  const pose = poseForMode('explore', WORLD_FINAL_DEFAULTS)
  const c = clearance(pose)
  assert.ok(c > 10 && c < 30, `explore clearance ${c}`)
  const fwd = forward(pose)
  assert.ok(fwd.y < 0 && fwd.y > -0.3, `explore pitch should be shallow, fy=${fwd.y}`)

  const f = basinFrame(WORLD_FINAL_DEFAULTS)
  const toCentre = new THREE.Vector2(f.cx - pose.position.x, f.cz - pose.position.z).normalize()
  const flat = new THREE.Vector2(fwd.x, fwd.z).normalize()
  assert.ok(flat.dot(toCentre) > 0.95, 'explore should look through the basin centre')

  const tgtFromCentre = Math.hypot(pose.target.x - f.cx, pose.target.z - f.cz)
  assert.ok(tgtFromCentre > f.rimRadius * 0.8, 'target should sit on the far rim side')
})

test('overview is a high oblique view of the whole disc', () => {
  const pose = poseForMode('overview', WORLD_FINAL_DEFAULTS)
  assert.ok(pose.position.y > WORLD_FINAL_DEFAULTS.basinRadius * 0.6)
  const fwd = forward(pose)
  assert.ok(fwd.y < -0.4 && fwd.y > -0.85, `overview should be oblique, fy=${fwd.y}`)
})

test('overview keeps the whole rim on screen for extreme basin settings', () => {
  for (const over of [
    {},
    { basinWidth: 0.45 },
    { basinWidth: 1.05, basinDepth: 120 },
    { basinAsymmetry: 1, seed: 31 },
  ]) {
    const cfg = { ...WORLD_FINAL_DEFAULTS, ...over }
    const pose = poseForMode('overview', cfg)
    const cam = new THREE.PerspectiveCamera(OVERVIEW_FIT.fov, OVERVIEW_FIT.aspect, 0.5, 5000)
    applyPoseToCamera(cam, pose)
    cam.updateProjectionMatrix()
    const f = basinFrame(cfg)
    let max = 0
    for (let i = 0; i < 64; i += 1) {
      const t = (i / 64) * Math.PI * 2
      const x = f.cx + Math.cos(t) * f.rimRadius
      const z = f.cz + Math.sin(t) * f.rimRadius
      const p = new THREE.Vector3(x, heightAt(x, z, cfg), z).project(cam)
      max = Math.max(max, Math.abs(p.x), Math.abs(p.y))
    }
    assert.ok(max < 0.95 && max > 0.6, `${JSON.stringify(over)} rim extent ${max}`)
  }
})

test('the three presets differ clearly in position, elevation and target', () => {
  const poses = ['drift', 'explore', 'overview'].map((m) =>
    poseForMode(m, WORLD_FINAL_DEFAULTS),
  )
  for (let i = 0; i < poses.length; i += 1) {
    for (let j = i + 1; j < poses.length; j += 1) {
      const a = poses[i]
      const b = poses[j]
      assert.ok(a.position.distanceTo(b.position) > 50, `${a.label}/${b.label} positions too close`)
      assert.ok(a.target.distanceTo(b.target) > 30, `${a.label}/${b.label} targets too close`)
    }
  }
  const [drift, explore, overview] = poses.map(clearance)
  assert.ok(drift < explore && explore < overview, 'elevation must rise drift → explore → overview')
})
