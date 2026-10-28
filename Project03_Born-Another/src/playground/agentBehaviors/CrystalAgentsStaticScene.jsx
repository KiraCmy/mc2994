/**
 * Exp03 Study 01 — crystal agents on Exp05 membrane.
 * Geometry built once; growth scales from agent sim. Apron / tissue hidden.
 * Close-up framing; orbit / middle-pan / wheel zoom.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import WebGLCanvas from '../../WebGLCanvas.jsx'
import {
  ExploreCamera,
  EXPLORE_MAX_DISTANCE,
  EXPLORE_MIN_DISTANCE,
} from '../../explore/index.js'
import { syncAgeClock } from '../../ageClock.js'
import { resolveRenderDpr, STUDIES_MAX_PIXELS } from '../../renderBudget.js'
import ExploreWorldBody from '../finalForm/ExploreWorldBody.jsx'
import { mapLifeToExploreVisual } from '../finalForm/exploreLifeAdapter.js'
import {
  EXP05_DIAGNOSTIC_MODES,
  EXP05_LAB_DEFAULTS,
  EXP05_MATERIAL_MODES,
  normalizeExp05DiagnosticMode,
  normalizeExp05MaterialMode,
} from '../finalForm/exp05LabParams.js'
import {
  EXP05_ENV_TEMPERATURE_NEUTRAL,
  normalizeExp05Temperature,
} from '../finalForm/exp05EnvironmentCoupling.js'
import { EXP05_DEFAULT_MORPHOLOGY_TYPE } from '../finalForm/exp05MorphologyTypes.js'
import SingleBioCrystalCluster from './SingleBioCrystalCluster.jsx'
import {
  createCrystalPastelEnvMap,
  createCrystalStudioCubeEnvMap,
  EXP03_CRYSTAL_LIGHT_RIG,
} from './crystalStudioEnvMap.js'

/** Close framing: cohesive cluster fills most of the viewport (reference match). */
const CRYSTAL_STUDY_CAMERA_DISTANCE = 1.18

function useStudiesDpr(maxPixels = STUDIES_MAX_PIXELS) {
  const [dpr, setDpr] = useState(() => {
    if (typeof window === 'undefined') return 1
    return resolveRenderDpr(
      window.innerWidth,
      window.innerHeight,
      window.devicePixelRatio,
      maxPixels,
    )
  })

  useEffect(() => {
    const update = () => {
      setDpr(
        resolveRenderDpr(
          window.innerWidth,
          window.innerHeight,
          window.devicePixelRatio,
          maxPixels,
        ),
      )
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [maxPixels])

  return dpr
}

function LifeAgeClockBridge({ age }) {
  const ageRef = useRef(age)
  ageRef.current = age

  useEffect(() => {
    syncAgeClock(age)
  }, [age])

  useFrame(() => {
    syncAgeClock(ageRef.current)
  })

  return null
}

function MorphologyDiagnosticStage({ mode }) {
  const appearance = normalizeExp05DiagnosticMode(mode)

  useFrame(({ gl }) => {
    if (appearance === EXP05_DIAGNOSTIC_MODES.FULL) {
      gl.toneMapping = THREE.NoToneMapping
      gl.setClearColor(0x000000, 0)
      return
    }
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.05
    if (appearance === EXP05_DIAGNOSTIC_MODES.GEOMETRY) {
      gl.setClearColor(0x5e5e5e, 1)
      return
    }
    gl.setClearColor(0x141618, 1)
  })

  if (appearance === EXP05_DIAGNOSTIC_MODES.FULL) return null

  if (appearance === EXP05_DIAGNOSTIC_MODES.GEOMETRY) {
    return (
      <group>
        <ambientLight intensity={0.48} />
        <directionalLight position={[3.4, 4.6, 2.6]} intensity={1.05} />
        <directionalLight position={[-2.8, -1.4, -3.2]} intensity={0.22} />
      </group>
    )
  }

  return (
    <group>
      <hemisphereLight args={['#dfe6ec', '#1c2024', 0.5]} />
      <directionalLight position={[5.2, 1.6, 0.8]} intensity={1.45} />
      <directionalLight position={[-2.4, 4.8, -2.2]} intensity={0.38} />
      <directionalLight position={[0.2, -3.4, 2.4]} intensity={0.2} />
    </group>
  )
}

function GrowthSiteFraming({
  seat,
  controlsRef,
  distance = CRYSTAL_STUDY_CAMERA_DISTANCE,
}) {
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    if (!seat?.position || !seat?.normal) return
    const target = seat.position.clone()
    const outward = seat.normal.clone().normalize()
    /* Slight lateral bias so elongated facets read in three-quarter view. */
    const viewOffset = outward
      .clone()
      .multiplyScalar(distance)
      .add(new THREE.Vector3(0.18, 0.16, 0))
    const position = target.clone().add(viewOffset)

    camera.position.copy(position)
    camera.near = 0.03
    camera.far = 120
    camera.fov = 30
    camera.updateProjectionMatrix()
    camera.lookAt(target)

    const controls = controlsRef.current
    if (controls) {
      controls.target.copy(target)
      controls.minDistance = Math.min(EXPLORE_MIN_DISTANCE, 0.45)
      controls.update()
    }
  }, [seat, camera, controlsRef, distance])

  return null
}

