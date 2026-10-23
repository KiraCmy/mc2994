import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TRANSITION_DURATION, WorldViewport } from '../worldv2/WorldViewport.jsx'
import { useLifeEngine } from '../worldv2/life/useLifeEngine.js'
import { WORLD_V2_SEED } from '../worldv2/worldGeometry.js'
import '../worldv2/worldV2.css'
import EnvHistoryGraph from './languageAsEnvironment/EnvHistoryGraph.jsx'
import {
  COMPARE_BREATH_AMPLITUDE,
  DEFAULT_TEMPERATURE_COUPLING,
  resolveCoupledLife,
  resolveSpatialSampler,
  temperatureDeformationMultipliers,
} from './languageAsEnvironment/temperatureCoupling.js'
import {
  measureMeanRestRadius,
  measureMemoryPreviewTable,
} from './languageAsEnvironment/geometryDiagnostics.js'
import {
  combineRadialOffsets,
  createStructuralMemorySampler,
  createThermalMemoryState,
  DEFAULT_THERMAL_MEMORY,
  estimateRadialDisplacementStats,
  persistentMemoryMagnitude,
  stepThermalExposure,
  thermalExposureForMagnitude,
} from './languageAsEnvironment/thermalMemory.js'
import { useEnvironmentSimulation } from './languageAsEnvironment/useEnvironmentSimulation.js'

const TEMP_PRESETS = [0.3, 0.5, 0.7, 0.85, 1.0]

/** Diagnostic memory magnitude previews (render override only). */
const MEMORY_PREVIEW_PRESETS = [
  { id: 'live', label: 'LIVE', value: null },
  { id: '0', label: '0.00', value: 0 },
  { id: '0.05', label: '0.05', value: 0.05 },
  { id: '0.10', label: '0.10', value: 0.1 },
  { id: '0.20', label: '0.20', value: 0.2 },
]

/** Match World B — Dark (not D — Shader). Presentation only. */
const BACKGROUND_STUDY = 'dark'
const BASELINE_TEMPERATURE = 0.5

const ENV_ROWS = [
  ['temperature', 'Temperature'],
  ['moisture', 'Moisture'],
  ['disturbance', 'Disturbance'],
]

const TUNING_SLIDERS = [
  {
    key: 'impulseStrength',
    label: 'Impulse Strength',
    min: 0.25,
    max: 2.5,
    step: 0.05,
  },
  {
    key: 'recoveryRate',
    label: 'Recovery Rate',
    min: 0.02,
    max: 0.6,
    step: 0.01,
  },
  {
    key: 'accumulationLimit',
    label: 'Accumulation Limit',
    min: 0.1,
    max: 0.5,
    step: 0.01,
  }, // 0.50 ≈ Temperature can reach 1.0 from language
]

function trendMark(trend) {
  if (trend > 0) return '↑'
  if (trend < 0) return '↓'
  return '—'
}

function formatDirection(value) {
  if (value > 0) return '+'
  if (value < 0) return '−'
  return '0'
}

function formatImpulse(value) {
  if (value > 0) return `+${value.toFixed(2)}`
  if (value < 0) return value.toFixed(2)
  return '0.00'
}

/**
 * Experiment 01 — Language as Environment
 * Step 03B: thermal exposure / structural memory on Branch B.
 */
