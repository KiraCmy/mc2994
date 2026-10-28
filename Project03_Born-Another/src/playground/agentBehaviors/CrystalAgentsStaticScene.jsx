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
import CompetitionFlows from './CompetitionFlows.jsx'
import SingleBioCrystalCluster from './SingleBioCrystalCluster.jsx'
import {
  createCrystalPastelEnvMap,
  createCrystalStudioCubeEnvMap,
  EXP03_CRYSTAL_LIGHT_RIG,
} from './crystalStudioEnvMap.js'

/** Close framing: cohesive cluster fills most of the viewport (reference match). */
const CRYSTAL_STUDY_CAMERA_DISTANCE = 1.18
/** Medium framing: the whole multi-cluster patch reads in one view. */
const CRYSTAL_FIELD_CAMERA_DISTANCE = 2.7
/*
 * Low side-on view for the multi-cluster field: crystals grow along the
 * membrane normal, so a top-down camera foreshortens them into flat shards.
 * Elevation = angle above the local membrane surface; azimuth = turn away
 * from straight "below" toward the side for a three-quarter read.
 */
const CRYSTAL_FIELD_CAMERA_ELEVATION = 0.52
const CRYSTAL_FIELD_CAMERA_AZIMUTH = 0.32
/** Aim at mid-crystal height so standing formations sit mid-frame. */
const CRYSTAL_FIELD_TARGET_LIFT = 0.04
/*
 * Shift the aim point along the surface "side" axis so the colony lands in
 * the open area left of the Agent Inspector panel (moves content screen-left).
 */
const CRYSTAL_FIELD_TARGET_SIDE = 0.2

/** Mean seat (position + normal) of every cluster that has reported one. */
function centroidSeat(seats) {
  const list = seats.filter((s) => s?.position && s?.normal)
  if (list.length === 0) return null
  const position = new THREE.Vector3()
  const normal = new THREE.Vector3()
  for (const s of list) {
    position.add(s.position)
    normal.add(s.normal)
  }
  position.multiplyScalar(1 / list.length)
  normal.normalize()
  return { position, normal }
}

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
  /** Radians above the membrane surface; null = legacy along-normal view. */
  elevation = null,
  azimuth = 0,
  targetLift = 0,
  targetSide = 0,
}) {
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    if (!seat?.position || !seat?.normal) return
    const outward = seat.normal.clone().normalize()
    const target = seat.position.clone().addScaledVector(outward, targetLift)
    let position
    if (elevation == null) {
      /* Slight lateral bias so elongated facets read in three-quarter view. */
      const viewOffset = outward
        .clone()
        .multiplyScalar(distance)
        .add(new THREE.Vector3(0.18, 0.16, 0))
      position = target.clone().add(viewOffset)
    } else {
      /*
       * Tangent frame on the membrane: `surfaceUp` = world +Y projected onto
       * the surface. Placing the camera on the −surfaceUp side keeps world-up
       * orbit controls, and crystals (growing along `outward`) read upright.
       */
      const worldUp = new THREE.Vector3(0, 1, 0)
      const surfaceUp = worldUp
        .clone()
        .addScaledVector(outward, -worldUp.dot(outward))
        .normalize()
      const side = new THREE.Vector3().crossVectors(surfaceUp, outward)
      const along = surfaceUp
        .clone()
        .multiplyScalar(-Math.cos(azimuth))
        .addScaledVector(side, Math.sin(azimuth))
      const dir = outward
        .clone()
        .multiplyScalar(Math.sin(elevation))
        .addScaledVector(along, Math.cos(elevation))
        .normalize()
      target.addScaledVector(side, targetSide)
      position = target.clone().addScaledVector(dir, distance)
    }

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
  }, [
    seat,
    camera,
    controlsRef,
    distance,
    elevation,
    azimuth,
    targetLift,
    targetSide,
  ])

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
  /** Multi-cluster layout from planMultiBioCrystalClusters (null = single). */
  clusters = null,
  /** Live getter → pieceId → vitality 0..1 (stress / starvation tint). */
  getVitalityMap = null,
  /** clusterId → { drain, sources } from the agent sim (competition). */
  competitionState = null,
  showCompetitionFlows = true,
}) {
  const dpr = useStudiesDpr()
  const controlsRef = useRef(null)
  const [seat, setSeat] = useState(null)
  const [crystalEnvMaps, setCrystalEnvMaps] = useState(null)
  const params = lab ?? EXP05_LAB_DEFAULTS

  const handleSeatReady = useCallback((nextSeat) => {
    setSeat(nextSeat)
  }, [])

  /*
   * Multi-cluster framing: every cluster reports its seat; the camera and
   * studio lights centre on the mean seat of the clusters currently shown.
   */
  const multi = Array.isArray(clusters) && clusters.length > 0
  const clusterSeatsRef = useRef(new Map())
  const [seatVersion, setSeatVersion] = useState(0)
  const clusterKey = multi ? clusters.map((c) => c.id).join(',') : ''
  const clusterSeatHandlers = useMemo(() => {
    const ids = clusterKey ? clusterKey.split(',') : []
    const seats = clusterSeatsRef.current
    for (const id of [...seats.keys()]) {
      if (!ids.includes(id)) seats.delete(id)
    }
    const handlers = {}
    for (const id of ids) {
      handlers[id] = (nextSeat) => {
        seats.set(id, nextSeat)
        setSeat(centroidSeat(ids.map((key) => seats.get(key))))
        setSeatVersion((n) => n + 1)
      }
    }
    return handlers
  }, [clusterKey])
  const framingDistance =
    multi && clusters.length > 1
      ? CRYSTAL_FIELD_CAMERA_DISTANCE
      : CRYSTAL_STUDY_CAMERA_DISTANCE

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
      {showCrystals && multi
        ? clusters.map((cluster) => (
            <SingleBioCrystalCluster
              key={cluster.id}
              life={life}
              lobeAmplitude={lobeAmplitude}
              morphologyType={morphologyType}
              glintEnvMap={crystalEnvMaps?.glint ?? null}
              bodyEnvMap={crystalEnvMaps?.body ?? null}
              onSeatReady={clusterSeatHandlers[cluster.id]}
              planSeed={planSeed}
              clusterPlan={cluster}
              growthByPieceId={growthByPieceId}
              getGrowthMap={getGrowthMap}
              getVitalityMap={getVitalityMap}
            />
          ))
        : null}
      {showCrystals && multi ? (
        <CompetitionFlows
          seats={clusterSeatsRef.current}
          seatVersion={seatVersion}
          competitionState={competitionState}
          visible={showCompetitionFlows}
        />
      ) : null}
      {showCrystals && !multi ? (
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
      <GrowthSiteFraming
        seat={seat}
        controlsRef={controlsRef}
        distance={framingDistance}
        elevation={multi ? CRYSTAL_FIELD_CAMERA_ELEVATION : null}
        azimuth={multi ? CRYSTAL_FIELD_CAMERA_AZIMUTH : 0}
        targetLift={multi ? CRYSTAL_FIELD_TARGET_LIFT : 0}
        targetSide={multi ? CRYSTAL_FIELD_TARGET_SIDE : 0}
      />
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