/**
 * Bake the crystal-only reflection environments and hand them to the cluster:
 *  - glint: studio strips as a plain cube map (hard additive speculars)
 *  - body:  bright pastel room as PMREM (glass body / inner facets)
 * Does not assign scene.environment — Exp05 membrane appearance stays intact.
 * Failures are swallowed so crystals still render without the env maps.
 */
function CrystalStudioEnvMapBaker({ onReady }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const baked = []
    const result = { glint: null, body: null }
    try {
      const glint = createCrystalStudioCubeEnvMap(gl, 1024)
      baked.push(glint)
      result.glint = glint.texture
    } catch (error) {
      console.warn('[Exp03] crystal glint envMap bake failed', error)
    }
    try {
      const body = createCrystalPastelEnvMap(gl, 1024)
      baked.push(body)
      result.body = body.texture
    } catch (error) {
      console.warn('[Exp03] crystal body envMap bake failed', error)
    }
    onReady?.(result)
    return () => {
      onReady?.(null)
      for (const entry of baked) entry?.dispose?.()
    }
  }, [gl, onReady])

  return null
}

/**
 * Studio rig for the layered glass crystals (values in EXP03_CRYSTAL_LIGHT_RIG).
 * Softer than the old transmission rig — the pastel env map now carries most
 * of the facet brightness, lights add directional shape and coloured rims.
 */
function CrystalStudioLights({ seat }) {
  const origin = seat?.position
  const x = origin?.x ?? 0.05
  const y = origin?.y ?? 0.15
  const z = origin?.z ?? 0.95
  const rig = EXP03_CRYSTAL_LIGHT_RIG

  return (
    <group name="exp03-crystal-studio-lights">
      <ambientLight
        intensity={rig.ambient.intensity}
        color={rig.ambient.color}
      />
      {rig.directional.map((light, index) => (
        <directionalLight
          key={`dir-${index}`}
          position={[
            x + light.offset[0],
            y + light.offset[1],
            z + light.offset[2],
          ]}
          intensity={light.intensity}
          color={light.color}
        />
      ))}
      {rig.point.map((light, index) => (
        <pointLight
          key={`point-${index}`}
          position={[
            x + light.offset[0],
            y + light.offset[1],
            z + light.offset[2],
          ]}
          intensity={light.intensity}
          distance={light.distance}
          decay={2}
          color={light.color}
        />
      ))}
    </group>
  )
}

/**
 * Exp03 Study 01 — membrane + crystal agent cluster.
 */