export default function Experiment01({ title, description }) {
  const [languageText, setLanguageText] = useState('')
  const [view, setView] = useState('exterior')
  const [freezeAge, setFreezeAge] = useState(false)
  const [freezeSimTime, setFreezeSimTime] = useState(false)
  const [coupling, setCoupling] = useState(() => ({
    ...DEFAULT_TEMPERATURE_COUPLING,
  }))
  const [thermalMemory, setThermalMemory] = useState(() => ({
    ...DEFAULT_THERMAL_MEMORY,
  }))
  const [memoryState, setMemoryState] = useState(createThermalMemoryState)
  /** null = follow language-driven env Temperature; number = debug scrub. */
  const [temperatureOverride, setTemperatureOverride] = useState(null)
  const [showInfluenceField, setShowInfluenceField] = useState(false)
  /**
   * Structural Memory Calibration (debug):
   * null = LIVE magnitude from accumulated exposure; number = render-only override.
   */
  const [memoryMagnitudePreview, setMemoryMagnitudePreview] = useState(null)
  const [isolateStructuralMemory, setIsolateStructuralMemory] = useState(false)
  const [showGeometryDifference, setShowGeometryDifference] = useState(false)
  const [geometryDebug, setGeometryDebug] = useState(false)
  /** 'experience' = single Branch B; 'compare' = A/B side-by-side (debug). */
  const [displayMode, setDisplayMode] = useState('experience')
  const compareMode = displayMode === 'compare'
  const perfStatsRef = useRef({})
  const geometryMsRefA = useRef(0)
  const geometryMsRefB = useRef(0)
  const [perfHud, setPerfHud] = useState(null)

  const sharedTimeRef = useRef(0)
  /** Shared exterior orbit so A/B cameras stay matched (matches World EXTERIOR_POSITION). */
  const sharedOrbitRef = useRef(
    (() => {
      const x = -0.24
      const y = 0.12
      const z = -13.2
      const radius = Math.hypot(x, y, z)
      return {
        theta: Math.atan2(x, z),
        phi: Math.acos(y / radius),
        radius,
        revision: 0,
      }
    })(),
  )
  const freezeSimTimeRef = useRef(false)
  const memoryStateRef = useRef(memoryState)
  const thermalMemoryRef = useRef(thermalMemory)
  const temperatureRef = useRef(0.5)
  const uiAccumRef = useRef(0)
  freezeSimTimeRef.current = freezeSimTime
  memoryStateRef.current = memoryState
  thermalMemoryRef.current = thermalMemory

  const {
    life,
    playing,
    togglePlaying,
    restart,
    seekToAge,
    addStimulus,
    setPlaying,
  } = useLifeEngine(WORLD_V2_SEED)

  const {
    environment,
    influence,
    targets,
    trends,
    tuning,
    updateTuning,
    graph,
    history,
    lastParse,
    submitLanguage,
    resetEnvironment,
  } = useEnvironmentSimulation()

  const transitioning = view === 'entering' || view === 'exiting'

  const affectedTemperature =
    temperatureOverride == null
      ? environment.temperature
      : temperatureOverride
  temperatureRef.current = affectedTemperature

  // Shared visual clock + thermal exposure (only while sim time advances).
  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000))
      previous = now
      if (!freezeSimTimeRef.current) {
        sharedTimeRef.current += dt
        const next = stepThermalExposure(
          memoryStateRef.current,
          temperatureRef.current,
          dt,
          thermalMemoryRef.current,
        )
        memoryStateRef.current = next
        uiAccumRef.current += dt
        if (uiAccumRef.current >= 0.12) {
          uiAccumRef.current = 0
          setMemoryState({ ...next })
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    setPlaying(true)
    return () => setPlaying(false)
  }, [setPlaying])

  useEffect(() => {
    if (freezeAge) setPlaying(false)
  }, [freezeAge, setPlaying])

  useEffect(() => {
    if (!transitioning) return undefined
    const destination = view === 'entering' ? 'interior' : 'exterior'
    const timer = window.setTimeout(
      () => setView(destination),
      TRANSITION_DURATION * 1000,
    )
    return () => window.clearTimeout(timer)
  }, [transitioning, view])

  const resetCameraView = useCallback(() => {
    setView('exterior')
  }, [])

  const clearStructuralMemory = useCallback(() => {
    const cleared = createThermalMemoryState()
    memoryStateRef.current = cleared
    setMemoryState(cleared)
  }, [])

  const handleRestart = useCallback(() => {
    sharedTimeRef.current = 0
    sharedOrbitRef.current = {
      theta: Math.atan2(-0.24, -13.2),
      phi: Math.acos(0.12 / Math.hypot(0.24, 0.12, 13.2)),
      radius: Math.hypot(0.24, 0.12, 13.2),
      revision: (sharedOrbitRef.current.revision ?? 0) + 1,
    }
    setFreezeAge(false)
    setFreezeSimTime(false)
    clearStructuralMemory()
    resetEnvironment()
    restart()
  }, [clearStructuralMemory, resetEnvironment, restart])

  const handleTogglePlaying = useCallback(() => {
    if (freezeAge) {
      setFreezeAge(false)
      setPlaying(true)
      return
    }
    togglePlaying()
  }, [freezeAge, setPlaying, togglePlaying])

  const handleSubmit = useCallback(() => {
    const trimmed = languageText.trim()
    if (!trimmed) return
    submitLanguage(trimmed)
    setLanguageText('')
  }, [languageText, submitLanguage])

  const onLanguageKeyDown = (event) => {
    if (event.key !== 'Enter') return
    if (event.shiftKey) return
    event.preventDefault()
    handleSubmit()
  }

  const multipliers = useMemo(
    () =>
      temperatureDeformationMultipliers(
        isolateStructuralMemory ? BASELINE_TEMPERATURE : affectedTemperature,
        coupling,
      ),
    [affectedTemperature, coupling, isolateStructuralMemory],
  )

  const resolveBaselineLife = useCallback(
    (sourceLife, elapsed) =>
      resolveCoupledLife(sourceLife, {
        temperature: BASELINE_TEMPERATURE,
        sharedElapsed: elapsed,
        coupling,
        role: 'baseline',
      }),
    [coupling],
  )

  const resolveAffectedLife = useCallback(
    (sourceLife, elapsed) =>
      resolveCoupledLife(sourceLife, {
        // Isolation: match baseline temporal life so only memory offset remains.
        temperature: isolateStructuralMemory
          ? BASELINE_TEMPERATURE
          : affectedTemperature,
        sharedElapsed: elapsed,
        coupling,
        role: isolateStructuralMemory ? 'baseline' : 'affected',
      }),
    [affectedTemperature, coupling, isolateStructuralMemory],
  )

  const affectedSpatial = useMemo(
    () =>
      isolateStructuralMemory
        ? resolveSpatialSampler({
            seed: life.seed,
            temperature: BASELINE_TEMPERATURE,
            coupling,
            role: 'baseline',
          })
        : resolveSpatialSampler({
            seed: life.seed,
            temperature: affectedTemperature,
            coupling,
            role: 'affected',
          }),
    [life.seed, affectedTemperature, coupling, isolateStructuralMemory],
  )

  const liveMemoryMagnitude = persistentMemoryMagnitude(
    memoryState.thermalExposure,
    thermalMemory,
  )
  const previewMemoryMagnitude =
    memoryMagnitudePreview == null
      ? liveMemoryMagnitude
      : memoryMagnitudePreview
  const renderThermalExposure =
    memoryMagnitudePreview == null
      ? memoryState.thermalExposure
      : thermalExposureForMagnitude(memoryMagnitudePreview, thermalMemory)
  /** Keep polarity when previewing with empty history (assume heat scars). */
  const renderExposureBias =
    Math.abs(memoryState.exposureBias) > 1e-4
      ? memoryState.exposureBias
      : 1

  const meanRestRadius = useMemo(
    () => measureMeanRestRadius(life.seed),
    [life.seed],
  )

  const memorySampler = useMemo(
    () =>
      createStructuralMemorySampler({
        seed: life.seed,
        thermalExposure: renderThermalExposure,
        exposureBias: renderExposureBias,
        memory: thermalMemory,
        meanRestRadius,
      }),
    [
      life.seed,
      renderThermalExposure,
      renderExposureBias,
      thermalMemory,
      meanRestRadius,
    ],
  )

  const affectedSpatialOffset = combineRadialOffsets(
    !isolateStructuralMemory && affectedSpatial.active
      ? affectedSpatial.sampleOffset
      : null,
    memorySampler.active ? memorySampler.sampleOffset : null,
  )

  const displacementStats = useMemo(
    () =>
      estimateRadialDisplacementStats(
        memorySampler.active ? memorySampler.sampleOffset : null,
      ),
    [memorySampler],
  )

  /**
   * Final BufferGeometry A/B difference (same CPU path as rendered membrane).
   * No GPU vertex-displacement shader exists in this pipeline.
   */
  const finalGeometryTable = useMemo(
    () =>
      measureMemoryPreviewTable({
        seed: life.seed,
        life,
        memory: thermalMemory,
        exposureBias: renderExposureBias,
        meanRestRadius,
      }),
    // Recompute when seed/age/memory knobs change — not every breath frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      life.seed,
      life.age,
      thermalMemory,
      renderExposureBias,
      meanRestRadius,
      life.outputs.form.scale,
    ],
  )

  const affectedInfluenceOverlay =
    showGeometryDifference && memorySampler.active
      ? (x, y, z) => {
          // Diagnostic: |memory radial offset| → warm tint (0…1 scale).
          const absOffset = Math.abs(memorySampler.sampleOffset(x, y, z))
          const scale = Math.max(1e-4, displacementStats.max || 0.08)
          return Math.min(1, absOffset / scale)
        }
      : showInfluenceField
        ? (x, y, z) => {
            const immediate =
              !isolateStructuralMemory && affectedSpatial.active
                ? affectedSpatial.sampleInfluence(x, y, z)
                : 0
            const memory = memorySampler.active
              ? memorySampler.sampleInfluence(x, y, z)
              : 0
            return immediate * 0.55 + memory * 0.45
          }
        : null

  const branchBDeformAmplitude = isolateStructuralMemory
    ? 1
    : multipliers.amplitude
  const branchBDeformFrequency = isolateStructuralMemory
    ? 1
    : multipliers.frequency

  const updateCoupling = useCallback((key, value) => {
    setCoupling((current) => ({ ...current, [key]: value }))
  }, [])

  const updateThermalMemory = useCallback((key, value) => {
    setThermalMemory((current) => ({ ...current, [key]: value }))
  }, [])

  // Aggregate per-viewport perf probes (~2 Hz). Clears stale Branch A when unmounted.
  useEffect(() => {
    const tick = () => {
      const snap = perfStatsRef.current ?? {}
      if (!compareMode && snap.A) {
        const next = { ...snap }
        delete next.A
        perfStatsRef.current = next
      }
      const slots = compareMode
        ? [snap.A, snap.B].filter(Boolean)
        : [snap.B].filter(Boolean)
      if (!slots.length) {
        setPerfHud({
          mode: displayMode,
          viewports: compareMode ? 2 : 1,
          fps: null,
          frameMs: null,
          calls: null,
          triangles: null,
          geometryUpdateMs: null,
        })
        return
      }
      const fps =
        slots.reduce((sum, row) => sum + (row.fps || 0), 0) / slots.length
      const frameMs =
        slots.reduce((sum, row) => sum + (row.frameMs || 0), 0) / slots.length
      const calls = slots.reduce((sum, row) => sum + (row.calls || 0), 0)
      const triangles = slots.reduce(
        (sum, row) => sum + (row.triangles || 0),
        0,
      )
      const geomRows = slots.filter((row) => row.geometryUpdateMs != null)
      const geometryUpdateMs = geomRows.length
        ? geomRows.reduce((sum, row) => sum + row.geometryUpdateMs, 0)
        : null
      const warmed = slots.every((row) => row.warmed)
      setPerfHud({
        mode: displayMode,
        viewports: slots.length,
        fps,
        frameMs,
        calls,
        triangles,
        geometryUpdateMs,
        warmed,
        perViewport: {
          A: snap.A ?? null,
          B: snap.B ?? null,
        },
      })
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [compareMode, displayMode])

  return (
    <article className="playground-experiment playground-experiment--language-env">
      <header className="playground-experiment__intro">
        <p className="playground-experiment__eyebrow">Playground · Experiment 01</p>
        <h1 className="playground-experiment__title">{title}</h1>
        <p className="playground-experiment__desc">{description}</p>
      </header>

      <div className="playground-experiment__workspace">
        <div className="playground-experiment__stage">
          <section
            className={[
              'playground-experiment__scene',
              'playground-experiment__scene--live',
              'playground-experiment__scene--compare',
              compareMode
                ? 'playground-experiment__scene--mode-compare'
                : 'playground-experiment__scene--mode-experience',
            ].join(' ')}
            aria-label={
              compareMode ? 'Organism comparison' : 'Organism experience'
            }
          >
            <div
              className={[
                'playground-experiment__compare',
                compareMode
                  ? 'playground-experiment__compare--ab'
                  : 'playground-experiment__compare--experience',
              ].join(' ')}
            >
              {compareMode ? (
                <div className="playground-experiment__compare-pane">
                  <WorldViewport
                    className="playground-experiment__viewport"
                    view={view}
                    life={life}
                    onStimulus={addStimulus}
                    backgroundStudy={BACKGROUND_STUDY}
                    onCameraReset={resetCameraView}
                    deformAmplitudeScale={1}
                    deformFrequencyScale={1}
                    sharedTimeRef={sharedTimeRef}
                    sharedOrbitRef={sharedOrbitRef}
                    resolveLifeForRender={resolveBaselineLife}
                    breathAmplitude={COMPARE_BREATH_AMPLITUDE}
                    geometryDebug={geometryDebug}
                    perfSlot="A"
                    perfStatsRef={perfStatsRef}
                    geometryUpdateMsRef={geometryMsRefA}
                  />
                  <p className="playground-experiment__compare-label">
                    <span>A — Baseline</span>
                    <span>
                      Baseline Temperature: {BASELINE_TEMPERATURE.toFixed(2)}
                    </span>
                  </p>
                </div>
              ) : null}
              <div className="playground-experiment__compare-pane">
                <WorldViewport
                  className="playground-experiment__viewport"
                  view={view}
                  life={life}
                  onStimulus={addStimulus}
                  backgroundStudy={BACKGROUND_STUDY}
                  onCameraReset={resetCameraView}
                  deformAmplitudeScale={branchBDeformAmplitude}
                  deformFrequencyScale={branchBDeformFrequency}
                  sharedTimeRef={sharedTimeRef}
                  sharedOrbitRef={sharedOrbitRef}
                  resolveLifeForRender={resolveAffectedLife}
                  breathAmplitude={COMPARE_BREATH_AMPLITUDE}
                  extraRadialOffset={affectedSpatialOffset}
                  influenceOverlay={
                    geometryDebug ? null : affectedInfluenceOverlay
                  }
                  geometryDebug={geometryDebug}
                  perfSlot="B"
                  perfStatsRef={perfStatsRef}
                  geometryUpdateMsRef={geometryMsRefB}
                />
                <p className="playground-experiment__compare-label">
                  <span>
                    {compareMode
                      ? isolateStructuralMemory
                        ? 'B — Memory Isolated'
                        : 'B — Temperature Affected'
                      : isolateStructuralMemory
                        ? 'Memory Isolated'
                        : 'Temperature Affected'}
                  </span>
                  <span>
                    Temperature: {affectedTemperature.toFixed(2)}
                    {memoryMagnitudePreview != null
                      ? ` · Preview Mag ${previewMemoryMagnitude.toFixed(2)}`
                      : ''}
                  </span>
                </p>
              </div>
            </div>

            <div className="playground-experiment__scene-chrome">
              <div className="playground-experiment__scene-hud">
                <div
                  className="playground-experiment__mode-toggle"
                  role="group"
                  aria-label="Display mode"
                >
                  <button
                    type="button"
                    aria-pressed={!compareMode}
                    className={
                      !compareMode
                        ? 'playground-experiment__mode-btn is-active'
                        : 'playground-experiment__mode-btn'
                    }
                    onClick={() => setDisplayMode('experience')}
                  >
                    Experience
                  </button>
                  <button
                    type="button"
                    aria-pressed={compareMode}
                    className={
                      compareMode
                        ? 'playground-experiment__mode-btn is-active'
                        : 'playground-experiment__mode-btn'
                    }
                    onClick={() => setDisplayMode('compare')}
                  >
                    Compare
                  </button>
                </div>
                <span>
                  Age {life.age.toFixed(3)} · Seed {life.seed}
                  {freezeAge ? ' · Frozen' : ''}
                </span>
                {perfHud ? (
                  <span
                    className="playground-experiment__perf-hud"
                    title="Wall-clock FPS after Canvas mount; draws/tris are cumulative EffectComposer passes. 'cold' = first 5s warmup."
                  >
                    {perfHud.viewports} VP
                    {perfHud.warmed === false ? ' · cold' : ' · warm'}
                    {perfHud.fps != null
                      ? ` · ${perfHud.fps.toFixed(0)} FPS`
                      : ''}
                    {perfHud.frameMs != null
                      ? ` · ${perfHud.frameMs.toFixed(1)} ms`
                      : ''}
                    {perfHud.calls != null ? ` · ${perfHud.calls} draws` : ''}
                    {perfHud.triangles != null
                      ? ` · ${(perfHud.triangles / 1000).toFixed(1)}k tris`
                      : ''}
                    {perfHud.geometryUpdateMs != null
                      ? ` · geom ${perfHud.geometryUpdateMs.toFixed(2)} ms`
                      : ''}
                  </span>
                ) : null}
                <button type="button" onClick={handleTogglePlaying}>
                  {life.dead
                    ? 'Ended'
                    : playing && !freezeAge
                      ? 'Pause'
                      : 'Play'}
                </button>
                <button type="button" onClick={handleRestart}>
                  Restart
                </button>
                <button
                  type="button"
                  aria-pressed={freezeAge}
                  onClick={() => setFreezeAge((current) => !current)}
                >
                  {freezeAge ? 'Unfreeze AGE' : 'Freeze AGE'}
                </button>
                <button
                  type="button"
                  aria-pressed={freezeSimTime}
                  onClick={() => setFreezeSimTime((current) => !current)}
                >
                  {freezeSimTime ? 'Resume Time' : 'Pause Time'}
                </button>
                <button
                  type="button"
                  disabled={transitioning}
                  onClick={() => {
                    if (transitioning) return
                    setView(view === 'exterior' ? 'entering' : 'exiting')
                  }}
                >
                  {view === 'interior' || view === 'exiting' ? 'Exit' : 'Enter'}
                </button>
              </div>
              <section
                className="playground-experiment__timeline"
                aria-label="Life timeline"
              >
              <div className="playground-experiment__timeline-labels">
                <span>Born</span>
                <span>Death</span>
              </div>
              <input
                className="playground-experiment__timeline-range"
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={life.age}
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={Number(life.age.toFixed(3))}
                aria-valuetext={`Age ${life.age.toFixed(3)}`}
                onPointerDown={() => {
                  setFreezeAge(true)
                  seekToAge(life.age)
                }}
                onChange={(event) => {
                  setFreezeAge(true)
                  seekToAge(Number(event.target.value))
                }}
              />
              </section>
            </div>
          </section>

          <div className="playground-experiment__language">
            <span className="playground-experiment__controls-label" id="language-env-label">
              Language
            </span>
            <textarea
              id="language-env-input"
              className="playground-experiment__language-input"
              value={languageText}
              onChange={(event) => setLanguageText(event.target.value)}
              onKeyDown={onLanguageKeyDown}
              rows={3}
              placeholder="Type a complete sentence about the environment…"
              spellCheck
              aria-labelledby="language-env-label"
            />
            <div className="playground-experiment__language-actions">
              <button
                type="button"
                className="playground-experiment__send"
                onClick={handleSubmit}
              >
                Send
              </button>
              <span className="playground-experiment__language-hint">
                Enter to send · Shift+Enter for a new line
              </span>
            </div>
            {history.length > 0 ? (
              <ul className="playground-experiment__history" aria-label="Interaction history">
                {history.map((entry, index) => (
                  <li key={`${index}-${entry.text}`}>
                    <span>{entry.text}</span>
                    {entry.applied ? (
                      <em className="playground-experiment__history-tag">applied</em>
                    ) : (
                      <em className="playground-experiment__history-tag">ignored</em>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <aside
          className="playground-experiment__controls"
          aria-label="Environmental variables"
        >
          <p className="playground-experiment__controls-label">Controls</p>
          <p className="playground-experiment__controls-note">
            Branch B: immediate Temperature response + persistent thermal
            memory. Environment can recover to 0.50 while memory remains. Pause
            Time stops exposure accumulation. Moisture / Disturbance still
            env-only.
          </p>
          <dl className="playground-experiment__env-list">
            {ENV_ROWS.map(([key, label]) => (
              <div key={key} className="playground-experiment__env-row">
                <dt>{label}</dt>
                <dd
                  className={
                    trends[key] > 0
                      ? 'is-rising'
                      : trends[key] < 0
                        ? 'is-falling'
                        : ''
                  }
                >
                  <span className="playground-experiment__env-current">
                    {environment[key].toFixed(2)}
                  </span>
                  <span className="playground-experiment__trend" aria-hidden="true">
                    {trendMark(trends[key])}
                  </span>
                  <span className="playground-experiment__env-meta">
                    tgt {targets[key].toFixed(2)}
                    <span aria-hidden="true"> · </span>
                    Δ {influence[key] >= 0 ? '+' : ''}
                    {influence[key].toFixed(2)}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <EnvHistoryGraph graph={graph} />

          <div
            className="playground-experiment__coupling"
            aria-label="Temperature coupling"
          >
            <p className="playground-experiment__controls-label">
              Temperature Coupling
            </p>

            <p className="playground-experiment__controls-label">Preview T</p>
            <div className="playground-experiment__preset-row">
              {TEMP_PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    temperatureOverride === value
                      ? 'playground-experiment__preset is-active'
                      : 'playground-experiment__preset'
                  }
                  onClick={() => setTemperatureOverride(value)}
                >
                  {value.toFixed(2)}
                </button>
              ))}
              <button
                type="button"
                className="playground-experiment__preset"
                onClick={() => setTemperatureOverride(null)}
              >
                Live
              </button>
            </div>
            <label className="playground-experiment__tuning-row">
              <span>
                Temperature Scrub
                <em>
                  {affectedTemperature.toFixed(2)}
                  {temperatureOverride == null ? ' · live' : ' · override'}
                </em>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={affectedTemperature}
                onChange={(event) =>
                  setTemperatureOverride(Number(event.target.value))
                }
              />
            </label>

            <p className="playground-experiment__controls-label">
              Temporal Response
            </p>
            <label className="playground-experiment__coupling-toggle">
              <input
                type="checkbox"
                checked={coupling.temporalEnabled}
                onChange={(event) =>
                  updateCoupling('temporalEnabled', event.target.checked)
                }
              />
              <span>
                Temporal {coupling.temporalEnabled ? 'ON' : 'OFF'}
              </span>
            </label>
            <label className="playground-experiment__tuning-row">
              <span>
                Temporal Amplitude Sensitivity
                <em>{coupling.temporalAmplitudeSensitivity.toFixed(2)}</em>
              </span>
              <input
                type="range"
                min={0}
                max={2.5}
                step={0.05}
                value={coupling.temporalAmplitudeSensitivity}
                onChange={(event) =>
                  updateCoupling(
                    'temporalAmplitudeSensitivity',
                    Number(event.target.value),
                  )
                }
              />
            </label>
            <label className="playground-experiment__tuning-row">
              <span>
                Frequency Sensitivity
                <em>{coupling.frequencySensitivity.toFixed(2)}</em>
              </span>
              <input
                type="range"
                min={0}
                max={2.5}
                step={0.05}
                value={coupling.frequencySensitivity}
                onChange={(event) =>
                  updateCoupling(
                    'frequencySensitivity',
                    Number(event.target.value),
                  )
                }
              />
            </label>

            <p className="playground-experiment__controls-label">
              Spatial Response
            </p>
            <label className="playground-experiment__coupling-toggle">
              <input
                type="checkbox"
                checked={coupling.spatialEnabled}
                onChange={(event) =>
                  updateCoupling('spatialEnabled', event.target.checked)
                }
              />
              <span>
                Spatial Coupling {coupling.spatialEnabled ? 'ON' : 'OFF'}
              </span>
            </label>
            <label className="playground-experiment__tuning-row">
              <span>
                Spatial Coverage
                <em>{coupling.spatialCoverage.toFixed(2)}</em>
              </span>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.01}
                value={coupling.spatialCoverage}
                onChange={(event) =>
                  updateCoupling('spatialCoverage', Number(event.target.value))
                }
              />
            </label>
            <label className="playground-experiment__tuning-row">
              <span>
                Spatial Variation
                <em>{coupling.spatialVariation.toFixed(2)}</em>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={coupling.spatialVariation}
                onChange={(event) =>
                  updateCoupling('spatialVariation', Number(event.target.value))
                }
              />
            </label>
            <label className="playground-experiment__tuning-row">
              <span>
                Displacement Strength
                <em>{coupling.displacementStrength.toFixed(2)}</em>
              </span>
              <input
                type="range"
                min={0}
                max={2.5}
                step={0.05}
                value={coupling.displacementStrength}
                onChange={(event) =>
                  updateCoupling(
                    'displacementStrength',
                    Number(event.target.value),
                  )
                }
              />
            </label>
            <label className="playground-experiment__coupling-toggle">
              <input
                type="checkbox"
                checked={showInfluenceField}
                onChange={(event) =>
                  setShowInfluenceField(event.target.checked)
                }
              />
              <span>Show Temperature Influence Field</span>
            </label>

            <dl className="playground-experiment__coupling-readout">
              <div>
                <dt>Current Temperature</dt>
                <dd>{affectedTemperature.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Temporal Amplitude ×</dt>
                <dd>{multipliers.amplitude.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Temporal Frequency ×</dt>
                <dd>{multipliers.frequency.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Spatial Field</dt>
                <dd>{affectedSpatial.active ? 'distributed' : 'neutral'}</dd>
              </div>
            </dl>

            <p className="playground-experiment__controls-label">
              Thermal Memory
            </p>
            <label className="playground-experiment__coupling-toggle">
              <input
                type="checkbox"
                checked={thermalMemory.enabled}
                onChange={(event) =>
                  updateThermalMemory('enabled', event.target.checked)
                }
              />
              <span>
                Structural Memory {thermalMemory.enabled ? 'ON' : 'OFF'}
              </span>
            </label>
            <label className="playground-experiment__tuning-row">
              <span>
                Exposure Threshold
                <em>{thermalMemory.exposureThreshold.toFixed(2)}</em>
              </span>
              <input
                type="range"
                min={0}
                max={0.4}
                step={0.01}
                value={thermalMemory.exposureThreshold}
                onChange={(event) =>
                  updateThermalMemory(
                    'exposureThreshold',
                    Number(event.target.value),
                  )
                }
              />
            </label>
            <label className="playground-experiment__tuning-row">
              <span>
                Exposure Accumulation Rate
                <em>{thermalMemory.accumulationRate.toFixed(2)}</em>
              </span>
              <input
                type="range"
                min={0.02}
                max={1}
                step={0.01}
                value={thermalMemory.accumulationRate}
                onChange={(event) =>
                  updateThermalMemory(
                    'accumulationRate',
                    Number(event.target.value),
                  )
                }
              />
            </label>
            <label className="playground-experiment__tuning-row">
              <span>
                Memory Recovery Rate
                <em>{thermalMemory.memoryRecoveryRate.toFixed(3)}</em>
              </span>
              <input
                type="range"
                min={0}
                max={0.25}
                step={0.005}
                value={thermalMemory.memoryRecoveryRate}
                onChange={(event) =>
                  updateThermalMemory(
                    'memoryRecoveryRate',
                    Number(event.target.value),
                  )
                }
              />
            </label>
            <label className="playground-experiment__tuning-row">
              <span>
                Memory Deformation Strength
                <em>{thermalMemory.memoryDeformationStrength.toFixed(2)}</em>
              </span>
              <input
                type="range"
                min={0}
                max={3}
                step={0.05}
                value={thermalMemory.memoryDeformationStrength}
                onChange={(event) =>
                  updateThermalMemory(
                    'memoryDeformationStrength',
                    Number(event.target.value),
                  )
                }
              />
            </label>
            <dl className="playground-experiment__coupling-readout">
              <div>
                <dt>Current Thermal Exposure</dt>
                <dd>{memoryState.thermalExposure.toFixed(3)}</dd>
              </div>
              <div>
                <dt>Persistent Memory Magnitude</dt>
                <dd>{liveMemoryMagnitude.toFixed(3)}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="playground-experiment__reset-env"
              onClick={clearStructuralMemory}
            >
              Clear Structural Memory
            </button>

            <p className="playground-experiment__controls-label">
              Memory Calibration — Debug
            </p>
            <p className="playground-experiment__language-hint">
              Preview overrides Branch B render only. LIVE restores real
              exposure history without resetting it. Magnitude range is [0, 1].
            </p>
            <div className="playground-experiment__preset-row">
              {MEMORY_PREVIEW_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={
                    memoryMagnitudePreview === preset.value
                      ? 'playground-experiment__preset is-active'
                      : 'playground-experiment__preset'
                  }
                  onClick={() => setMemoryMagnitudePreview(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <label className="playground-experiment__coupling-toggle">
              <input
                type="checkbox"
                checked={isolateStructuralMemory}
                onChange={(event) =>
                  setIsolateStructuralMemory(event.target.checked)
                }
              />
              <span>
                Isolate Structural Memory{' '}
                {isolateStructuralMemory ? 'ON' : 'OFF'}
              </span>
            </label>
            <label className="playground-experiment__coupling-toggle">
              <input
                type="checkbox"
                checked={showGeometryDifference}
                onChange={(event) =>
                  setShowGeometryDifference(event.target.checked)
                }
              />
              <span>
                Show Geometry Difference{' '}
                {showGeometryDifference ? 'ON' : 'OFF'}
              </span>
            </label>
            <label className="playground-experiment__coupling-toggle">
              <input
                type="checkbox"
                checked={geometryDebug}
                onChange={(event) => setGeometryDebug(event.target.checked)}
              />
              <span>
                Geometry Debug {geometryDebug ? 'ON' : 'OFF'}
              </span>
            </label>
            <p className="playground-experiment__language-hint">
              Geometry Debug: opaque gray + wireframe, bloom/transmission off.
              Displacement is CPU BufferGeometry (no GPU displace shader).
            </p>
            <dl className="playground-experiment__coupling-readout">
              <div>
                <dt>Actual Persistent Memory Magnitude</dt>
                <dd>{liveMemoryMagnitude.toFixed(3)}</dd>
              </div>
              <div>
                <dt>Preview Memory Magnitude</dt>
                <dd>
                  {memoryMagnitudePreview == null
                    ? `LIVE (${liveMemoryMagnitude.toFixed(3)})`
                    : previewMemoryMagnitude.toFixed(3)}
                </dd>
              </div>
              <div>
                <dt>Effective Memory Deformation Strength</dt>
                <dd>{thermalMemory.memoryDeformationStrength.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Field Max |offset| (sampler)</dt>
                <dd>{displacementStats.max.toFixed(4)}</dd>
              </div>
              <div>
                <dt>Field Mean |offset| (sampler)</dt>
                <dd>{displacementStats.mean.toFixed(4)}</dd>
              </div>
              <div>
                <dt>Organism Mean Radius (rest)</dt>
                <dd>{meanRestRadius.toFixed(3)}</dd>
              </div>
            </dl>
            <p className="playground-experiment__controls-label">
              Final Geometry Table (A vs B membrane)
            </p>
            <div className="playground-experiment__diag-table-wrap">
              <table className="playground-experiment__diag-table">
                <thead>
                  <tr>
                    <th>Mag</th>
                    <th>Max</th>
                    <th>Mean</th>
                    <th>RMS</th>
                    <th>Rel Max</th>
                    <th>Silh.</th>
                    <th>Arc°</th>
                  </tr>
                </thead>
                <tbody>
                  {finalGeometryTable.map((row) => (
                    <tr
                      key={row.magnitude}
                      className={
                        memoryMagnitudePreview === row.magnitude
                          ? 'is-active'
                          : undefined
                      }
                    >
                      <td>{row.magnitude.toFixed(2)}</td>
                      <td>{row.maxDisp.toFixed(4)}</td>
                      <td>{row.meanDisp.toFixed(4)}</td>
                      <td>{row.rmsDisp.toFixed(4)}</td>
                      <td>{(row.relMax * 100).toFixed(1)}%</td>
                      <td>{row.silhouetteMeanAbs.toFixed(4)}</td>
                      <td>{row.screenArcMaxDeg.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="playground-experiment__tuning" aria-label="Developer tuning">
            <p className="playground-experiment__controls-label">Tuning</p>
            {TUNING_SLIDERS.map(({ key, label, min, max, step }) => (
              <label key={key} className="playground-experiment__tuning-row">
                <span>
                  {label}
                  <em>{tuning[key].toFixed(2)}</em>
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={tuning[key]}
                  onChange={(event) =>
                    updateTuning(key, Number(event.target.value))
                  }
                />
              </label>
            ))}
          </div>

          <div className="playground-experiment__parse-feedback">
            <p className="playground-experiment__controls-label">Interpretation</p>
            {lastParse ? (
              <>
                <p className="playground-experiment__intent">
                  <span>Intent</span>
                  <strong>{lastParse.intentLabel}</strong>
                </p>
                <p
                  className={
                    lastParse.applied
                      ? 'playground-experiment__apply is-applied'
                      : 'playground-experiment__apply is-ignored'
                  }
                >
                  {lastParse.applied ? 'Applied to environment' : 'Ignored — no impulse'}
                </p>
                {lastParse.conceptLabels?.length > 0 ? (
                  <p className="playground-experiment__concepts">
                    {lastParse.conceptLabels.join(' · ')}
                  </p>
                ) : lastParse.cancelledConcepts?.length > 0 ? (
                  <p className="playground-experiment__concepts">
                    Negated: {lastParse.cancelledConcepts.join(' · ')}
                  </p>
                ) : (
                  <p className="playground-experiment__controls-note">
                    No environmental concepts recognized.
                  </p>
                )}
                <ul className="playground-experiment__directions">
                  <li>
                    Temperature {formatImpulse(lastParse.impulses.temperature)}
                    <span aria-hidden="true"> ({formatDirection(lastParse.directions.temperature)})</span>
                  </li>
                  <li>
                    Moisture {formatImpulse(lastParse.impulses.moisture)}
                    <span aria-hidden="true"> ({formatDirection(lastParse.directions.moisture)})</span>
                  </li>
                  <li>
                    Disturbance {formatImpulse(lastParse.impulses.disturbance)}
                    <span aria-hidden="true"> ({formatDirection(lastParse.directions.disturbance)})</span>
                  </li>
                </ul>
                <p className="playground-experiment__explanation">
                  {lastParse.explanation}
                </p>
              </>
            ) : (
              <p className="playground-experiment__controls-note">
                Send a sentence to see intent and concepts.
              </p>
            )}
          </div>

          <button
            type="button"
            className="playground-experiment__reset-env"
            onClick={resetEnvironment}
          >
            Reset Environment
          </button>
        </aside>
      </div>
    </article>
  )
}
