import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import WebGLCanvas from '../../WebGLCanvas.jsx'
import FocusStudio, { ViewCapture } from './FocusStudio.jsx'
import { resolveRenderDpr, STUDIES_MAX_PIXELS } from '../../renderBudget.js'
import { syncAgeClock } from '../../ageClock.js'
import { cutOutPixels } from './snapshotCutout.js'
import CrystalBody from './CrystalBody.jsx'
import ExploreLifeScatter from '../finalForm/ExploreLifeScatter.jsx'
import { mapLifeToExploreVisual } from '../finalForm/exploreLifeAdapter.js'
import { EXP05_LAB_DEFAULTS } from '../finalForm/exp05LabParams.js'
import HabitatGrowth from './HabitatGrowth.jsx'
import HabitatKin from './HabitatKin.jsx'
import { formEmergence, KIN_TINTS, worldBodyScale } from './habitatKin.js'
import { witherAmount } from './habitatFossil.js'
import RemainsField from './Remains.jsx'
import { DescentCamera, FocusRig, WaterSurface, WitnessClock } from './WorldOpening.jsx'
import { descentPose, HERO_HOME, INITIAL_SPECIES } from './worldOpening.js'
import HabitatTerrain from './HabitatTerrain.jsx'
import CrystalSpires from './CrystalSpires.jsx'
import Caves from './Caves.jsx'
import { underworldSpan } from './caves.js'
import { pushOutOfSpires, spireColliders } from './crystalSpires.js'
import {
  HABITAT_FOG,
  Bubbles,
  Dust,
  createToneState,
  HabitatEnvironment,
  HabitatLights,
  HabitatPost,
  HabitatSky,
  HabitatTone,
  LightShafts,
  Motes,
} from './HabitatAtmosphere.jsx'
import { habitatHeight } from './habitatField.js'

const GROUND_Y = habitatHeight(0, 0)
const UP = new THREE.Vector3(0, 1, 0)
const LOOK_SPEED = 0.0032
const WORLD_LIMIT = 300
/* World Final: the explore camera walks around the crystal spires, not through. */
const SPIRE_COLLIDERS = spireColliders()

/**
 * Explore controls on top of the orbit: W/S forward/back and A/D strafe in the
 * view direction (on the ground plane), Q/E down/up, Shift to move faster.
 * Camera and orbit target move together; drag still looks, wheel zooms.
 */
