import { useEffect, useMemo, useRef, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import WebGLCanvas from '../../WebGLCanvas.jsx'
import ExploreLifeScatter from './ExploreLifeScatter.jsx'
import ExploreWorldBody from './ExploreWorldBody.jsx'
import ExploreWorldParticles from './ExploreWorldParticles.jsx'
import GrowthSiteDebug from './GrowthSiteDebug.jsx'
import {
  ExploreCamera,
  EXPLORE_MAX_DISTANCE,
  EXPLORE_MIN_DISTANCE,
} from '../../explore/index.js'
import { syncAgeClock } from '../../ageClock.js'
import {
  isHeavyWebGLHost,
  resolveRenderDpr,
  STUDIES_MAX_PIXELS,
} from '../../renderBudget.js'
import { mapLifeToExploreVisual } from './exploreLifeAdapter.js'
import { EXP05_COMPOSITION_MODES } from './exp05LabParams.js'

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

/**
 * Exp05 Life → Explore stack.
 * Body / petals / particles share the C1 World surface evaluator (Explore framing).
 */
export default function ExploreLifeScene({
  life,
  lab = null,
  className = 'exp05-viewport',
  /** Temporary: visualize growth-site anchors + normals. */
  debugAnchors = false,
}) {
  const dpr = useStudiesDpr()
  const controlsRef = useRef(null)

  /* Composition toggles must NOT rebuild petal/particle plans — that remounts
   * InstancedMesh/Points and R3F would dispose the shared GPU material. */
  const visualLab = useMemo(
    () => ({
      petalDensity: lab?.petalDensity,
      petalScale: lab?.petalScale,
      particleDensity: lab?.particleDensity,
      particleMotion: lab?.particleMotion,
    }),
    [
      lab?.petalDensity,
      lab?.petalScale,
      lab?.particleDensity,
      lab?.particleMotion,
    ],
  )
  const visual = useMemo(
    () => mapLifeToExploreVisual(life, visualLab),
    [life, visualLab],
  )
  /* AGE owns birth→mature reveal; morphologyComplexity amplifies radiusAt lobes. */
  const morphStrength = 1
  const lobeAmplitude = lab?.morphologyComplexity ?? 1
  const deformationStrength = lab?.macroDeformationStrength ?? 1
  const compositionMode =
    lab?.compositionMode ?? EXP05_COMPOSITION_MODES.FULL

  const [particlesReady, setParticlesReady] = useState(() => !isHeavyWebGLHost())
  useEffect(() => {
    if (!isHeavyWebGLHost()) {
      setParticlesReady(true)
      return undefined
    }
    setParticlesReady(false)
    let cancelled = false
    let inner = 0
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        if (!cancelled) setParticlesReady(true)
      })
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(outer)
      window.cancelAnimationFrame(inner)
    }
  }, [])

  const {
    age,
    isDead,
    surface,
    individuality,
    development,
    particle,
    petalPlan,
  } = visual

  const allowPetals =
    compositionMode === EXP05_COMPOSITION_MODES.FULL ||
    compositionMode === EXP05_COMPOSITION_MODES.BODY_PETALS
  const allowParticles =
    compositionMode === EXP05_COMPOSITION_MODES.FULL ||
    compositionMode === EXP05_COMPOSITION_MODES.BODY_PARTICLES

  /* Keep GPU trees mounted for the whole life — AGE / composition only
   * toggle visibility and reseat. Unmounting disposed shared materials. */
  const layersLive = !isDead && age < 0.995
  const showPetals =
    allowPetals && layersLive && (petalPlan?.petalCount ?? 0) > 0

  return (
    <WebGLCanvas
      className={className}
      camera={{ position: [0, 0, 6.2], fov: 30, near: 0.1, far: 2000 }}
      dpr={dpr}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0)
        gl.toneMapping = THREE.NoToneMapping
      }}
    >
      <LifeAgeClockBridge age={age} />
      <ExploreCamera active />
      <ExploreWorldBody
        life={life}
        surface={surface}
        individuality={individuality}
        development={development}
        isDead={isDead}
        bodyDepthWrite={!showPetals}
        morphStrength={morphStrength}
        deformationStrength={deformationStrength}
        lobeAmplitude={lobeAmplitude}
      />
      {layersLive ? (
        <group visible={allowPetals}>
          <ExploreLifeScatter
            life={life}
            petalPlan={petalPlan}
            morphStrength={morphStrength}
            deformationStrength={deformationStrength}
            lobeAmplitude={lobeAmplitude}
            surfaceSeed={individuality.seed}
            noiseScale={individuality.noiseScale}
            age={development.age}
            speed={development.speed}
            pulseSpeed={development.pulseSpeed}
            displacement={development.displacement}
            noiseAmount={development.noiseAmount}
            decayStart={0.8}
            decayScale={1.25}
            colorA={surface.colorA}
            colorB={surface.colorB}
            rimColor={surface.rimColor}
          />
        </group>
      ) : null}
      {layersLive && particlesReady ? (
        <group visible={allowParticles}>
          <ExploreWorldParticles
            life={life}
            count={particle.count}
            seed={particle.seed}
            surfaceSeed={individuality.seed}
            morphStrength={morphStrength}
            deformationStrength={deformationStrength}
            lobeAmplitude={lobeAmplitude}
            fieldThickness={particle.fieldThickness}
            pulseStrength={particle.pulseStrength}
            tintCool={surface.rimColor}
            tintWarm={individuality.accentColor}
            tintSoft={surface.colorA}
          />
        </group>
      ) : null}
      <GrowthSiteDebug
        life={life}
        morphStrength={morphStrength}
        deformationStrength={deformationStrength}
        lobeAmplitude={lobeAmplitude}
        enabled={debugAnchors}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableDamping
        autoRotate
        autoRotateSpeed={0.2}
        dampingFactor={0.06}
        minDistance={EXPLORE_MIN_DISTANCE}
        maxDistance={EXPLORE_MAX_DISTANCE}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI - 0.15}
      />
    </WebGLCanvas>
  )
}
