/**
 * World Final — the only controller that writes the R3F default camera.
 *
 * Modes:
 *   drift    — spawns at driftPose, then WASD drift (Shift sprints), Q/E
 *              lower / raise, drag look. Height follows heightAt + hover +
 *              the Q/E elevation offset; soft rim boundary.
 *   explore  — fixed low-angle preset, re-applied every frame.
 *   hero     — composed shot of the organism (own 40° lens), re-applied every frame.
 *   observe  — fixed preset framed on the organism, re-applied every frame.
 *   overview — fixed high oblique preset, re-applied every frame.
 *
 * Mouse wheel zooms (field of view) in every mode.
 * Orientation is Y-up Euler YXZ with roll forced to 0.
 */
import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  normalizeWorldFinalConfig,
  WORLD_FINAL_CAMERA_FOV,
  WORLD_FINAL_ZONES,
} from './config.js'
import { applyPoseToCamera, poseForMode } from './cameraPoses.js'
import { heightAt } from './heightField.js'

const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _wish = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _dir = new THREE.Vector3()

const KEY_ACTIONS = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyE: 'rise',
  KeyQ: 'sink',
}
const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'number', 'email', 'password', 'url', 'tel'])

const ZOOM_FOV_MIN = 18
const ZOOM_FOV_MAX = 80
const SPRINT_MULTIPLIER = 2.5
const MIN_CLEARANCE = 0.8
const MAX_CLEARANCE = 320

function idleKeys() {
  return { forward: false, back: false, left: false, right: false, rise: false, sink: false, sprint: false }
}

/** Typing fields swallow all keys; sliders/checkboxes only keep their arrows. */
function keyBelongsToField(event) {
  const el = event.target
  const tag = el?.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return true
  if (tag !== 'INPUT') return false
  if (TEXT_INPUT_TYPES.has(el.type)) return true
  return ARROW_KEYS.has(event.code)
}