function ExploreKeys({ world = null }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const keys = useRef({})
  const tmp = useMemo(
    () => ({ fwd: new THREE.Vector3(), right: new THREE.Vector3(), want: new THREE.Vector3(), vel: new THREE.Vector3(), step: new THREE.Vector3(), last: null }),
    [],
  )

  useEffect(() => {
    const typing = (e) => {
      const t = e.target
      const tag = t?.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable
    }
    const down = (e) => {
      if (e.key === 'Shift') keys.current.shift = true
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k.length === 1 && 'wasdqe'.includes(k)) {
        keys.current[k] = true
        e.preventDefault()
      }
    }
    const up = (e) => {
      if (e.key === 'Shift') keys.current.shift = false
      keys.current[e.key.toLowerCase()] = false
    }
    const clear = () => {
      keys.current = {}
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  /* Right-drag: look around from where the camera stands (yaw + pitch). The
     orbit target swings around the camera; left-drag still orbits. */
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const el = gl.domElement
    let drag = null
    const dir = new THREE.Vector3()
    const side = new THREE.Vector3()
    const onDown = (e) => {
      if (e.button !== 2) return
      /* No looking around while the camera is being flown (descent / focus glide). */
      if (controls && !controls.enabled) return
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId }
      el.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e) => {
      if (!drag || e.pointerId !== drag.id || !controls?.target) return
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      drag.x = e.clientX
      drag.y = e.clientY
      dir.copy(controls.target).sub(camera.position)
      const dist = dir.length() || 1
      dir.divideScalar(dist)
      dir.applyAxisAngle(UP, -dx * LOOK_SPEED)
      side.crossVectors(dir, UP).normalize()
      const pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1))
      const next = THREE.MathUtils.clamp(pitch - dy * LOOK_SPEED, -1.0, 0.42)
      dir.applyAxisAngle(side, next - pitch).normalize()
      controls.target.copy(camera.position).addScaledVector(dir, dist)
      controls.update()
    }
    const onUp = (e) => {
      if (drag && e.pointerId === drag.id) drag = null
    }
    const noMenu = (e) => e.preventDefault()
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('contextmenu', noMenu)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('contextmenu', noMenu)
    }
  }, [gl, camera, controls])

  useFrame((_, delta) => {
    const k = keys.current
    const dt = Math.min(0.05, delta)
    /* World Final: the descent / focus glide own the camera; moving away
       while observing a life simply returns to free exploration. */
    const w = world?.current
    const anyKey = k.w || k.a || k.s || k.d || k.q || k.e
    if (w && anyKey && w.phase === 'descent') {
      w.opening.skip = true
      return
    }
    if (w && anyKey && w.focusId) w.exitFocus?.()
    if (controls && !controls.enabled) return
    const { fwd, right, want, vel, step } = tmp
    camera.getWorldDirection(fwd)
    fwd.y = 0
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1)
    fwd.normalize()
    right.crossVectors(fwd, UP).normalize()
    want.set(0, 0, 0)
    if (k.w) want.add(fwd)
    if (k.s) want.sub(fwd)
    if (k.d) want.add(right)
    if (k.a) want.sub(right)
    if (want.lengthSq() > 0) want.normalize()
    const speed = k.shift ? 18 : 6
    want.multiplyScalar(speed)
    want.y = ((k.e ? 1 : 0) - (k.q ? 1 : 0)) * speed * 0.6
    vel.lerp(want, 1 - Math.exp(-6 * dt))
    if (vel.lengthSq() > 1e-5) {
      step.copy(vel).multiplyScalar(dt)
      camera.position.add(step)
      controls?.target?.add(step)
    }
    /* Under the sand (World Final underworld): stay between the cavern's
       floor and ceiling; a wall or pillar sends you back where you were. */
    let span = w ? underworldSpan(camera.position.x, camera.position.y, camera.position.z) : null
    if (span && span.ceiling - span.floor < 1.4 && tmp.last) {
      step.set(tmp.last.x - camera.position.x, 0, tmp.last.z - camera.position.z)
      camera.position.add(step)
      controls?.target?.add(step)
      span = underworldSpan(camera.position.x, camera.position.y, camera.position.z)
    }
    if (span) {
      const lo = span.floor + 0.5
      const hi = Math.max(lo, span.ceiling - 0.45)
      const fix = Math.max(0, lo - camera.position.y) - Math.max(0, camera.position.y - hi)
      if (fix) {
        camera.position.y += fix
        if (controls?.target) controls.target.y += fix
      }
    } else {
      /* Stay above the sand, below the sky, inside the world (every frame, so
         orbiting or looking can never sink the camera into a dune). */
      const ground = habitatHeight(camera.position.x, camera.position.z)
      const lift = Math.max(0, ground + 0.5 - camera.position.y) - Math.max(0, camera.position.y - (ground + 90))
      if (lift) {
        camera.position.y += lift
        if (controls?.target) controls.target.y += lift
      }
    }
    if (w) {
      const [px, pz] = pushOutOfSpires([camera.position.x, camera.position.y, camera.position.z], SPIRE_COLLIDERS)
      if (px || pz) {
        step.set(px, 0, pz)
        camera.position.add(step)
        controls?.target?.add(step)
      }
    }
    const rr = Math.hypot(camera.position.x, camera.position.z)
    if (rr > WORLD_LIMIT) {
      const back = (rr - WORLD_LIMIT) / rr
      step.set(-camera.position.x * back, 0, -camera.position.z * back)
      camera.position.add(step)
      controls?.target?.add(step)
    }
    controls?.update?.()
    tmp.last = tmp.last ?? new THREE.Vector3()
    tmp.last.copy(camera.position)
  })
  return null
}
const TARGET = [0, GROUND_Y + 3.1, 0]