export default function CrystalAgentsStaticScene({
  life,
  lab = null,
  className = 'exp03-viewport',
  growthByPieceId = null,
  getGrowthMap = null,
  planSeed = null,
}) {
  const dpr = useStudiesDpr()
  const controlsRef = useRef(null)
  const [seat, setSeat] = useState(null)
  const [crystalEnvMaps, setCrystalEnvMaps] = useState(null)
  const params = lab ?? EXP05_LAB_DEFAULTS

  const handleSeatReady = useCallback((nextSeat) => {
    setSeat(nextSeat)
  }, [])

  const handleCrystalEnvReady = useCallback((maps) => {
    setCrystalEnvMaps(maps)
  }, [])

  const visualLab = useMemo(
    () => ({
      petalDensity: params.petalDensity,
      petalScale: params.petalScale,
      particleDensity: params.particleDensity,
      particleMotion: params.particleMotion,
    }),
    [
      params.petalDensity,
      params.petalScale,
      params.particleDensity,
      params.particleMotion,
    ],
  )
  const visual = useMemo(
    () => mapLifeToExploreVisual(life, visualLab),
    [life, visualLab],
  )

  const morphStrength = 1
  const lobeAmplitude = params.morphologyComplexity ?? 1
  const deformationStrength = params.macroDeformationStrength ?? 1
  const sculpturalStrength = params.sculpturalStrength ?? 0
  const morphologyType =
    params.morphologyType ?? EXP05_DEFAULT_MORPHOLOGY_TYPE
  const diagnosticMode = normalizeExp05DiagnosticMode(
    params.diagnosticMode ?? EXP05_DIAGNOSTIC_MODES.FULL,
  )
  const materialMode = normalizeExp05MaterialMode(
    params.materialMode ?? EXP05_MATERIAL_MODES.PEARLESCENT,
  )
  const opticalDensity = params.opticalDensity ?? 1.35
  const thicknessContrast = params.thicknessContrast ?? 1.25
  const temperature = normalizeExp05Temperature(
    params.temperature ?? EXP05_ENV_TEMPERATURE_NEUTRAL,
  )

  const { age, isDead, surface, individuality, development } = visual
  /* Study 01 shows the agent-driven crystal formation while the body lives. */
  const showCrystals = !isDead

  const fallbackTarget = [0.05, 0.15, 0.95]
  const fallbackCam = [
    fallbackTarget[0] * 0.2,
    fallbackTarget[1] + 0.15,
    fallbackTarget[2] + CRYSTAL_STUDY_CAMERA_DISTANCE,
  ]

  return (
    <WebGLCanvas
      className={className}
      camera={{
        position: fallbackCam,
        fov: 30,
        near: 0.03,
        far: 120,
      }}
      dpr={dpr}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0)
        gl.toneMapping = THREE.NoToneMapping
      }}
    >
      <LifeAgeClockBridge age={age} />
      <MorphologyDiagnosticStage mode={diagnosticMode} />
      <CrystalStudioEnvMapBaker onReady={handleCrystalEnvReady} />
      <CrystalStudioLights seat={seat} />
      <ExploreCamera active />
      <ExploreWorldBody
        life={life}
        surface={surface}
        individuality={individuality}
        development={development}
        isDead={isDead}
        bodyDepthWrite
        morphStrength={morphStrength}
        deformationStrength={deformationStrength}
        lobeAmplitude={lobeAmplitude}
        morphologyType={morphologyType}
        diagnosticMode={diagnosticMode}
        materialMode={materialMode}
        temperature={temperature}
        sculpturalStrength={sculpturalStrength}
        opticalDensity={opticalDensity}
        thicknessContrast={thicknessContrast}
      />
      {showCrystals ? (
        <SingleBioCrystalCluster
          life={life}
          lobeAmplitude={lobeAmplitude}
          morphologyType={morphologyType}
          glintEnvMap={crystalEnvMaps?.glint ?? null}
          bodyEnvMap={crystalEnvMaps?.body ?? null}
          onSeatReady={handleSeatReady}
          planSeed={planSeed}
          growthByPieceId={growthByPieceId}
          getGrowthMap={getGrowthMap}
        />
      ) : null}
      <GrowthSiteFraming seat={seat} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan
        enableZoom
        enableRotate
        enableDamping
        autoRotate={false}
        dampingFactor={0.06}
        screenSpacePanning
        target={fallbackTarget}
        minDistance={0.45}
        maxDistance={EXPLORE_MAX_DISTANCE}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI - 0.12}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: undefined,
        }}
      />
    </WebGLCanvas>
  )
}
