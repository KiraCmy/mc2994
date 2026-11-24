import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { habitatHeight } from './habitatField.js'
import { deathPhases } from './habitatFossil.js'
import {
  descentPose,
  DESCENT_SECONDS,
  easeInOut,
  entranceCue,
  explorePose,
  FOCUS_SECONDS,
  focusPose,
  openingHaze,
  SURFACE_HEIGHT,
} from './worldOpening.js'
import { surfaceFragment, surfaceVertex } from './worldShaders.js'
import { distanceForRadius, specimenRadius, specimenRegion } from './specimenFrame.js'

/*
 * World Final opening experience, inside the existing habitat canvas:
 *  - DescentCamera: sink from the lit surface to the exploration pose
 *    (skippable), then hand the camera to the orbit / explore controls;
 *  - FocusRig: glide to an observation pose around the chosen life and keep
 *    following it while it drifts (focus is not control: nothing is paused);
 *  - WitnessClock: which death the world is witnessing (the focused life);
 *  - WaterSurface: the bright, rippling ceiling of the water.
 * All per-frame state lives in refs (`world.current`); React only hears phase
 * and focus changes.
 */

const SKIP_SECONDS = 1.4

function writeEntrance(root, cue) {
  if (!root) return
  const phrases = cue?.phrases ?? [0, 0, 0]
  root.style.setProperty('--exp07-night', (cue?.night ?? 0).toFixed(3))
  root.style.setProperty('--exp07-veil', (cue?.veil ?? 0).toFixed(3))
  root.style.setProperty('--exp07-p0', (phrases[0] ?? 0).toFixed(3))
  root.style.setProperty('--exp07-p1', (phrases[1] ?? 0).toFixed(3))
  root.style.setProperty('--exp07-p2', (phrases[2] ?? 0).toFixed(3))
}

export function DescentCamera({ world, groundY, overlayRef = null }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const tmp = useMemo(() => ({ target: new THREE.Vector3(), from: new THREE.Vector3(), fromTarget: new THREE.Vector3(), end: new THREE.Vector3(), endTarget: new THREE.Vector3() }), [])

  useFrame((_, delta) => {
    const w = world.current
    const o = w.opening
    const dt = Math.min(0.1, delta)
    const root = overlayRef?.current?.parentElement
    const clear = { night: 0, veil: 0, phrases: [0, 0, 0] }
    if (w.phase !== 'descent') {
      o.t += dt
      o.haze = openingHaze(o.t)
      o.depth = 0
      o.veil = 0
      writeEntrance(root, clear)
      return
    }
    if (controls) controls.enabled = false
    const end = explorePose(groundY)
    let done = false
    let cue = entranceCue(0)
    /* Reduced motion: no long glide and no lines — arrive on the first frame. */
    if (o.reduced) {
      o.t = DESCENT_SECONDS
      o.depth = 0
      o.veil = 0
      o.haze = 1
      camera.position.set(...end.position)
      if (controls) {
        controls.target.set(...end.target)
        controls.enabled = true
        controls.update()
      }
      writeEntrance(root, clear)
      w.phase = 'explore'
      w.onPhase?.('explore')
      return
    }
    if (o.skip) {
      if (!o.skipping) {
        o.skipping = { t: 0 }
        tmp.from.copy(camera.position)
        camera.getWorldDirection(tmp.fromTarget).multiplyScalar(12).add(camera.position)
      }
      o.skipping.t += dt
      const e = easeInOut(o.skipping.t / SKIP_SECONDS)
      tmp.end.set(...end.position)
      tmp.endTarget.set(...end.target)
      camera.position.lerpVectors(tmp.from, tmp.end, e)
      tmp.target.lerpVectors(tmp.fromTarget, tmp.endTarget, e)
      camera.lookAt(tmp.target)
      o.depth *= 1 - e
      const at = entranceCue(o.t)
      const k = 1 - e
      cue = { night: at.night * k, veil: at.veil * k, phrases: [0, 0, 0] }
      done = o.skipping.t >= SKIP_SECONDS
    } else {
      o.t += dt
      const pose = descentPose(o.t, groundY)
      camera.position.set(...pose.position)
      tmp.target.set(...pose.target)
      camera.lookAt(tmp.target)
      o.depth = pose.depth
      cue = entranceCue(o.t)
      done = o.t >= DESCENT_SECONDS
    }
    o.veil = cue.veil
    o.haze = 1
    writeEntrance(root, cue)
    if (done) {
      /* Hand over: the orbit target sits on the gaze, controls take over.
         The entrance veil is already gone; the habitat tone is its own. */
      o.t = DESCENT_SECONDS
      o.depth = 0
      o.veil = 0
      writeEntrance(root, clear)
      camera.position.set(...end.position)
      if (controls) {
        controls.target.set(...end.target)
        controls.enabled = true
        controls.update()
      }
      w.phase = 'explore'
      w.onPhase?.('explore')
    }
  })
  return null
}