function useDpr() {
  const [dpr, setDpr] = useState(() =>
    typeof window === 'undefined'
      ? 1
      : resolveRenderDpr(window.innerWidth, window.innerHeight, window.devicePixelRatio, STUDIES_MAX_PIXELS),
  )
  useEffect(() => {
    const update = () =>
      setDpr(resolveRenderDpr(window.innerWidth, window.innerHeight, window.devicePixelRatio, STUDIES_MAX_PIXELS))
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return dpr
}

/** Seconds since the hero's life ended (−1 while alive); runs even when paused. */
function DeathClock({ dead, deathRef }) {
  useFrame((_, delta) => {
    const d = deathRef.current
    if (!dead) d.t = -1
    else d.t = d.t < 0 ? 0 : d.t + Math.min(0.1, delta)
  })
  return null
}

/** Projects the hero so the end-of-life card can lead a line out from the body. */
function SpecimenLeader({ bodyRef, overlayRef, world = null }) {
  const { camera, size } = useThree()
  const point = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const root = overlayRef?.current?.parentElement
    /* World Final: the line leads to whichever life is being witnessed. */
    const focusId = world?.current?.focusId
    const body = (focusId && world.current.bodies.get(focusId)) || bodyRef?.current
    if (!root || !body || !Number.isFinite(body.x)) return
    point.set(body.x, body.y, body.z).project(camera)
    const x = (point.x * 0.5 + 0.5) * size.width
    const y = (-point.y * 0.5 + 0.5) * size.height
    const cardW = Math.min(288, size.width * 0.86)
    const rx = size.width * 0.034 + cardW
    const ry = Math.max(150, size.height * 0.22) + cardW * 0.42
    root.style.setProperty('--exp07-ax', `${x}px`)
    root.style.setProperty('--exp07-ay', `${y}px`)
    root.style.setProperty('--exp07-reveal-len', `${Math.hypot(rx - x, ry - y)}px`)
    root.style.setProperty('--exp07-reveal-ang', `${Math.atan2(ry - y, rx - x)}rad`)
  })
  return null
}

/**
 * World Final: pictures of a life for its archive record. Anyone may call
 * `world.current.requestSnapshot(id, px)`; the next frame, right after it is
 * rendered, the life is cropped out of the canvas (square, around its body)
 * and handed back as a small data URL (or null if it is not in view).
 */
function SnapshotTaker({ world }) {
  const { gl, camera } = useThree()
  const tmp = useMemo(() => ({ c: new THREE.Vector3(), e: new THREE.Vector3(), b: new THREE.Vector3() }), [])
  useEffect(() => {
    const w = world.current
    w.snapshotQueue = []
    w.requestSnapshot = (id, px = 360) => new Promise((resolve) => w.snapshotQueue.push({ id, px, resolve }))
    return () => {
      for (const job of w.snapshotQueue ?? []) job.resolve(null)
      w.snapshotQueue = []
      w.requestSnapshot = null
    }
  }, [world])
  /* Priority 2: after HabitatPost has drawn this frame (priority 1), while the
     drawing buffer still holds it. */
  useFrame(() => {
    const w = world.current
    if (!w.snapshotQueue?.length) return
    const src = gl.domElement
    for (const job of w.snapshotQueue.splice(0)) {
      try {
        const body = w.bodies.get(job.id)
        if (!body || !Number.isFinite(body.x)) {
          job.resolve(null)
          continue
        }
        tmp.b.set(body.x, body.y, body.z)
        tmp.c.copy(tmp.b).project(camera)
        if (tmp.c.z > 1 || Math.abs(tmp.c.x) > 1.2 || Math.abs(tmp.c.y) > 1.2) {
          job.resolve(null)
          continue
        }
        tmp.e.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(body.r * 1.55).add(tmp.b).project(camera)
        const cx = (tmp.c.x * 0.5 + 0.5) * src.width
        const cy = (-tmp.c.y * 0.5 + 0.5) * src.height
        const rad = Math.max(24, Math.abs(tmp.e.x - tmp.c.x) * 0.5 * src.width)
        const out = document.createElement('canvas')
        out.width = out.height = job.px
        const ctx = out.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(src, cx - rad, cy - rad, rad * 2, rad * 2, 0, 0, job.px, job.px)
        /* Lift the life out of its water (transparent background). */
        const pixels = ctx.getImageData(0, 0, job.px, job.px)
        cutOutPixels(pixels.data, job.px)
        ctx.putImageData(pixels, 0, 0)
        let url = out.toDataURL('image/webp', 0.82)
        if (!url.startsWith('data:image/webp')) url = out.toDataURL('image/png')
        job.resolve(url)
      } catch {
        job.resolve(null)
      }
    }
  }, 2)
  return null
}

