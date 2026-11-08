/**
 * World Final — camera presets (Y-up, roll 0). Each mode has a distinct
 * position, elevation and target. Presets are framed on the basin centre
 * from basinFrame, so they follow Basin Width / Asymmetry / Seed.
 */
import * as THREE from 'three'
import {
  normalizeWorldFinalConfig,
  WORLD_FINAL_CAMERA_FOV,
  WORLD_FINAL_CAMERA_START_R,
} from './config.js'
import { KEY_DIRECTION } from './atmosphere.js'
import { basinFrame, heightAt } from './heightField.js'
import { organismAnchor } from './organism/organismPlacement.js'

export const CAMERA_MODES = Object.freeze(['drift', 'explore', 'hero', 'observe', 'overview'])

const _cam = new THREE.PerspectiveCamera()
const _euler = new THREE.Euler(0, 0, 0, 'YXZ')

/** Yaw/pitch from lookAt with up = (0,1,0); roll discarded. */
export function yawPitchFromLookAt(position, target) {
  _cam.position.copy(position)
  _cam.up.set(0, 1, 0)
  _cam.lookAt(target.x, target.y, target.z)
  _euler.setFromQuaternion(_cam.quaternion, 'YXZ')
  return { yaw: _euler.y, pitch: _euler.x }
}

function poseFrom(position, target, label) {
  const { yaw, pitch } = yawPitchFromLookAt(position, target)
  return { position, target, yaw, pitch, label }
}

/** Fixed approach bearing (+X, slightly +Z) relative to the basin centre. */
const APPROACH = Object.freeze({ x: 0.83, z: 0.56 })

/**
 * Drift spawn: on the drift ring at hover height, looking toward the
 * basin floor.
 */
export function driftPose(config) {
  const cfg = normalizeWorldFinalConfig(config)
  const f = basinFrame(cfg)
  const r = cfg.basinRadius * WORLD_FINAL_CAMERA_START_R
  const x = f.cx + r
  const z = f.cz
  const position = new THREE.Vector3(x, heightAt(x, z, cfg) + cfg.hoverHeight, z)
  const tx = f.cx + r * 0.25
  const target = new THREE.Vector3(tx, heightAt(tx, z, cfg), z)
  return poseFrom(position, target, 'drift')
}

/**
 * Explore fixed: low on the near basin slope, looking across the valley
 * floor to the elevated far rim (foreground valley → mid ridges → far rim).
 */
export function explorePose(config) {
  const cfg = normalizeWorldFinalConfig(config)
  const f = basinFrame(cfg)
  const near = f.rimRadius * 0.62
  const x = f.cx + APPROACH.x * near
  const z = f.cz + APPROACH.z * near
  const position = new THREE.Vector3(x, heightAt(x, z, cfg) + 14, z)

  const far = f.rimRadius * 0.95
  const tx = f.cx - APPROACH.x * far
  const tz = f.cz - APPROACH.z * far
  /* Aim below the far rim crest so the valley floor fills the lower frame. */
  const rimY = heightAt(tx, tz, cfg)
  const floorY = heightAt(f.cx, f.cz, cfg)
  const target = new THREE.Vector3(tx, floorY + (rimY - floorY) * 0.35, tz)
  return poseFrom(position, target, 'explore')
}

/** The organism's resting anchor (cached per config with the poses). */
export function organismAnchorFor(config) {
  return organismAnchor(config, poseForMode('explore', config))
}

/** Observe-angle offset from the Explore bearing: side light + valley behind. */
const OBSERVE_BEARING = 0.5

/**
 * Observe organism: a little above the organism at ~3.4 body radii, from
 * the Explore side, so the valley and far rim sit behind it.
 */
export function observePose(config) {
  const cfg = normalizeWorldFinalConfig(config)
  const anchor = organismAnchorFor(cfg)
  const explore = poseForMode('explore', cfg)
  const back = Math.atan2(explore.position.z - anchor.z, explore.position.x - anchor.x)
  const bearing = back + OBSERVE_BEARING
  const dist = anchor.radius * 3.4
  const x = anchor.x + Math.cos(bearing) * dist
  const z = anchor.z + Math.sin(bearing) * dist
  const y = Math.max(anchor.y + anchor.radius * 0.25, heightAt(x, z, cfg) + cfg.hoverHeight)
  const target = new THREE.Vector3(anchor.x, anchor.y, anchor.z)
  return poseFrom(new THREE.Vector3(x, y, z), target, 'observe')
}

/** Projection used to fit the overview; matches the scene camera. */
export const OVERVIEW_FIT = Object.freeze({ fov: WORLD_FINAL_CAMERA_FOV, aspect: 16 / 9, ndc: 0.86 })

const _fitCam = new THREE.PerspectiveCamera(OVERVIEW_FIT.fov, OVERVIEW_FIT.aspect, 0.5, 5000)
const _p = new THREE.Vector3()

function rimExtentNdc(position, target, rimPoints) {
  const { yaw, pitch } = yawPitchFromLookAt(position, target)
  applyPoseToCamera(_fitCam, { position, yaw, pitch })
  _fitCam.updateProjectionMatrix()
  let max = 0
  for (const w of rimPoints) {
    _p.copy(w).project(_fitCam)
    if (_p.z >= 1) return Infinity
    max = Math.max(max, Math.abs(_p.x), Math.abs(_p.y))
  }
  return max
}