/** The archive sheet's panels, relative to the scene (null when absent). */
function readSheetLayout(root) {
  const base = root.getBoundingClientRect()
  const rel = (selector) => {
    const el = root.querySelector(selector)
    if (!el) return null
    const b = el.getBoundingClientRect()
    if (!b.width || !b.height) return null
    return { left: b.left - base.left, top: b.top - base.top, right: b.right - base.left, bottom: b.bottom - base.top }
  }
  const hint = rel('.exp07-reveal__hint')
  return { card: rel('.exp07-reveal__left'), record: rel('.exp07-reveal__record'), bottom: hint ? hint.top - 12 : null }
}

export function FocusRig({ world, overlayRef }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const size = useThree((s) => s.size)
  const rig = useRef({ id: null, t: 0, moving: false, spec: null, ox: 0, oy: 0, layout: null, layoutAt: -1 })
  const tmp = useMemo(
    () => ({
      fromPos: new THREE.Vector3(),
      fromTarget: new THREE.Vector3(),
      centre: new THREE.Vector3(),
      last: new THREE.Vector3(),
      pos: new THREE.Vector3(),
      step: new THREE.Vector3(),
      right: new THREE.Vector3(),
      p: new THREE.Vector3(),
    }),
    [],
  )

  useEffect(() => () => {
    const root = overlayRef?.current?.parentElement
    root?.style.setProperty('--exp07-fo', '0')
    camera.clearViewOffset()
  }, [overlayRef, camera])

  useFrame((state, delta) => {
    const w = world.current
    const r = rig.current
    const root = overlayRef?.current?.parentElement
    const id = w.phase === 'descent' ? null : w.focusId
    /* Leaving the archive sheet: give the viewer their zoom back and ease
       the picture back to the middle of the screen. */
    if (r.spec && !(id && w.specimen === id)) {
      if (controls) {
        controls.minDistance = r.spec.minDistance
        controls.maxDistance = r.spec.maxDistance
        controls.enableZoom = r.spec.enableZoom
      }
      r.spec = null
    }
    if (!r.spec && (r.ox || r.oy)) {
      const k = 1 - Math.exp(-Math.min(0.1, delta) * 2.4)
      r.ox -= r.ox * k
      r.oy -= r.oy * k
      if (Math.abs(r.ox) < 0.5 && Math.abs(r.oy) < 0.5) {
        r.ox = 0
        r.oy = 0
        camera.clearViewOffset()
      } else camera.setViewOffset(size.width, size.height, -r.ox, -r.oy, size.width, size.height)
    }
    if (id !== r.id) {
      r.id = id
      if (id) {
        r.t = 0
        r.moving = true
        tmp.fromPos.copy(camera.position)
        tmp.fromTarget.copy(controls?.target ?? tmp.centre)
        if (controls) controls.enabled = false
      } else if (controls) {
        controls.minDistance = 1.5
        controls.maxDistance = 40
        controls.enabled = true
      }
    }
    if (!id) {
      root?.style.setProperty('--exp07-fo', '0')
      return
    }
    const body = w.bodies.get(id)
    if (!body) return
    tmp.centre.set(body.x, body.y, body.z)
    if (r.moving) {
      r.t += Math.min(0.1, delta)
      const e = easeInOut(r.t / FOCUS_SECONDS)
      const pose = focusPose([body.x, body.y, body.z], body.r, tmp.fromPos.toArray(), habitatHeight)
      tmp.pos.set(...pose.position)
      camera.position.lerpVectors(tmp.fromPos, tmp.pos, e)
      const floor = habitatHeight(camera.position.x, camera.position.z) + 0.8
      if (camera.position.y < floor) camera.position.y = floor
      if (controls) {
        controls.target.lerpVectors(tmp.fromTarget, tmp.centre, e)
        camera.lookAt(controls.target)
      }
      if (r.t >= FOCUS_SECONDS) {
        r.moving = false
        tmp.last.copy(tmp.centre)
        if (controls) {
          controls.target.copy(tmp.centre)
          controls.minDistance = Math.max(1.5, body.r * 1.8)
          controls.maxDistance = 18
          controls.enabled = true
          controls.update()
        }
      }
    } else if (tmp.step.copy(tmp.centre).sub(tmp.last).length() > 2.5) {
      /* The life was born again somewhere else: glide there, don't jump. */
      r.t = 0
      r.moving = true
      tmp.fromPos.copy(camera.position)
      tmp.fromTarget.copy(controls?.target ?? tmp.last)
      if (controls) controls.enabled = false
    } else {
      /* Follow the life as it drifts; the viewer keeps orbit and zoom. */
      tmp.step.copy(tmp.centre).sub(tmp.last)
      tmp.last.copy(tmp.centre)
      camera.position.add(tmp.step)
      controls?.target.add(tmp.step)
    }
    /* The archive sheet: the remains step back to about 58% of their size
       and sit in the middle of the free stage between the panels, with room
       for the callouts. The viewer can still turn them (orbit), not zoom. */
    if (!r.moving && w.specimen === id) {
      const projectedR = () => {
        tmp.p.copy(tmp.centre).project(camera)
        tmp.right.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(body.r).add(tmp.centre).project(camera)
        return Math.abs(tmp.right.x - tmp.p.x) * 0.5 * size.width
      }
      if (!r.spec) {
        r.spec = {
          start: projectedR(),
          minDistance: controls?.minDistance ?? 1.5,
          maxDistance: controls?.maxDistance ?? 18,
          enableZoom: controls?.enableZoom ?? true,
        }
        r.layoutAt = -1
      }
      const now = state.clock.elapsedTime
      if (root && (r.layoutAt < 0 || now - r.layoutAt > 0.25)) {
        r.layoutAt = now
        r.layout = readSheetLayout(root)
      }
      const region = specimenRegion(size.width, size.height, r.layout ?? {})
      /* The body's extent and where its box sits around its centre are
         taken once and kept: the framing must not breathe as the view turns. */
      if (!r.spec.box && w.specimenBoxRel?.id === id) r.spec.box = { ...w.specimenBoxRel }
      const b = r.spec.box ?? null
      const extent = b ? Math.max(-b.x0, b.x1, -b.y0, b.y1) : 1
      const px = specimenRadius(region, r.spec.start, extent)
      const want = distanceForRadius(body.r, px, size.height, camera.fov)
      const k = 1 - Math.exp(-Math.min(0.1, delta) * 1.8)
      tmp.step.copy(camera.position).sub(tmp.centre)
      const cur = tmp.step.length() || want
      const next = cur + (want - cur) * k
      camera.position.copy(tmp.centre).addScaledVector(tmp.step.normalize(), next)
      const floor = habitatHeight(camera.position.x, camera.position.z) + 0.8
      if (camera.position.y < floor) camera.position.y = floor
      if (controls) {
        controls.enableZoom = false
        controls.minDistance = next * 0.999
        controls.maxDistance = next * 1.001
      }
      /* Centre the silhouette (not just the body's middle) on the stage. */
      const rNow = projectedR()
      const bx = b ? ((b.x0 + b.x1) / 2) * rNow : 0
      const by = b ? ((b.y0 + b.y1) / 2) * rNow : 0
      const tx = region.cx - size.width / 2 - bx
      const ty = region.cy - size.height / 2 - by
      r.ox += (tx - r.ox) * k
      r.oy += (ty - r.oy) * k
      camera.setViewOffset(size.width, size.height, -r.ox, -r.oy, size.width, size.height)
    }
    /* Corner brackets around the observed life (CSS reads these). */
    if (root) {
      tmp.p.copy(tmp.centre).project(camera)
      const x = (tmp.p.x * 0.5 + 0.5) * size.width
      const y = (-tmp.p.y * 0.5 + 0.5) * size.height
      tmp.right.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(body.r * 1.35).add(tmp.centre).project(camera)
      const half = Math.abs((tmp.right.x - tmp.p.x) * 0.5 * size.width)
      const visible = tmp.p.z < 1 && !r.moving ? 1 : 0
      root.style.setProperty('--exp07-fx', `${x.toFixed(1)}px`)
      root.style.setProperty('--exp07-fy', `${y.toFixed(1)}px`)
      root.style.setProperty('--exp07-fs', `${Math.min(size.height * 0.8, Math.max(60, half * 2)).toFixed(1)}px`)
      root.style.setProperty('--exp07-fo', String(visible))
    }
  })
  return null
}

