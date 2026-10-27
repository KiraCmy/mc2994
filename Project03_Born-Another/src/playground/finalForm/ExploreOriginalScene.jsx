import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import Specimen from '../../Specimen.jsx'
import WebGLCanvas from '../../WebGLCanvas.jsx'
import { ScatterField, INITIAL_SCATTER } from '../../scatter/index.js'
import { ParticleField, INITIAL_PARTICLE } from '../../particle/index.js'
import {
  ExploreCamera,
  EXPLORE_MAX_DISTANCE,
  EXPLORE_MIN_DISTANCE,
} from '../../explore/index.js'
import { syncAgeClock } from '../../ageClock.js'
import {
  INITIAL_DECAY,
  INITIAL_DEVELOPMENT,
  INITIAL_INDIVIDUALITY,
  INITIAL_LAYERED,
  INITIAL_MATERIAL,
  INITIAL_SURFACE,
  INITIAL_TRACE,
  LIFE_DURATION,
} from '../../surfaceParams.js'
import {
  isHeavyWebGLHost,
  resolveRenderDpr,
  STUDIES_MAX_PIXELS,
} from '../../renderBudget.js'

const AGE_UI_INTERVAL_MS = 50
/** Mature Explore look matching Studies screenshots (petals + grit fully present). */
const OBSERVE_AGE = 0.45

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

/**
 * Faithful Studies → Explore visual stack for Experiment 05 Stage A.
 * Reuses Specimen / ScatterField / ParticleField / ExploreCamera unchanged.
 * No Life Engine. Own AGE / Animate state — isolated from Studies and from
 * Life-Driven Prototype (only this Canvas is mounted when the mode is active).
 */
export default function ExploreOriginalScene({
  className = 'exp05-viewport',
  onAgeChange = null,
  onApiChange = null,
}) {
  const dpr = useStudiesDpr()
  const controlsRef = useRef(null)
  const ageRef = useRef(OBSERVE_AGE)
  const isDeadRef = useRef(false)

  const [surface] = useState(INITIAL_SURFACE)
  const [individuality] = useState(INITIAL_INDIVIDUALITY)
  const [development, setDevelopment] = useState(() => ({
    ...INITIAL_DEVELOPMENT,
    age: OBSERVE_AGE,
  }))
  const [decay, setDecay] = useState(() => ({
    ...INITIAL_DECAY,
    age: OBSERVE_AGE,
  }))
  const [trace] = useState(INITIAL_TRACE)
  const [material] = useState(INITIAL_MATERIAL)
  const [layered] = useState(INITIAL_LAYERED)
  const [scatter] = useState(INITIAL_SCATTER)
  const [particle] = useState(INITIAL_PARTICLE)
  const [preserved] = useState(null)
  const [isDead, setIsDead] = useState(false)
  const [animating, setAnimating] = useState(false)

  const setSharedAge = useCallback(
    (ageValue, { force = false } = {}) => {
      const next = Math.min(1, Math.max(0, Number(ageValue) || 0))
      ageRef.current = next
      syncAgeClock(next)
      setDevelopment((current) =>
        force || current.age !== next ? { ...current, age: next } : current,
      )
      setDecay((current) =>
        force || current.age !== next ? { ...current, age: next } : current,
      )
      onAgeChange?.(next)
      if (next >= 1) {
        setAnimating(false)
        setIsDead(true)
        isDeadRef.current = true
      }
    },
    [onAgeChange],
  )

  useEffect(() => {
    syncAgeClock(OBSERVE_AGE)
    onAgeChange?.(OBSERVE_AGE)
    return () => {
      setAnimating(false)
    }
  }, [onAgeChange])

  useEffect(() => {
    if (!animating) return undefined
    let frame = 0
    let last = performance.now()
    let lastUi = 0
    const speed = 1 / LIFE_DURATION

    const tick = (now) => {
      if (isDeadRef.current) {
        setAnimating(false)
        return
      }
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const next = Math.min(1, ageRef.current + speed * dt)
      ageRef.current = next
      syncAgeClock(next)
      if (next >= 1 || now - lastUi >= AGE_UI_INTERVAL_MS) {
        lastUi = now
        setSharedAge(next)
      }
      if (next < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animating, setSharedAge])

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

  const showScatter = !isDead && development.age < 0.995
  const showParticles = !isDead && development.age < 0.995 && particlesReady

  const api = useMemo(
    () => ({
      age: development.age,
      animating,
      isDead,
      play: () => {
        if (isDeadRef.current || ageRef.current >= 1) {
          isDeadRef.current = false
          setIsDead(false)
          setSharedAge(0, { force: true })
        }
        setAnimating(true)
      },
      pause: () => setAnimating(false),
      toggle: () => {
        setAnimating((current) => {
          if (current) return false
          if (isDeadRef.current || ageRef.current >= 1) {
            isDeadRef.current = false
            setIsDead(false)
            setSharedAge(0, { force: true })
          }
          return true
        })
      },
      reset: () => {
        isDeadRef.current = false
        setIsDead(false)
        setAnimating(false)
        setSharedAge(OBSERVE_AGE, { force: true })
      },
      seek: (age) => {
        setAnimating(false)
        if (age < 1) {
          isDeadRef.current = false
          setIsDead(false)
        }
        setSharedAge(age, { force: true })
      },
    }),
    [animating, development.age, isDead, setSharedAge],
  )

  useEffect(() => {
    onApiChange?.(api)
    return () => onApiChange?.(null)
  }, [api, onApiChange])

  return (
    <WebGLCanvas
      className={className}
      camera={{ position: [0, 0, 6.2], fov: 30, near: 0.1, far: 2000 }}
      dpr={dpr}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0)
      }}
    >
      <ExploreCamera active />
      <Specimen
        studyId="lifecycle"
        surface={surface}
        individuality={individuality}
        development={development}
        decay={decay}
        trace={trace}
        material={material}
        layered={layered}
        preserved={preserved}
        isDead={isDead}
        bodyDepthWrite={!showScatter}
      />
      {showScatter ? (
        <ScatterField
          growthType={scatter.growthType}
          density={scatter.density}
          size={scatter.size}
          seed={scatter.seed}
          generation={scatter.generation}
          surfaceSeed={individuality.seed}
          noiseScale={individuality.noiseScale}
          age={development.age}
          speed={development.speed}
          pulseSpeed={development.pulseSpeed}
          displacement={development.displacement}
          noiseAmount={development.noiseAmount}
          decayStart={decay.decayStart}
          decayScale={decay.decayScale}
          colorA={surface.colorA}
          colorB={surface.colorB}
          rimColor={surface.rimColor}
        />
      ) : null}
      {showParticles ? (
        <ParticleField
          count={particle.count}
          explore
          seed={particle.seed}
          fieldThickness={particle.fieldThickness}
          fieldComplexity={particle.fieldComplexity}
          trailLength={particle.trailLength}
          sizeVariation={particle.sizeVariation}
          brightnessVariation={particle.brightnessVariation}
          colorInfluence={particle.colorInfluence}
          pulseStrength={particle.pulseStrength}
          tintCool={surface.rimColor}
          tintWarm={individuality.accentColor}
          tintSoft={surface.colorA}
          surfaceSeed={individuality.seed}
          noiseScale={individuality.noiseScale}
          age={development.age}
          speed={development.speed}
          pulseSpeed={development.pulseSpeed}
          displacement={development.displacement}
          noiseAmount={development.noiseAmount}
          decayScale={decay.decayScale}
          decayDisplacement={decay.decayDisplacement}
          lateWarp={material.lateWarp}
        />
      ) : null}
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
