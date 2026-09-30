import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import AdjustBar from './AdjustBar.jsx'
import Hud from './Hud.jsx'
import Specimen from './Specimen.jsx'
import {
  INITIAL_DECAY,
  INITIAL_DEVELOPMENT,
  INITIAL_INDIVIDUALITY,
  INITIAL_SURFACE,
  INITIAL_TRACE,
  STUDIES,
} from './surfaceParams.js'

/** Seconds for a full Birth → Death pass. */
const LIFE_DURATION = 16
const PRESERVE_AGE = 0.95

function captureTrace(individuality, decay, age) {
  return {
    seed: individuality.seed,
    noiseScale: individuality.noiseScale,
    accentColor: individuality.accentColor,
    decayScale: decay.decayScale,
    decayStart: decay.decayStart,
    decayDisplacement: decay.decayDisplacement,
    preservedAge: age,
  }
}

export default function App() {
  const [studyId, setStudyId] = useState('surface')
  const [surface, setSurface] = useState(INITIAL_SURFACE)
  const [individuality, setIndividuality] = useState(INITIAL_INDIVIDUALITY)
  const [development, setDevelopment] = useState(INITIAL_DEVELOPMENT)
  const [decay, setDecay] = useState(INITIAL_DECAY)
  const [trace, setTrace] = useState(INITIAL_TRACE)
  const [preserved, setPreserved] = useState(null)
  const [animating, setAnimating] = useState(false)

  const study = STUDIES.find((item) => item.id === studyId) ?? STUDIES[0]
  const individualityRef = useRef(individuality)
  const decayRef = useRef(decay)
  individualityRef.current = individuality
  decayRef.current = decay

  const params =
    study.id === 'individuality'
      ? individuality
      : study.id === 'development'
        ? development
        : study.id === 'decay'
          ? decay
          : study.id === 'trace'
            ? trace
            : surface

  const age =
    study.id === 'trace' ? trace.age : study.id === 'decay' ? decay.age : development.age
  const ageRef = useRef(age)
  ageRef.current = age

  function setSharedAge(nextAge) {
    const ageValue = Math.min(1, Math.max(0, nextAge))
    ageRef.current = ageValue
    setDevelopment((current) => ({ ...current, age: ageValue }))
    setDecay((current) => ({ ...current, age: ageValue }))
    setTrace((current) => ({ ...current, age: ageValue }))

    if (ageValue >= PRESERVE_AGE) {
      setPreserved((current) =>
        current ?? captureTrace(individualityRef.current, decayRef.current, ageValue),
      )
    } else if (ageValue < 0.5) {
      setPreserved(null)
    }
  }

  useEffect(() => {
    if (studyId !== 'trace') return
    if (ageRef.current < PRESERVE_AGE) return
    setPreserved(
      (current) =>
        current ?? captureTrace(individualityRef.current, decayRef.current, ageRef.current),
    )
  }, [studyId])

  useEffect(() => {
    if (!animating) return undefined

    let frame = 0
    let last = performance.now()
    const speed = 1 / LIFE_DURATION

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const next = Math.min(1, ageRef.current + speed * dt)
      setSharedAge(next)
      if (next >= 1) {
        setAnimating(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animating])

  function updateParam(key, value) {
    if (key === 'age') {
      setAnimating(false)
      setSharedAge(value)
      return
    }
    if (study.id === 'individuality') {
      setIndividuality((current) => ({ ...current, [key]: value }))
      return
    }
    if (study.id === 'development') {
      setDevelopment((current) => ({ ...current, [key]: value }))
      return
    }
    if (study.id === 'decay') {
      setDecay((current) => ({ ...current, [key]: value }))
      return
    }
    if (study.id === 'trace') {
      setTrace((current) => ({ ...current, [key]: value }))
      return
    }
    setSurface((current) => ({ ...current, [key]: value }))
  }

  function toggleAnimate() {
    if (animating) {
      setAnimating(false)
      return
    }
    if (ageRef.current >= 0.999) {
      setSharedAge(0)
    }
    setAnimating(true)
  }

  const toggleAnimateRef = useRef(toggleAnimate)
  toggleAnimateRef.current = toggleAnimate

  useEffect(() => {
    function onKeyDown(event) {
      if (event.code !== 'Space' && event.key !== ' ') return
      if (event.repeat) return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return
      event.preventDefault()
      toggleAnimateRef.current()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <main className="stage">
      <Canvas
        className="viewport"
        camera={{ position: [0, 0, 6.2], fov: 30 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
        }}
      >
        <Specimen
          studyId={study.id}
          surface={surface}
          individuality={individuality}
          development={development}
          decay={decay}
          trace={trace}
          preserved={preserved}
        />
        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          minDistance={4.2}
          maxDistance={8.5}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI - 0.35}
        />
      </Canvas>
      <Hud
        studyId={study.id}
        age={age}
        seed={individuality.seed}
        animating={animating}
        onSelectStudy={setStudyId}
        onToggleAnimate={toggleAnimate}
      />
      <AdjustBar study={study} params={params} onChange={updateParam} />
    </main>
  )
}
