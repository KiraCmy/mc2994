import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import AdjustBar from './AdjustBar.jsx'
import ConceptPage from './concept/ConceptPage.jsx'
import Hud from './Hud.jsx'
import SiteHeader from './SiteHeader.jsx'
import Specimen from './Specimen.jsx'
import SystemPage from './system/SystemPage.jsx'
import WebGLCanvas from './WebGLCanvas.jsx'

const PlaygroundPage = lazy(() =>
  import('./playground/index.js').then((mod) => ({ default: mod.PlaygroundPage })),
)
const MemoryLabPage = lazy(() =>
  import('./memoryLab/index.js').then((mod) => ({ default: mod.MemoryLabPage })),
)
import { ScatterField, INITIAL_SCATTER } from './scatter/index.js'
import { PathField, INITIAL_PATH } from './path/index.js'
import { ParticleField, INITIAL_PARTICLE } from './particle/index.js'
import { LSystemField, INITIAL_LSYSTEM } from './lsystem/index.js'
import {
  CrystalDemo,
  INITIAL_ORGANISM_MATERIAL,
  ORIGINAL_DEMO_OPTICAL,
  OrganismStudio,
} from './material/index.js'
import WorldV2 from './worldv2/WorldV2.jsx'
import {
  ExploreCamera,
  EXPLORE_MAX_DISTANCE,
  EXPLORE_MIN_DISTANCE,
  DEFAULT_MAX_DISTANCE,
  DEFAULT_MIN_DISTANCE,
} from './explore/index.js'
import {
  appRouteHash,
  DEFAULT_STUDY_MODE,
  isShaderMode,
  isStudyMode,
  parseAppRoute,
} from './modes.js'
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
import { syncAgeClock } from './ageClock.js'
import {
  isHeavyWebGLHost,
  isWindowsHost,
  resolveRenderDpr,
  STUDIES_MAX_PIXELS,
} from './renderBudget.js'
import {
  BA_BUILD_ID,
  particleDiag,
  readBaDiagMode,
  updateDiagBadge,
} from './particleDiag.js'

const DEFAULT_CAMERA_DISTANCE = 6.2
// Age 0.5 morphology is several times the Study 01 sphere. 8.5 crops it into the UI.
const MATERIAL_CAMERA_DISTANCE = 14.5
const MATERIAL_MAX_DISTANCE = 24
/** React HUD / slider AGE commits while Animate runs (GPU uses ageClock every frame). */
const AGE_UI_INTERVAL_MS = 50

/** Cap WebGL backbuffer megapixels so 4K windows match typical MacBook load. */
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

/** Pull back on the Material tab so the deformed organism clears the UI. */
function MaterialFraming({ active }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  const framed = useRef(false)

  useLayoutEffect(() => {
    if (!controls || !('target' in controls)) return
    if (active && !framed.current) {
      controls.maxDistance = Math.max(controls.maxDistance ?? 0, MATERIAL_CAMERA_DISTANCE)
      const offset = camera.position.clone().sub(controls.target)
      if (offset.lengthSq() < 1e-8) offset.set(0, 0, 1)
      offset.setLength(MATERIAL_CAMERA_DISTANCE)
      camera.position.copy(controls.target).add(offset)
      controls.update()
      framed.current = true
    } else if (!active && framed.current) {
      const offset = camera.position.clone().sub(controls.target)
      if (offset.lengthSq() < 1e-8) offset.set(0, 0, 1)
      offset.setLength(DEFAULT_CAMERA_DISTANCE)
      camera.position.copy(controls.target).add(offset)
      controls.update()
      framed.current = false
    }
  }, [active, camera, controls])

  return null
}

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

const INITIAL_ROUTE = parseAppRoute(
  typeof window === 'undefined' ? '' : window.location.hash,
)

