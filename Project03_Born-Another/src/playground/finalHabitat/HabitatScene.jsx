import { useEffect, useMemo, useRef, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import WebGLCanvas from '../../WebGLCanvas.jsx'
import { resolveRenderDpr, STUDIES_MAX_PIXELS } from '../../renderBudget.js'
import { syncAgeClock } from '../../ageClock.js'
import CrystalBody from './CrystalBody.jsx'
import ExploreLifeScatter from '../finalForm/ExploreLifeScatter.jsx'
import { mapLifeToExploreVisual } from '../finalForm/exploreLifeAdapter.js'
import { EXP05_LAB_DEFAULTS } from '../finalForm/exp05LabParams.js'
import HabitatGrowth from './HabitatGrowth.jsx'
import HabitatKin from './HabitatKin.jsx'
import HabitatTerrain from './HabitatTerrain.jsx'
import {
  HABITAT_FOG,
  HabitatEnvironment,
  HabitatLights,
  HabitatPost,
  HabitatSky,
  LightShafts,
  Motes,
} from './HabitatAtmosphere.jsx'
import { habitatHeight } from './habitatField.js'

const GROUND_Y = habitatHeight(0, 0)
const UP = new THREE.Vector3(0, 1, 0)
const LOOK_SPEED = 0.0032
const WORLD_LIMIT = 300

/**
 * Explore controls on top of the orbit: W/S forward/back and A/D strafe in the
 * view direction (on the ground plane), Q/E down/up, Shift to move faster.
 * Camera and orbit target move together; drag still looks, wheel zooms.
 */
function ExploreKeys() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const keys = useRef({})
  const tmp = useMemo(
    () => ({ fwd: new THREE.Vector3(), right: new THREE.Vector3(), want: new THREE.Vector3(), vel: new THREE.Vector3(), step: new THREE.Vector3() }),
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
    /* Stay above the sand, below the sky, inside the world (every frame, so
       orbiting or looking can never sink the camera into a dune). */
    const ground = habitatHeight(camera.position.x, camera.position.z)
    const lift = Math.max(0, ground + 0.5 - camera.position.y) - Math.max(0, camera.position.y - (ground + 90))
    if (lift) {
      camera.position.y += lift
      if (controls?.target) controls.target.y += lift
    }
    const rr = Math.hypot(camera.position.x, camera.position.z)
    if (rr > WORLD_LIMIT) {
      const back = (rr - WORLD_LIMIT) / rr
      step.set(-camera.position.x * back, 0, -camera.position.z * back)
      camera.position.add(step)
      controls?.target?.add(step)
    }
    controls?.update?.()
  })
  return null
}
const TARGET = [0, GROUND_Y + 2.2, 0]

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

/** Advances the shared habitat clock (paused when Real time is off). */
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
export default function HabitatScene({
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
  className = 'exp07-viewport',
}) {
  const dpr = useDpr()
  /* Petals become crystals: the same growth sites, petals shrink as it freezes. */
  const petalScale = (EXP05_LAB_DEFAULTS.petalScale ?? 1) * (1 - 0.7 * crystalLevel)
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
  const showPetals =
    layers?.petals !== false && visual && !visual.isDead && (visual.petalPlan?.petalCount ?? 0) > 0
  return (
    <WebGLCanvas
      className={className}
      camera={{ position: [1.6, GROUND_Y + 2.9, 10.4], fov: 34, near: 0.05, far: 3000 }}
      dpr={dpr}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 0.78
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
    >
      <fogExp2 attach="fog" args={[HABITAT_FOG, 0.009]} />
      <HabitatClock timeRef={timeRef} runningRef={runningRef} age={life?.age ?? 0} />
      <HabitatEnvironment />
      <HabitatSky />
      <HabitatLights />
      <PixelScale>
        {(scale) => (
          <>
            <HabitatTerrain timeRef={timeRef} envRef={envRef} pixelScale={scale} layers={layers} />
            <Motes timeRef={timeRef} envRef={envRef} pixelScale={scale} />
          </>
        )}
      </PixelScale>
      <HabitatGrowth crystalRef={crystalRef} layers={layers} />
      <LightShafts timeRef={timeRef} />
      {layers?.kin !== false ? (
        <HabitatKin
          crystalRef={crystalRef}
          envRef={envRef}
          timeRef={timeRef}
          temperature={temperature}
          moisture={moisture}
          turbulence={turbulence}
          running={running}
          layers={layers}
          crystalLevel={crystalLevel}
        />
      ) : null}
      {life && !life.dead ? (
        <CrystalBody
          life={life}
          crystalRef={crystalRef}
          envRef={envRef}
          temperature={temperature}
          groundY={GROUND_Y}
          layers={layers}
          timeRef={timeRef}
        >
          {showPetals ? (
            <ExploreLifeScatter
              life={life}
              petalPlan={visual.petalPlan}
              morphStrength={1}
              deformationStrength={1}
              lobeAmplitude={1}
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
              colorA={visual.surface.colorA}
              colorB={visual.surface.colorB}
              rimColor={visual.surface.rimColor}
            />
          ) : null}
        </CrystalBody>
      ) : null}
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
        minPolarAngle={0.5}
        maxPolarAngle={2.0}
      />
      <ExploreKeys />
      <HabitatPost bloomStrength={layers?.bloom === false ? 0 : 0.12} />
    </WebGLCanvas>
  )
}
