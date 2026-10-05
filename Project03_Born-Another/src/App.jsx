import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import AdjustBar from './AdjustBar.jsx'
import Hud from './Hud.jsx'
import Specimen from './Specimen.jsx'
import { ScatterField, INITIAL_SCATTER } from './scatter/index.js'
import { isShaderMode } from './modes.js'
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
  const [modeId, setModeId] = useState('shader')
  const [studyId, setStudyId] = useState('surface')
  const [surface, setSurface] = useState(INITIAL_SURFACE)
  const [individuality, setIndividuality] = useState(INITIAL_INDIVIDUALITY)
  const [development, setDevelopment] = useState(INITIAL_DEVELOPMENT)
  const [decay, setDecay] = useState(INITIAL_DECAY)
  const [trace, setTrace] = useState(INITIAL_TRACE)
  const [material, setMaterial] = useState(INITIAL_MATERIAL)
  const [layered, setLayered] = useState(INITIAL_LAYERED)
  const [scatter, setScatter] = useState(INITIAL_SCATTER)
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

  const params = !isShaderMode(modeId)
    ? modeId === 'scatter'
      ? scatter
      : {}
    : study.id === 'individuality'
      ? individuality
      : study.id === 'development'
        ? development
        : study.id === 'decay'
          ? decay
          : study.id === 'trace'
            ? trace
            : study.id === 'lifecycle'
              ? { age: development.age }
              : study.id === 'layered'
                ? { ...layered, age: development.age }
                : isMaterialLifecycleStudy(study.id)
                  ? { ...material, age: development.age }
                  : surface

  const age = isLifecycleStudy(study.id)
    ? development.age
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

  function selectMode(nextId) {
    if (nextId !== 'shader') setAnimating(false)
    setModeId(nextId)
  }

  function selectStudy(nextId) {
    if (nextId === 'lifecycle' || isMaterialLifecycleStudy(nextId) || nextId === 'layered') {
      setSharedAge(development.age, { force: true })
      if (development.age < 1) {
        setIsDead(false)
        isDeadRef.current = false
      }
      const autoPlay = isMaterialLifecycleStudy(nextId) || nextId === 'layered'
      if (autoPlay && development.age >= 1) {
        setIsDead(false)
        isDeadRef.current = false
        setPreserved(null)
        setSharedAge(0, { force: true })
        setAnimating(true)
      } else if (autoPlay && !isDeadRef.current) {
        setAnimating(true)
      }
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
    if (!animating || !isShaderMode(modeId)) return undefined

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
  }, [animating, modeId])

  function updateParam(key, value) {
    if (!isShaderMode(modeId)) {
      if (modeId === 'scatter') {
        if (key === 'regenerate') {
          setScatter((current) => ({
            ...current,
            generation: current.generation + 1,
            seed: (current.seed * 1103515245 + 12345) >>> 0,
          }))
          return
        }
        setScatter((current) => ({ ...current, [key]: value }))
      }
      return
    }

    if (key === 'age') {
      if (isDeadRef.current && isLifecycleStudy(studyId)) return
      setAnimating(false)
      setSharedAge(value)
      return
    }
    if (study.id === 'layered') {
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
    if (!isShaderMode(modeId)) return
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

  const stage =
    isShaderMode(modeId) && isLifecycleStudy(study.id)
      ? lifecycleStage(isDead ? 1 : age)
      : null
  const lifecycleActive = isShaderMode(modeId) && isLifecycleStudy(study.id)

  // Non-shader modes keep a living development body as the shared base mesh.
  const viewportStudyId = isShaderMode(modeId) ? study.id : 'development'
  const viewportDead = lifecycleActive ? isDead : false

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
          studyId={viewportStudyId}
          surface={surface}
          individuality={individuality}
          development={development}
          decay={decay}
          trace={trace}
          material={material}
          layered={layered}
          preserved={preserved}
          isDead={viewportDead}
        />
        {modeId === 'scatter' ? (
          <ScatterField
            density={scatter.density}
            seed={scatter.seed}
            generation={scatter.generation}
            surfaceSeed={individuality.seed}
            noiseScale={individuality.noiseScale}
            age={development.age}
            speed={development.speed}
            pulseSpeed={development.pulseSpeed}
            displacement={development.displacement}
            noiseAmount={development.noiseAmount}
            colorA={surface.colorA}
            colorB={surface.colorB}
            rimColor={surface.rimColor}
          />
        ) : null}
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
        modeId={modeId}
        studyId={study.id}
        age={age}
        seed={individuality.seed}
        stage={stage}
        isDead={isDead && lifecycleActive}
        animating={animating}
        onSelectMode={selectMode}
        onSelectStudy={selectStudy}
        onToggleAnimate={toggleAnimate}
      />
      <AdjustBar modeId={modeId} study={study} params={params} onChange={updateParam} />
    </main>
  )
}