function HabitatClock({ timeRef, runningRef, age }) {
  useEffect(() => {
    syncAgeClock(age)
  }, [age])
  useFrame((_, delta) => {
    if (runningRef.current) timeRef.current += Math.min(0.05, delta)
  })
  return null
}

function PixelScale({ children }) {
  const { gl, size } = useThree()
  const scale = useMemo(() => gl.getPixelRatio() * (size.height / 900), [gl, size.height])
  return children(scale)
}

/**
 * Exp07 Final Habitat: the crystallizing organism resting on a misty
 * forest floor. Everything reads the same crystalRef / envRef so the body and
 * the habitat answer one medium.
 */
/* Memoized: the page re-renders on every keystroke in the "Tell it something"
   field; without this the whole 3D tree re-rendered per key and frames dropped
   (visible as flicker while typing). */
export default memo(HabitatScene)

function HabitatScene({
  life,
  crystalRef,
  envRef,
  timeRef,
  runningRef,
  temperature,
  moisture = 0.5,
  turbulence = 0,
  running = true,
  layers,
  crystalLevel = 0,
  /** Page overlay element whose CSS tone variables follow the water. */
  overlayRef = null,
  /** World Final opening experience: { current: world state } (see Experiment07). */
  world = null,
  /** World Final lineage: where the hero lives now and what it is. */
  heroHome = null,
  heroSpecies = null,
  /** Kept specimens (World Final): their remains rest in the underworld. */
  archive = null,
  className = 'exp07-viewport',
  /** False while another page is open: the world is paused, not unmounted. */
  active = true,
}) {
  const dpr = useDpr()
  /* The hero's collision body, shared with the kin physics (contacts back). */
  const heroRef = useRef({ x: 0, y: 0, z: 0, r: 0, contacts: [] })
  /* The water's tone, eased toward the environment (fog, sky, light, shafts). */
  const toneRef = useRef(null)
  if (toneRef.current == null) toneRef.current = createToneState()
  const deathRef = useRef({ t: -1 })
  /* World Final: the hero's silhouette emerges with age (body + petals agree). */
  const heroLobe = world ? formEmergence(life?.age ?? 0) : 1
  /* The death the world witnesses (hero in the lab; the focused life in World Final). */
  const sceneDeathRef = useRef({ t: -1 })
  const opening = useMemo(() => (world ? descentPose(0, GROUND_Y) : null), [world])
  const wither = life?.dead ? 1 : witherAmount(life?.age ?? 0)
  /* Petals become crystals: the same growth sites, petals shrink as it freezes. */
  const petalScale = (EXP05_LAB_DEFAULTS.petalScale ?? 1) * (1 - 0.7 * crystalLevel) * (1 - 0.95 * Math.round(wither * 10) / 10)
  const visual = useMemo(
    () =>
      life
        ? mapLifeToExploreVisual(life, {
            petalDensity: EXP05_LAB_DEFAULTS.petalDensity,
            petalScale,
            particleDensity: EXP05_LAB_DEFAULTS.particleDensity,
            particleMotion: EXP05_LAB_DEFAULTS.particleMotion,
          })
        : null,
    [life, petalScale],
  )
  /* World Final: the body grows its own petals on its skin (CrystalBody). */
  const showPetals =
    !world && layers?.petals !== false && visual && !visual.isDead && (visual.petalPlan?.petalCount ?? 0) > 0
  return (
    <WebGLCanvas
      frameloop={active ? 'always' : 'never'}
      className={className}
      camera={{ position: opening ? opening.position : [1.6, GROUND_Y + 3.4, 11.5], fov: 34, near: 0.05, far: 3000 }}
      dpr={dpr}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        /* Neutral (Khronos PBR) tone mapping: keeps the palette's hues and
           saturation, rolls highlights off instead of blowing them white. */
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 0.82
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
    >
      <fogExp2 attach="fog" args={[HABITAT_FOG, 0.0105]} />
      <HabitatClock timeRef={timeRef} runningRef={runningRef} age={life?.age ?? 0} />
      <HabitatEnvironment />
      <DeathClock dead={Boolean(life?.dead)} deathRef={deathRef} />
      {world ? <WitnessClock world={world} heroDeathRef={deathRef} sceneDeathRef={sceneDeathRef} /> : null}
      <HabitatTone envRef={envRef} toneRef={toneRef} deathRef={world ? sceneDeathRef : deathRef} overlayRef={overlayRef} world={world} />
      {world ? <WaterSurface world={world} groundY={GROUND_Y} /> : null}
      {world ? <RemainsField world={world} /> : null}
      {world ? <CrystalSpires /> : null}
      {world ? <FocusStudio world={world} /> : null}
      {world ? <ViewCapture /> : null}
      {world ? <Caves crystalRef={crystalRef} world={world} archive={archive} /> : null}
      <HabitatSky toneRef={toneRef} />
      <HabitatLights toneRef={toneRef} />
      <PixelScale>
        {(scale) => (
          <>
            <HabitatTerrain timeRef={timeRef} envRef={envRef} toneRef={toneRef} pixelScale={scale} layers={layers} />
            <Motes timeRef={timeRef} envRef={envRef} toneRef={toneRef} pixelScale={scale} />
            <Dust timeRef={timeRef} toneRef={toneRef} pixelScale={scale} />
            <Bubbles timeRef={timeRef} envRef={envRef} pixelScale={scale} />
          </>
        )}
      </PixelScale>
      <HabitatGrowth crystalRef={crystalRef} toneRef={toneRef} layers={layers} />
      <LightShafts timeRef={timeRef} toneRef={toneRef} />
      {layers?.kin !== false ? (
        <HabitatKin
          world={world}
          crystalRef={crystalRef}
          envRef={envRef}
          timeRef={timeRef}
          heroRef={heroRef}
          toneRef={toneRef}
          temperature={temperature}
          moisture={moisture}
          turbulence={turbulence}
          running={running}
          layers={layers}
          crystalLevel={crystalLevel}
        />
      ) : null}
      {life ? (
        <CrystalBody
          life={life}
          crystalRef={crystalRef}
          envRef={envRef}
          temperature={temperature}
          groundY={GROUND_Y}
          layers={layers}
          timeRef={timeRef}
          bodyRef={heroRef}
          deathRef={deathRef}
          home={world ? heroHome ?? HERO_HOME : null}
          world={world}
          selfId="hero"
          morphologyType={world ? heroSpecies ?? INITIAL_SPECIES.hero : undefined}
          lobeAmplitude={heroLobe}
          bodyScale={world ? worldBodyScale(life?.age ?? 0) : 1}
          responsive={Boolean(world)}
          glow={Boolean(world)}
        >
          {showPetals ? (
            <ExploreLifeScatter
              life={life}
              petalPlan={visual.petalPlan}
              morphStrength={1}
              deformationStrength={1}
              lobeAmplitude={heroLobe}
              morphologyType={world ? heroSpecies ?? INITIAL_SPECIES.hero : undefined}
              temperature={temperature}
              sculpturalStrength={0}
              surfaceSeed={visual.individuality.seed}
              noiseScale={visual.individuality.noiseScale}
              age={visual.development.age}
              speed={visual.development.speed}
              pulseSpeed={visual.development.pulseSpeed}
              displacement={visual.development.displacement}
              noiseAmount={visual.development.noiseAmount}
              decayStart={0.8}
              decayScale={1.25}
              colorA={KIN_TINTS[0].petal}
              colorB={visual.surface.colorB}
              rimColor={visual.surface.rimColor}
              occludedByBody
            />
          ) : null}
        </CrystalBody>
      ) : null}
      <SpecimenLeader bodyRef={heroRef} overlayRef={overlayRef} world={world} />
      <OrbitControls
        makeDefault
        target={TARGET}
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.5}
        zoomToCursor
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: -1 }}
        zoomSpeed={0.8}
        minDistance={1.5}
        maxDistance={40}
        minPolarAngle={world ? 1.42 : 0.5}
        maxPolarAngle={world ? 1.85 : 2.0}
      />
      <ExploreKeys world={world} />
      {world ? <DescentCamera world={world} groundY={GROUND_Y} overlayRef={overlayRef} /> : null}
      {world ? <FocusRig world={world} overlayRef={overlayRef} /> : null}
      <HabitatPost bloomStrength={layers?.bloom === false ? 0 : 0.12} />
      {world ? <SnapshotTaker world={world} /> : null}
    </WebGLCanvas>
  )
}
