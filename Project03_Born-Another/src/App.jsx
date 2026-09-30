import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import AdjustBar from './AdjustBar.jsx'
import Hud from './Hud.jsx'
import LayeredBody from './LayeredBody.jsx'
import Specimen from './Specimen.jsx'
import {
  INITIAL_DECAY,
  INITIAL_DEVELOPMENT,
  INITIAL_INDIVIDUALITY,
  INITIAL_LAYERED,
  INITIAL_MATERIAL,
  INITIAL_SURFACE,
  INITIAL_TRACE,
  LIFE_DURATION,
  PRESERVE_AGE,
  STUDIES,
  applyMaterialClarity,
  isLifecycleStudy,
  isMaterialLifecycleStudy,
  lifecycleStage,
  materialFromFamily,
} from './surfaceParams.js'

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
  const [material, setMaterial] = useState(INITIAL_MATERIAL)
  const [layered, setLayered] = useState(INITIAL_LAYERED)
  const [preserved, setPreserved] = useState(null)
  const [animating, setAnimating] = useState(false)
  const [isDead, setIsDead] = useState(false)

  const study = STUDIES.find((item) => item.id === studyId) ?? STUDIES[0]
  const individualityRef = useRef(individuality)
  const decayRef = useRef(decay)
  const isDeadRef = useRef(isDead)
  individualityRef.current = individuality
  decayRef.current = decay
  isDeadRef.current = isDead

  const params =
    study.id === 'individuality'
      ? individuality
      : study.id === 'development'
        ? development
        : study.id === 'decay'
          ? decay
          : study.id === 'trace'
            ? trace
            : study.id === 'lifecycle'
              ? { age: development.age }
              : isMaterialLifecycleStudy(study.id)
                ? { ...material, age: development.age }
                : study.id === 'layered'
                  ? layered
                  : surface

  const age =
    isLifecycleStudy(study.id)
      ? development.age
      : study.id === 'layered'
        ? layered.age
        : study.id === 'trace'
          ? trace.age
          : study.id === 'decay'
            ? decay.age
            : development.age
  const ageRef = useRef(age)
  ageRef.current = age

  function setSharedAge(nextAge, { force = false } = {}) {
    if (isDeadRef.current && !force && nextAge < ageRef.current) return

    const ageValue = Math.min(1, Math.max(0, nextAge))
    ageRef.current = ageValue
    setDevelopment((current) => ({ ...current, age: ageValue }))
    setDecay((current) => ({ ...current, age: ageValue }))
    setTrace((current) => ({ ...current, age: ageValue }))
    setLayered((current) => ({ ...current, age: ageValue }))

    if (ageValue >= PRESERVE_AGE) {
      setPreserved((current) =>
        current ?? captureTrace(individualityRef.current, decayRef.current, ageValue),
      )
    } else if (ageValue < 0.5 && !isDeadRef.current) {
      setPreserved(null)
    }

    if (ageValue >= 1) {
      setAnimating(false)
      setIsDead(true)
      isDeadRef.current = true
    }
  }

  function selectStudy(nextId) {
    if (nextId === 'lifecycle' || isMaterialLifecycleStudy(nextId)) {
      setSharedAge(development.age, { force: true })
      if (development.age < 1) {
        setIsDead(false)
        isDeadRef.current = false
      }
      if (isMaterialLifecycleStudy(nextId) && development.age >= 1) {
        setIsDead(false)
        isDeadRef.current = false
        setPreserved(null)
        setSharedAge(0, { force: true })
        setAnimating(true)
      } else if (isMaterialLifecycleStudy(nextId) && !isDeadRef.current) {
        setAnimating(true)
      }
    }
    if (nextId === 'layered') {
      // Full life scrub / Animate — start mid-life unless already playing a pass.
      setIsDead(false)
      isDeadRef.current = false
      setSharedAge(layered.age ?? 0.45, { force: true })
    }
    setStudyId(nextId)
  }

  useEffect(() => {
    if (studyId !== 'trace' && !isLifecycleStudy(studyId)) return
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
      if (isDeadRef.current) {
        setAnimating(false)
        return
      }
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const next = Math.min(1, ageRef.current + speed * dt)
      setSharedAge(next)
      if (next >= 1) return
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animating])

  function updateParam(key, value) {
    if (key === 'age') {
      if (isDeadRef.current && isLifecycleStudy(studyId)) return
      setAnimating(false)
      setSharedAge(value)
      return
    }
    if (study.id === 'layered') {
      if (key === 'mode') {
        setLayered((current) => ({ ...current, mode: value }))
        return
      }
      setLayered((current) => ({ ...current, [key]: value }))
      return
    }
    if (study.id === 'material' || study.id === 'behavior') {
      if (key === 'family') {
        setMaterial(materialFromFamily(value))
        return
      }
      if (key === 'clarity') {
        setMaterial((current) => applyMaterialClarity(current, value))
        return
      }
      setMaterial((current) => ({ ...current, [key]: value }))
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

  function startNewLife() {
    setIsDead(false)
    isDeadRef.current = false
    setPreserved(null)
    setSharedAge(0, { force: true })
    setAnimating(true)
  }

  function toggleAnimate() {
    if (isLifecycleStudy(studyId) && isDeadRef.current) {
      startNewLife()
      return
    }
    if (animating) {
      setAnimating(false)
      return
    }
    if (ageRef.current >= 0.999) {
      if (isLifecycleStudy(studyId)) {
        startNewLife()
        return
      }
      setIsDead(false)
      isDeadRef.current = false
      setSharedAge(0, { force: true })
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

  const stage = isLifecycleStudy(study.id) ? lifecycleStage(isDead ? 1 : age) : null
  const lifecycleActive = isLifecycleStudy(study.id)

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
        {study.id === 'layered' ? (
          <LayeredBody
            seed={individuality.seed}
            age={layered.age}
            mode={layered.mode}
            outerOpacity={layered.outerOpacity}
            innerScale={layered.innerScale}
            innerContrast={layered.innerContrast}
            outerColorA={layered.outerColorA}
            outerColorB={layered.outerColorB}
            outerRimColor={layered.outerRimColor}
            innerColorA={layered.innerColorA}
            innerColorB={layered.innerColorB}
          />
        ) : (
          <Specimen
            studyId={study.id}
            surface={surface}
            individuality={individuality}
            development={development}
            decay={decay}
            trace={trace}
            material={material}
            preserved={preserved}
            isDead={lifecycleActive ? isDead : false}
          />
        )}
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
        stage={stage}
        isDead={isDead && lifecycleActive}
        animating={animating}
        onSelectStudy={selectStudy}
        onToggleAnimate={toggleAnimate}
      />
      <AdjustBar study={study} params={params} onChange={updateParam} />
    </main>
  )
}