export default function App() {
  const [modeId, setModeId] = useState(INITIAL_ROUTE.modeId)
  const [lastStudyMode, setLastStudyMode] = useState(
    isStudyMode(INITIAL_ROUTE.modeId) ? INITIAL_ROUTE.modeId : DEFAULT_STUDY_MODE,
  )
  const [studyId, setStudyId] = useState(
    STUDIES.some((item) => item.id === INITIAL_ROUTE.studyId)
      ? INITIAL_ROUTE.studyId
      : 'surface',
  )
  const [surface, setSurface] = useState(INITIAL_SURFACE)
  const [individuality, setIndividuality] = useState(INITIAL_INDIVIDUALITY)
  const [development, setDevelopment] = useState(INITIAL_DEVELOPMENT)
  const [decay, setDecay] = useState(INITIAL_DECAY)
  const [trace, setTrace] = useState(INITIAL_TRACE)
  const [material, setMaterial] = useState(INITIAL_MATERIAL)
  const [layered, setLayered] = useState(INITIAL_LAYERED)
  const [scatter, setScatter] = useState(INITIAL_SCATTER)
  const [path, setPath] = useState(INITIAL_PATH)
  const [particle, setParticle] = useState(INITIAL_PARTICLE)
  const [lsystem, setLsystem] = useState(INITIAL_LSYSTEM)
  const [organismMaterial, setOrganismMaterial] = useState(INITIAL_ORGANISM_MATERIAL)
  const [preserved, setPreserved] = useState(null)
  const [animating, setAnimating] = useState(false)
  const [isDead, setIsDead] = useState(false)
  const controlsRef = useRef(null)
  const lsystemLifeStartedRef = useRef(false)
  const studiesDpr = useStudiesDpr()

  const study = STUDIES.find((item) => item.id === studyId) ?? STUDIES[0]
  const individualityRef = useRef(individuality)
  const decayRef = useRef(decay)
  const isDeadRef = useRef(isDead)
  individualityRef.current = individuality
  decayRef.current = decay
  isDeadRef.current = isDead

  const params = !isShaderMode(modeId)
    ? modeId === 'scatter'
      ? { ...scatter, age: development.age }
      : modeId === 'path'
        ? { ...path, age: development.age }
        : modeId === 'particle'
          ? { ...particle, age: development.age }
          : modeId === 'explore'
            ? { age: development.age }
            : modeId === 'lsystem'
              ? { ...lsystem, age: development.age }
              : modeId === 'material'
                ? { ...organismMaterial, age: development.age }
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
  syncAgeClock(age)

  function setSharedAge(nextAge, { force = false } = {}) {
    if (isDeadRef.current && !force && nextAge < ageRef.current) return

    const ageValue = Math.min(1, Math.max(0, nextAge))
    ageRef.current = ageValue
    syncAgeClock(ageValue)
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
    const targetId = nextId === 'studies' ? lastStudyMode : nextId
    // Keep the age clock available in living modes; stop it elsewhere.
    if (
      !isStudyMode(targetId)
    ) {
      setAnimating(false)
    }
    if (targetId !== 'path') {
      setPath((current) =>
        current.drawing ? { ...current, drawing: false } : current,
      )
    }
    if (targetId === 'lsystem' && targetId !== modeId) {
      lsystemLifeStartedRef.current = false
    }
    if (isStudyMode(targetId)) setLastStudyMode(targetId)
    setModeId(targetId)
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
    if (!animating) return undefined
    if (
      !isShaderMode(modeId) &&
      modeId !== 'scatter' &&
      modeId !== 'path' &&
      modeId !== 'particle' &&
      modeId !== 'explore' &&
      modeId !== 'lsystem' &&
      modeId !== 'material'
    ) {
      return undefined
    }

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
      // GPU reads ageClock every frame; React HUD updates at a lower rate.
      if (next >= 1 || now - lastUi >= AGE_UI_INTERVAL_MS) {
        lastUi = now
        setSharedAge(next)
      }
      if (next >= 1) return
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      // Keep GPU clock in sync; avoid setState in effect cleanup (Strict Mode).
      syncAgeClock(ageRef.current)
    }
  }, [animating, modeId])

  function updateParam(key, value) {
    if (key === 'seed') {
      setIndividuality((current) => ({
        ...current,
        seed: Math.max(0, Math.round(Number(value) || 0)),
      }))
      return
    }
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
        if (key === 'age') {
          setAnimating(false)
          if (value < 1) {
            setIsDead(false)
            isDeadRef.current = false
          }
          setSharedAge(value, { force: true })
          return
        }
        setScatter((current) => ({ ...current, [key]: value }))
        return
      }
      if (modeId === 'path') {
        if (key === 'clear') {
          setPath((current) => ({ ...current, strokes: [] }))
          return
        }
        if (key === 'draw') {
          setPath((current) => ({ ...current, drawing: !current.drawing }))
          return
        }
        if (key === 'age') {
          setAnimating(false)
          if (value < 1) {
            setIsDead(false)
            isDeadRef.current = false
          }
          setSharedAge(value, { force: true })
          return
        }
        setPath((current) => ({ ...current, [key]: value }))
        return
      }
      if (modeId === 'particle') {
        if (key === 'age') {
          setAnimating(false)
          if (value < 1) {
            setIsDead(false)
            isDeadRef.current = false
          }
          setSharedAge(value, { force: true })
          return
        }
        if (key === 'count') {
          setParticle((current) => ({
            ...current,
            count: Math.round(value),
          }))
          return
        }
        setParticle((current) => ({ ...current, [key]: value }))
        return
      }
      if (modeId === 'explore') {
        if (key === 'age') {
          setAnimating(false)
          if (value < 1) {
            setIsDead(false)
            isDeadRef.current = false
          }
          setSharedAge(value, { force: true })
        }
        return
      }
      if (modeId === 'lsystem') {
        if (key === 'age') {
          lsystemLifeStartedRef.current = false
          setAnimating(false)
          if (value < 1) {
            setIsDead(false)
            isDeadRef.current = false
          }
          setSharedAge(value, { force: true })
          return
        }
        if (key === 'depth') {
          setLsystem((current) => ({
            ...current,
            depth: Math.round(value),
          }))
          return
        }
        if (key === 'debug') {
          setLsystem((current) => ({
            ...current,
            showDebug: !current.showDebug,
          }))
          return
        }
        setLsystem((current) => ({ ...current, [key]: value }))
        return
      }
      if (modeId === 'material') {
        if (key === 'mask') {
          setOrganismMaterial((current) => ({ ...current, showMask: !current.showMask }))
          return
        }
        if (key === 'checker') {
          setOrganismMaterial((current) => ({ ...current, showChecker: !current.showChecker }))
          return
        }
        if (key === 'age') {
          setAnimating(false)
          if (value < 1) {
            setIsDead(false)
            isDeadRef.current = false
          }
          setSharedAge(value, { force: true })
          return
        }
        setOrganismMaterial((current) => ({ ...current, [key]: value }))
        return
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
    if (
      !isShaderMode(modeId) &&
      modeId !== 'scatter' &&
      modeId !== 'path' &&
      modeId !== 'particle' &&
      modeId !== 'explore' &&
      modeId !== 'lsystem' &&
      modeId !== 'material'
    ) {
      return
    }
    const surfaceLife =
      modeId === 'scatter' ||
      modeId === 'path' ||
      modeId === 'particle' ||
      modeId === 'explore' ||
      modeId === 'lsystem' ||
      modeId === 'material'
    if ((isLifecycleStudy(studyId) || surfaceLife) && isDeadRef.current) {
      startNewLife()
      return
    }
    if (animating) {
      setAnimating(false)
      return
    }
    // L-System: the first press plays the whole life from birth; later presses resume.
    if (modeId === 'lsystem' && !lsystemLifeStartedRef.current) {
      lsystemLifeStartedRef.current = true
      startNewLife()
      return
    }
    if (ageRef.current >= 0.999) {
      if (isLifecycleStudy(studyId) || surfaceLife) {
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
  const selectModeRef = useRef(selectMode)
  selectModeRef.current = selectMode
  const modeIdRef = useRef(modeId)
  modeIdRef.current = modeId

  useEffect(() => {
    function onKeyDown(event) {
      if (event.code !== 'Space' && event.key !== ' ') return
      if (event.repeat) return
      // Concept / System / Playground / Memory Lab keep Space for native scrolling; World owns its own clock.
      if (
        modeIdRef.current === 'concept' ||
        modeIdRef.current === 'system' ||
        modeIdRef.current === 'playground' ||
        modeIdRef.current === 'memory-lab' ||
        modeIdRef.current === 'worldv2'
      ) {
        return
      }
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return
      event.preventDefault()
      toggleAnimateRef.current()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const next = appRouteHash(modeId, studyId)
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', `${window.location.pathname}${next}`)
    }
  }, [modeId, studyId])

  useEffect(() => {
    function onHashChange() {
      const route = parseAppRoute(window.location.hash)
      if (route.studyId && STUDIES.some((item) => item.id === route.studyId)) {
        setStudyId(route.studyId)
      }
      selectModeRef.current(route.modeId)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Leaving Explore — restore a normal organism framing band.
  // Material stays at MaterialFraming's distance, which is outside 4.2–8.5.
  useEffect(() => {
    if (modeId === 'explore') return
    const controls = controlsRef.current
    if (!controls?.object) return
    const cam = controls.object
    controls.target.set(0, 0, 0)
    const dist = cam.position.length()
    if (
      modeId !== 'material' &&
      (dist < DEFAULT_MIN_DISTANCE || dist > DEFAULT_MAX_DISTANCE)
    ) {
      cam.position.set(0, 0, 6.2)
    }
    cam.near = 0.1
    cam.far = 2000
    cam.updateProjectionMatrix()
    controls.update()
  }, [modeId])

  const scatterLifecycle = modeId === 'scatter'
  const pathLifecycle = modeId === 'path'
  const particleLifecycle = modeId === 'particle'
  const exploreMode = modeId === 'explore'
  const lsystemMode = modeId === 'lsystem'
  const materialMode = modeId === 'material'
  const originalDemo = materialMode && organismMaterial.optical === ORIGINAL_DEMO_OPTICAL
  const surfaceLifecycle =
    scatterLifecycle ||
    pathLifecycle ||
    particleLifecycle ||
    exploreMode ||
    lsystemMode ||
    materialMode
  const stage =
    (isShaderMode(modeId) && isLifecycleStudy(study.id)) || surfaceLifecycle
      ? lifecycleStage(isDead ? 1 : age)
      : null
  const lifecycleActive =
    (isShaderMode(modeId) && isLifecycleStudy(study.id)) || surfaceLifecycle

  // Non-shader modes reuse Study 06 lifecycle visuals on the shared body.
  const viewportStudyId = isShaderMode(modeId) ? study.id : 'lifecycle'
  const viewportDead = lifecycleActive ? isDead : false

  // Explore reuses Scatter + Particle; L-System grows on the base organism.
  // When ?baDiag= is set, skip Scatter on Explore so Particle isolation is clean.
  const baDiagMode = useMemo(() => readBaDiagMode(), [])
  useEffect(() => {
    updateDiagBadge(baDiagMode)
  }, [baDiagMode, modeId])

  const showOrganism = true
  const showScatterGrowths =
    (scatterLifecycle || (exploreMode && !baDiagMode)) &&
    !isDead &&
    development.age < 0.995
  const showPathDrawing = pathLifecycle && !isDead && development.age < 0.995
  const showParticles =
    (particleLifecycle || exploreMode) && !isDead && development.age < 0.995
  const showLSystem = lsystemMode && !isDead && development.age < 0.995

  // On Windows, defer mounting the particle field one tick so the tab
  // switch paints first. Diag mount/cpu skip defer (stubs are cheap).
  const [particlesReady, setParticlesReady] = useState(
    () => !isHeavyWebGLHost() || !!readBaDiagMode(),
  )
  useEffect(() => {
    if (!showParticles) {
      setParticlesReady(false)
      return undefined
    }
    particleDiag('App:showParticles', {
      buildId: BA_BUILD_ID,
      baDiag: baDiagMode || 'off',
      isWindowsHost: isWindowsHost(),
      isHeavyWebGLHost: isHeavyWebGLHost(),
      particleCountProp: particle.count,
      exploreMode,
    })
    if (baDiagMode === 'mount' || baDiagMode === 'cpu' || !isHeavyWebGLHost()) {
      particleDiag('App:particlesReady:immediate')
      setParticlesReady(true)
      return undefined
    }
    setParticlesReady(false)
    particleDiag('App:particlesReady:defer-start')
    // Two rAFs: let the Particle tab chrome paint before allocating the field.
    let cancelled = false
    let inner = 0
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        if (!cancelled) {
          particleDiag('App:particlesReady:defer-done')
          setParticlesReady(true)
        }
      })
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(outer)
      window.cancelAnimationFrame(inner)
    }
  }, [baDiagMode, exploreMode, particle.count, showParticles])

  const orbitMinDistance = originalDemo
    ? 4
    : exploreMode
      ? EXPLORE_MIN_DISTANCE
      : DEFAULT_MIN_DISTANCE
  const orbitMaxDistance = originalDemo
    ? 16
    : exploreMode
      ? EXPLORE_MAX_DISTANCE
      : materialMode
        ? MATERIAL_MAX_DISTANCE
        : DEFAULT_MAX_DISTANCE

  if (modeId === 'worldv2') {
    return <WorldV2 modeId={modeId} onSelectMode={selectMode} />
  }

  if (modeId === 'concept') {
    return (
      <main className="stage">
        <ConceptPage
          header={<SiteHeader modeId={modeId} onSelectMode={selectMode} />}
        />
      </main>
    )
  }

  if (modeId === 'system') {
    return (
      <main className="stage">
        <SystemPage
          header={<SiteHeader modeId={modeId} onSelectMode={selectMode} />}
        />
      </main>
    )
  }

  if (modeId === 'playground') {
    return (
      <main className="stage">
        <Suspense fallback={null}>
          <PlaygroundPage
            header={<SiteHeader modeId={modeId} onSelectMode={selectMode} />}
          />
        </Suspense>
      </main>
    )
  }

  if (modeId === 'memory-lab') {
    return (
      <main className="stage">
        <Suspense fallback={null}>
          <MemoryLabPage modeId={modeId} onSelectMode={selectMode} />
        </Suspense>
      </main>
    )
  }

  return (
    <main className="stage">
      <WebGLCanvas
        className="viewport"
        camera={{ position: [0, 0, 6.2], fov: 30, near: 0.1, far: 2000 }}
        dpr={studiesDpr}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
        }}
      >
        <ExploreCamera active={exploreMode} />
        <MaterialFraming active={materialMode} />
        {materialMode && !originalDemo ? (
          <OrganismStudio
            active
            showTransmissionTarget={organismMaterial.showChecker}
          />
        ) : null}
        {originalDemo ? <CrystalDemo /> : null}
        {showOrganism && !originalDemo ? (
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
            bodyDepthWrite={!showScatterGrowths && !showPathDrawing}
            pathStrokes={showPathDrawing ? path.strokes : null}
            pathGrowthStrength={showPathDrawing ? path.growthStrength : 0}
            pathGrowthRadius={showPathDrawing ? path.growthRadius : 0.32}
            pathGrowthDuration={path.growthDuration}
            pathExtensionDuration={path.extensionDuration}
            organismMaterial={materialMode ? organismMaterial : null}
          />
        ) : null}
        {showScatterGrowths ? (
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
        {showPathDrawing ? (
          <PathField
            strokes={path.strokes}
            drawing={path.drawing}
            onStrokesChange={(strokes) =>
              setPath((current) => ({ ...current, strokes }))
            }
            surfaceOffset={path.surfaceOffset}
            lineRadius={path.lineRadius}
            sampleSpacing={path.sampleSpacing}
            growthStrength={path.growthStrength}
            growthRadius={path.growthRadius}
            growthDuration={path.growthDuration}
            extensionLength={path.extensionLength}
            extensionDuration={path.extensionDuration}
            extensionWander={path.extensionWander}
            surfaceSeed={individuality.seed}
            noiseScale={individuality.noiseScale}
            age={development.age}
            speed={development.speed}
            pulseSpeed={development.pulseSpeed}
            displacement={development.displacement}
            noiseAmount={development.noiseAmount}
            controlsRef={controlsRef}
          />
        ) : null}
        {showParticles && particlesReady ? (
          <ParticleField
            count={particle.count}
            explore={exploreMode}
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
        {showLSystem ? (
          <LSystemField
            depth={lsystem.depth}
            angle={lsystem.angle}
            length={lsystem.length}
            branchRotation={lsystem.branchRotation}
            randomness={lsystem.randomness}
            baseThickness={lsystem.baseThickness}
            taperStrength={lsystem.taperStrength}
            childThicknessRatio={lsystem.childThicknessRatio}
            showDebug={lsystem.showDebug}
            seed={individuality.seed}
            age={development.age}
            noiseScale={individuality.noiseScale}
            speed={development.speed}
            pulseSpeed={development.pulseSpeed}
            displacement={development.displacement}
            noiseAmount={development.noiseAmount}
            decayScale={decay.decayScale}
            decayDisplacement={decay.decayDisplacement}
            lateWarp={1}
          />
        ) : null}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          enableDamping
          autoRotate={!showPathDrawing || !path.drawing}
          autoRotateSpeed={originalDemo ? 0.6 : exploreMode ? 0.2 : 0.35}
          dampingFactor={originalDemo ? 0.05 : 0.06}
          minDistance={orbitMinDistance}
          maxDistance={orbitMaxDistance}
          minPolarAngle={originalDemo ? 0 : exploreMode ? 0.15 : 0.35}
          maxPolarAngle={originalDemo ? Math.PI : exploreMode ? Math.PI - 0.15 : Math.PI - 0.35}
        />
      </WebGLCanvas>
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
        diagnostic={organismMaterial.diagnostic ?? 'baseline'}
        onSelectDiagnostic={(id) =>
          setOrganismMaterial((current) => ({ ...current, diagnostic: id }))
        }
        optical={organismMaterial.optical ?? 'claude'}
        onSelectOptical={(id) =>
          setOrganismMaterial((current) => ({ ...current, optical: id }))
        }
        showChecker={Boolean(organismMaterial.showChecker)}
        onToggleChecker={() =>
          setOrganismMaterial((current) => ({ ...current, showChecker: !current.showChecker }))
        }
      />
      <AdjustBar
        modeId={modeId}
        study={study}
        params={{ ...params, seed: individuality.seed }}
        onChange={updateParam}
      />
    </main>
  )
}