/**
 * Overview: high oblique view (~37° down) whose distance is fitted so the
 * whole rim fills ~86% of the frame for any basin width / depth / seed.
 */
export function overviewPose(config) {
  const cfg = normalizeWorldFinalConfig(config)
  const f = basinFrame(cfg)
  const floorY = heightAt(f.cx, f.cz, cfg)
  const target = new THREE.Vector3(f.cx, floorY, f.cz)
  const rimPoints = []
  for (let i = 0; i < 48; i += 1) {
    const t = (i / 48) * Math.PI * 2
    const x = f.cx + Math.cos(t) * f.rimRadius
    const z = f.cz + Math.sin(t) * f.rimRadius
    rimPoints.push(new THREE.Vector3(x, heightAt(x, z, cfg), z))
  }
  const at = (d) =>
    new THREE.Vector3(f.cx + APPROACH.x * d * 0.8, floorY + d * 0.6, f.cz + APPROACH.z * d * 0.8)

  let lo = f.rimRadius * 0.5
  let hi = f.rimRadius * 8
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2
    if (rimExtentNdc(at(mid), target, rimPoints) > OVERVIEW_FIT.ndc) lo = mid
    else hi = mid
  }
  return poseFrom(at(hi), target, 'overview')
}

/** Hero View lens (narrower than the default: compresses the far rim behind the subject). */
export const HERO_FOV = 40
/** Camera bearing from the key light's bearing: looking ~35° off the sun,
 *  which sits just outside the upper-left frame and back-lights the organism. */
const HERO_LIGHT_ANGLE = (145 * Math.PI) / 180
/** Organism just right of centre: clear of the intro text (left) and the panel (right). */
const HERO_NDC = Object.freeze({ x: 0.12, y: 0.04 })
const HERO_ASPECT = 16 / 9

/**
 * Hero View: one composed shot of the organism, about a quarter of the
 * frame high. Low over the near slope
 * (foreground seabed in the lower frame), looking slightly down across the
 * basin so ridges and the far rim — not empty water — sit behind the
 * organism and fade through the haze.
 */
export function heroPose(config) {
  const cfg = normalizeWorldFinalConfig(config)
  const anchor = organismAnchorFor(cfg)
  const lightBearing = Math.atan2(KEY_DIRECTION.z, KEY_DIRECTION.x)
  /* Of the two bearings, take the one that puts the sun on the left of frame:
     looking along f = -(cos b, sin b), screen-right is (-f.z, f.x). */
  const bearing = [lightBearing + HERO_LIGHT_ANGLE, lightBearing - HERO_LIGHT_ANGLE].find((b) => {
    const fx = -Math.cos(b)
    const fz = -Math.sin(b)
    return KEY_DIRECTION.x * -fz + KEY_DIRECTION.z * fx < 0
  })

  const dist = anchor.radius * 8.5
  const x = anchor.x + Math.cos(bearing) * dist
  const z = anchor.z + Math.sin(bearing) * dist
  const ground = heightAt(x, z, cfg)
  /* Low: near seabed fills the lower frame, ridges overlap behind the subject. */
  const y = Math.max(anchor.y + dist * Math.tan((3 * Math.PI) / 180), ground + cfg.hoverHeight + 2)
  const position = new THREE.Vector3(x, y, z)

  /* Aim off the organism so it sits at HERO_NDC (first-order, small angles). */
  const centre = new THREE.Vector3(anchor.x, anchor.y, anchor.z)
  const forward = centre.clone().sub(position).normalize()
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3().crossVectors(right, forward)
  const tanHalf = Math.tan(((HERO_FOV / 2) * Math.PI) / 180)
  const range = centre.distanceTo(position)
  const target = centre
    .clone()
    .addScaledVector(right, -HERO_NDC.x * tanHalf * HERO_ASPECT * range)
    .addScaledVector(up, -HERO_NDC.y * tanHalf * range)
  return { ...poseFrom(position, target, 'hero'), fov: HERO_FOV }
}

const POSE_BUILDERS = {
  drift: driftPose,
  explore: explorePose,
  observe: observePose,
  hero: heroPose,
  overview: overviewPose,
}
const poseCache = new WeakMap()

/**
 * Preset for a mode. Cached per (immutable) config object so the per-frame
 * call in fixed modes costs nothing until a terrain slider changes.
 */
export function poseForMode(mode, config) {
  const build = POSE_BUILDERS[mode] ?? driftPose
  if (!config || typeof config !== 'object') return build(config)
  let byMode = poseCache.get(config)
  if (!byMode) {
    byMode = new Map()
    poseCache.set(config, byMode)
  }
  let pose = byMode.get(mode)
  if (!pose) {
    pose = build(config)
    byMode.set(mode, pose)
  }
  return pose
}

export function applyPoseToCamera(camera, pose) {
  camera.up.set(0, 1, 0)
  camera.position.copy(pose.position)
  camera.rotation.order = 'YXZ'
  camera.rotation.set(pose.pitch, pose.yaw, 0)
  camera.updateMatrixWorld(true)
}
