import { useEffect, useMemo, useRef, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import WebGLCanvas from '../../WebGLCanvas.jsx'
import ExploreLifeScatter from '../finalForm/ExploreLifeScatter.jsx'
import ExploreWorldBody from '../finalForm/ExploreWorldBody.jsx'
import ExploreWorldParticles from '../finalForm/ExploreWorldParticles.jsx'
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
import { mapLifeToExploreVisual } from '../finalForm/exploreLifeAdapter.js'
import {
  EXP05_MATERIAL_MODES,
  normalizeExp05MaterialMode,
} from '../finalForm/exp05LabParams.js'
import {
  EXP05_ENV_TEMPERATURE_NEUTRAL,
  normalizeExp05Temperature,
} from '../finalForm/exp05EnvironmentCoupling.js'
import { EXP05_DEFAULT_MORPHOLOGY_TYPE } from '../finalForm/exp05MorphologyTypes.js'
import CrystalFormation from './CrystalFormation.jsx'

function useStudiesDpr(maxPixels = STUDIES_MAX_PIXELS) {
  const [dpr, setDpr] = useState(() => {
    if (typeof window === 'undefined') return 1
    return resolveRenderDpr(window.innerWidth, window.innerHeight, window.devicePixelRatio, maxPixels)
  })
  useEffect(() => {
    const update = () =>
      setDpr(resolveRenderDpr(window.innerWidth, window.innerHeight, window.devicePixelRatio, maxPixels))
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

/** Full Appearance only: transparent clear so the Exp05 page backdrop shows. */
function TransparentStage() {
  useFrame(({ gl }) => {
    gl.toneMapping = THREE.NoToneMapping
    gl.setClearColor(0x000000, 0)
  })
  return null
}

/**
 * Exp06 scene = the Exp05 Life → Explore organism (same body, petals,
 * particles, surface evaluator) + a crystal layer that grows on it.
 * crystalLevel (throttled React state) calms the membrane as it freezes;
 * crystalRef (per-frame) drives the lattice itself.
 */
export default function CrystalLifeScene({
  life,
  lab = null,
  crystalRef,
  crystalLevel = 0,
  layers,
  className = 'exp05-viewport',
}) {
  const dpr = useStudiesDpr()

  const visualLab = useMemo(
    () => ({
      petalDensity: lab?.petalDensity,
      petalScale: lab?.petalScale,
      particleDensity: lab?.particleDensity,
      particleMotion: lab?.particleMotion,
    }),
    [lab?.petalDensity, lab?.petalScale, lab?.particleDensity, lab?.particleMotion],
  )
  const visual = useMemo(() => mapLifeToExploreVisual(life, visualLab), [life, visualLab])

  const morphStrength = 1
  const lobeAmplitude = lab?.morphologyComplexity ?? 1
  const deformationStrength = lab?.macroDeformationStrength ?? 1
  const sculpturalStrength = lab?.sculpturalStrength ?? 0
  const morphologyType = lab?.morphologyType ?? EXP05_DEFAULT_MORPHOLOGY_TYPE
  const materialMode = normalizeExp05MaterialMode(lab?.materialMode ?? EXP05_MATERIAL_MODES.PEARLESCENT)
  const opticalDensity = lab?.opticalDensity ?? 1.2
  const thicknessContrast = lab?.thicknessContrast ?? 1.15
  const temperature = normalizeExp05Temperature(lab?.temperature ?? EXP05_ENV_TEMPERATURE_NEUTRAL)

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

  const { age, isDead, surface, individuality, development, particle, petalPlan } = visual

  /* Freezing calms the membrane: surface noise fades as the lattice sets. */
  const frozenDevelopment = useMemo(
    () => ({
      ...development,
      noiseAmount: development.noiseAmount * (1 - 0.75 * crystalLevel),
    }),
    [development, crystalLevel],
  )

  const layersLive = !isDead && age < 0.995
  const showPetals = layers?.petals !== false && layersLive && (petalPlan?.petalCount ?? 0) > 0
  const moisture = life?.environment?.moisture ?? 0.5
  const turbulence = life?.environment?.turbulence ?? 0

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
      <TransparentStage />
      <ExploreCamera active />
      <ExploreWorldBody
        life={life}
        surface={surface}
        individuality={individuality}
        development={frozenDevelopment}
        isDead={isDead}
        bodyDepthWrite={!showPetals}
        morphStrength={morphStrength}
        deformationStrength={deformationStrength}
        lobeAmplitude={lobeAmplitude}
        morphologyType={morphologyType}
        materialMode={materialMode}
        temperature={temperature}
        sculpturalStrength={sculpturalStrength}
        opticalDensity={opticalDensity}
        thicknessContrast={thicknessContrast}
      />
      {layersLive ? (
        <group visible={layers?.petals !== false}>
          <ExploreLifeScatter
            life={life}
            petalPlan={petalPlan}
            morphStrength={morphStrength}
            deformationStrength={deformationStrength}
            lobeAmplitude={lobeAmplitude}
            morphologyType={morphologyType}
            temperature={temperature}
            sculpturalStrength={sculpturalStrength}
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
        <ExploreWorldParticles
          life={life}
          count={particle.count}
          seed={particle.seed}
          surfaceSeed={individuality.seed}
          morphStrength={morphStrength}
          deformationStrength={deformationStrength}
          lobeAmplitude={lobeAmplitude}
          morphologyType={morphologyType}
          temperature={temperature}
          sculpturalStrength={sculpturalStrength}
          fieldThickness={particle.fieldThickness}
          pulseStrength={particle.pulseStrength}
          tintCool="#f4f7fb"
          tintWarm="#eef2f7"
          tintSoft="#ffffff"
        />
      ) : null}
      {!isDead ? (
        <CrystalFormation
          life={life}
          crystalRef={crystalRef}
          layers={layers}
          moisture={moisture}
          turbulence={turbulence}
          morphStrength={morphStrength}
          deformationStrength={deformationStrength}
          lobeAmplitude={lobeAmplitude}
          morphologyType={morphologyType}
          temperature={temperature}
          sculpturalStrength={sculpturalStrength}
        />
      ) : null}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        autoRotate={layers?.orbit !== false}
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