export default function DriftCamera({
  config,
  resetEpoch = 0,
  cameraMode = 'drift',
  onDebugSample = null,
  /** Called when the user moves / looks in a fixed mode → switch to drift. */
  onRequestDrift = null,
}) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const cfgRef = useRef(normalizeWorldFinalConfig(config))
  const modeRef = useRef(cameraMode)
  const sampleRef = useRef(onDebugSample)
  const requestDriftRef = useRef(onRequestDrift)
  /** Set when drift was entered from Explore by input: keep the current view. */
  const keepPoseRef = useRef(false)

  const keys = useRef(idleKeys())
  const dragging = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })
  const velocity = useRef(new THREE.Vector3())
  const yaw = useRef(0)
  const pitch = useRef(0)
  /** Extra height above hoverHeight, driven by Q / E. */
  const elevation = useRef(0)
  const fovTarget = useRef(WORLD_FINAL_CAMERA_FOV)
  const sampleAcc = useRef(0)

  /* Declared first so the pose effect below reads fresh values. */
  useLayoutEffect(() => {
    cfgRef.current = normalizeWorldFinalConfig(config)
    modeRef.current = cameraMode
    sampleRef.current = onDebugSample
    requestDriftRef.current = onRequestDrift
  }, [config, cameraMode, onDebugSample, onRequestDrift])

  /* Runs before paint on every mode switch / reset → no stale frame. */
  useLayoutEffect(() => {
    if (keepPoseRef.current && cameraMode === 'drift') {
      /* Continue from the Explore view at its current height. */
      keepPoseRef.current = false
      const cfg = cfgRef.current
      const ground = heightAt(camera.position.x, camera.position.z, cfg)
      elevation.current = camera.position.y - ground - cfg.hoverHeight
      return
    }
    keepPoseRef.current = false
    const pose = poseForMode(cameraMode, cfgRef.current)
    applyPoseToCamera(camera, pose)
    yaw.current = pose.yaw
    pitch.current = pose.pitch
    elevation.current = 0
    velocity.current.set(0, 0, 0)
    keys.current = idleKeys()
    dragging.current = false
  }, [camera, cameraMode, resetEpoch])

  /* Preset buttons and Reset camera also reset zoom (to the preset's own
     lens, if it has one). Input-driven switches to drift keep the zoom. */
  useLayoutEffect(() => {
    const fov = poseForMode(modeRef.current, cfgRef.current).fov ?? WORLD_FINAL_CAMERA_FOV
    fovTarget.current = fov
    camera.fov = fov
    camera.updateProjectionMatrix()
  }, [camera, resetEpoch])

  useLayoutEffect(() => {
    const el = gl.domElement
    el.tabIndex = 0

    /*
     * Movement or look input in a fixed preset switches to drift.
     * From Explore / Hero / Observe the current view is kept; Overview is too high to walk
     * from, so it drops to the drift spawn instead.
     */
    const enterDrift = () => {
      if (modeRef.current === 'drift') return true
      const request = requestDriftRef.current
      if (!request) return false
      keepPoseRef.current = modeRef.current !== 'overview'
      modeRef.current = 'drift'
      request()
      return true
    }

    const onKeyDown = (event) => {
      if (event.key === 'Shift') keys.current.sprint = true
      const action = KEY_ACTIONS[event.code]
      if (!action || keyBelongsToField(event)) return
      if (!enterDrift()) return
      event.preventDefault()
      keys.current[action] = true
    }
    const onKeyUp = (event) => {
      if (event.key === 'Shift') keys.current.sprint = false
      const action = KEY_ACTIONS[event.code]
      if (action) keys.current[action] = false
    }

    const onPointerDown = (event) => {
      if (event.button !== 0 || !enterDrift()) return
      dragging.current = true
      lastPointer.current = { x: event.clientX, y: event.clientY }
      el.setPointerCapture?.(event.pointerId)
      el.focus?.({ preventScroll: true })
    }
    const onPointerUp = (event) => {
      dragging.current = false
      try {
        el.releasePointerCapture?.(event.pointerId)
      } catch {
        /* ignore */
      }
    }
    const onPointerMove = (event) => {
      if (!dragging.current || modeRef.current !== 'drift') return
      const cfg = cfgRef.current
      const dx = event.clientX - lastPointer.current.x
      const dy = event.clientY - lastPointer.current.y
      lastPointer.current = { x: event.clientX, y: event.clientY }
      /* Finer look control when zoomed in. */
      const s = cfg.lookSensitivity * (camera.fov / WORLD_FINAL_CAMERA_FOV)
      yaw.current -= dx * s
      pitch.current -= dy * s
      pitch.current = Math.max(-1.15, Math.min(0.45, pitch.current))
    }
    const onWheel = (event) => {
      event.preventDefault()
      const step = Math.exp(event.deltaY * 0.0012)
      fovTarget.current = Math.min(ZOOM_FOV_MAX, Math.max(ZOOM_FOV_MIN, fovTarget.current * step))
    }
    const onBlur = () => {
      keys.current = idleKeys()
      dragging.current = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('blur', onBlur)
    }
  }, [camera, gl])

  useFrame((_, delta) => {
    const cfg = cfgRef.current
    const mode = modeRef.current
    const dt = Math.min(0.05, Math.max(0, delta))

    const fovEase = 1 - Math.exp(-dt * 10)
    if (Math.abs(camera.fov - fovTarget.current) > 0.01) {
      camera.fov += (fovTarget.current - camera.fov) * fovEase
      camera.updateProjectionMatrix()
    }

    if (mode !== 'drift') {
      /* Fixed presets follow terrain slider changes and cannot drift. */
      const pose = poseForMode(mode, cfg)
      applyPoseToCamera(camera, pose)
      yaw.current = pose.yaw
      pitch.current = pose.pitch
    } else {
      camera.up.set(0, 1, 0)
      camera.rotation.order = 'YXZ'
      camera.rotation.set(pitch.current, yaw.current, 0)

      _forward.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current))
      _right.crossVectors(_forward, _up).normalize()

      const k = keys.current
      const boost = k.sprint ? SPRINT_MULTIPLIER : 1
      _wish.set(0, 0, 0)
      if (k.forward) _wish.add(_forward)
      if (k.back) _wish.sub(_forward)
      if (k.right) _wish.add(_right)
      if (k.left) _wish.sub(_right)
      if (_wish.lengthSq() > 1e-8) _wish.normalize().multiplyScalar(cfg.maxSpeed * boost)
      _wish.y = ((k.rise ? 1 : 0) - (k.sink ? 1 : 0)) * cfg.verticalSpeed * boost

      const damp = Math.pow(cfg.damping, dt * 60)
      velocity.current.multiplyScalar(damp)
      velocity.current.addScaledVector(_wish.sub(velocity.current), 1 - damp)
      camera.position.x += velocity.current.x * dt
      camera.position.z += velocity.current.z * dt

      const limit = cfg.basinRadius * WORLD_FINAL_ZONES.boundary
      const planar = Math.hypot(camera.position.x, camera.position.z)
      if (planar > limit && planar > 1e-6) {
        const push = (planar - limit) / planar
        camera.position.x *= 1 - push * 0.35
        camera.position.z *= 1 - push * 0.35
        velocity.current.x *= 0.5
        velocity.current.z *= 0.5
      }

      const minOffset = MIN_CLEARANCE - cfg.hoverHeight
      const maxOffset = MAX_CLEARANCE - cfg.hoverHeight
      elevation.current += velocity.current.y * dt
      if (elevation.current < minOffset || elevation.current > maxOffset) {
        elevation.current = Math.min(maxOffset, Math.max(minOffset, elevation.current))
        velocity.current.y = 0
      }

      const ground = heightAt(camera.position.x, camera.position.z, cfg)
      const targetY = ground + cfg.hoverHeight + elevation.current
      camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 6)
      /* Never below the seabed, even mid-ease. */
      camera.position.y = Math.max(camera.position.y, ground + MIN_CLEARANCE)
      camera.updateMatrixWorld(true)
    }

    const report = sampleRef.current
    if (report) {
      sampleAcc.current += dt
      if (sampleAcc.current >= 0.12) {
        sampleAcc.current = 0
        camera.getWorldDirection(_dir)
        report({
          mode,
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
          rotX: camera.rotation.x,
          rotY: camera.rotation.y,
          rotZ: camera.rotation.z,
          fwdX: _dir.x,
          fwdY: _dir.y,
          fwdZ: _dir.z,
          fov: camera.fov,
          groundY: heightAt(camera.position.x, camera.position.z, cfg),
        })
      }
    }
  })

  return null
}