/**
 * The death the world witnesses: the focused life's (World Final) — its dusk
 * dims everything else. Writes `sceneDeathRef.current.t` and `world.dimming`.
 */
export function WitnessClock({ world, heroDeathRef, sceneDeathRef }) {
  useFrame(() => {
    const w = world.current
    const id = w.focusId
    let t = -1
    if (id === 'hero') t = heroDeathRef.current?.t ?? -1
    else if (id) t = w.kinInfo.get(id)?.deathT ?? -1
    sceneDeathRef.current.t = t
    w.dimming.id = t >= 0 ? id : null
    w.dimming.dusk = deathPhases(t).dusk
  })
  return null
}

export function WaterSurface({ world, groundY }) {
  const res = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1400, 1400, 1, 1)
    geo.rotateX(Math.PI / 2)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uBright: { value: new THREE.Color('#f4f2fa') },
        uDeep: { value: new THREE.Color('#7a8298') },
      },
      vertexShader: surfaceVertex,
      fragmentShader: surfaceFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    })
    return { geo, mat }
  }, [])
  useEffect(() => () => {
    res.geo.dispose()
    res.mat.dispose()
  }, [res])
  useFrame((state) => {
    res.mat.uniforms.uTime.value = state.clock.elapsedTime
    /* Bright while looking up through it on the way down; nearly gone once
       the gaze is level, so the ripple sheet does not sit across the view. */
    const opening = world.current.opening
    const depth = opening.depth ?? 0
    const veil = opening.veil ?? 0
    /* The ripple sheet stays hidden while the entrance veil is up. */
    const gate = veil <= 0 ? 1 : veil >= 0.35 ? 0 : 1 - veil / 0.35
    res.mat.uniforms.uOpacity.value = (0.12 + 0.88 * depth) * gate
  })
  return (
    <mesh
      geometry={res.geo}
      material={res.mat}
      position={[0, groundY + SURFACE_HEIGHT, 0]}
      renderOrder={-5}
      frustumCulled={false}
      dispose={null}
    />
  )
}
