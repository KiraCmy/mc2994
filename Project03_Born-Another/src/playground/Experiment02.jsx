import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WorldViewport } from '../worldv2/WorldViewport.jsx'
import { useLifeEngine } from '../worldv2/life/useLifeEngine.js'
import {
  ENV_MOISTURE_NEUTRAL,
  ENV_TURBULENCE_DEFAULT,
} from '../worldv2/life/lifeEngine.js'
import { WORLD_V2_SEED } from '../worldv2/worldGeometry.js'
import '../worldv2/worldV2.css'
import EnvHistoryGraph from './languageAsEnvironment/EnvHistoryGraph.jsx'
import {
  disturbanceToTurbulence,
  quantizeEnvChannel,
} from './languageAsEnvironment/envState.js'
import {
  COMPARE_BREATH_AMPLITUDE,
  DEFAULT_TEMPERATURE_COUPLING,
  resolveCoupledLife,
  resolveSpatialSampler,
  temperatureDeformationMultipliers,
} from './languageAsEnvironment/temperatureCoupling.js'
import {
  combineRadialOffsets,
  createStructuralMemorySampler,
  createThermalMemoryState,
  DEFAULT_THERMAL_MEMORY,
  persistentMemoryMagnitude,
  stepThermalExposure,
} from './languageAsEnvironment/thermalMemory.js'
import { useEnvironmentSimulation } from './languageAsEnvironment/useEnvironmentSimulation.js'

/** Stable distinct seeds — A matches World default; B is independent. */
const LIFE_A_SEED = WORLD_V2_SEED
const LIFE_B_SEED = 9043

/** Deterministic initial placement (organism local space preserved). */
const POSITION_A = [-3.55, 0, 0]
const POSITION_B = [3.55, 0, 0]
const ORBIT_PIVOT = [0, 0, 0]
const SHARED_CAMERA_POSITION = [0, 1.05, -19.5]
const SHARED_ORBIT_RADIUS = 19.5

const BACKGROUND_STUDY = 'dark'
const BASELINE_TEMPERATURE = 0.5

const ENV_ROWS = [
  ['temperature', 'Temperature'],
  ['moisture', 'Moisture'],
  ['disturbance', 'Disturbance'],
]

function lifePhaseLabel(life) {
  if (life.dead) return 'Death'
  if (life.age < 0.12) return 'Birth'
  if (life.variables.decay > 0.45) return 'Decay'
  if (life.variables.growth > 0.55) return 'Growth'
  return 'Life'
}

function OrganismControls({
  label,
  seed,
  life,
  playing,
  freezeAge,
  onTogglePlaying,
  onRestart,
  onToggleFreezeAge,
  onSeekAge,
}) {
  return (
    <div className="playground-experiment__organism-card" aria-label={label}>
      <p className="playground-experiment__controls-label">{label}</p>
      <dl className="playground-experiment__coupling-readout">
        <div>
          <dt>Seed</dt>
          <dd>{seed}</dd>
        </div>
        <div>
          <dt>Age</dt>
          <dd>{life.age.toFixed(3)}</dd>
        </div>
        <div>
          <dt>Phase</dt>
          <dd>{lifePhaseLabel(life)}</dd>
        </div>
        <div>
          <dt>M / Turb</dt>
          <dd>
            {(life.environment?.moisture ?? ENV_MOISTURE_NEUTRAL).toFixed(2)}
            {' / '}
            {(life.environment?.turbulence ?? ENV_TURBULENCE_DEFAULT).toFixed(2)}
          </dd>
        </div>
      </dl>
      <div className="playground-experiment__preset-row">
        <button
          type="button"
          className="playground-experiment__preset"
          disabled={life.dead && !playing}
          onClick={onTogglePlaying}
        >
          {life.dead ? 'Ended' : playing && !freezeAge ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className="playground-experiment__preset"
          onClick={onRestart}
        >
          Reset
        </button>
        <button
          type="button"
          className={
            freezeAge
              ? 'playground-experiment__preset is-active'
              : 'playground-experiment__preset'
          }
          aria-pressed={freezeAge}
          onClick={onToggleFreezeAge}
        >
          {freezeAge ? 'Unfreeze AGE' : 'Freeze AGE'}
        </button>
      </div>
      <label className="playground-experiment__tuning-row">
        <span>
          AGE
          <em>{life.age.toFixed(3)}</em>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={life.age}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={Number(life.age.toFixed(3))}
          aria-valuetext={`${label} age ${life.age.toFixed(3)}`}
          onPointerDown={() => onSeekAge(life.age, true)}
          onChange={(event) => onSeekAge(Number(event.target.value), true)}
        />
      </label>
    </div>
  )
}

/**
 * Experiment 02 — Independent Life B in one shared Canvas.
 * Two Life Engines, one WorldViewport (organisms[]), inherited language env.
 */
export default function Experiment02({ title, description }) {
  const [languageText, setLanguageText] = useState('')
  const [freezeAgeA, setFreezeAgeA] = useState(false)
  const [freezeAgeB, setFreezeAgeB] = useState(false)
  const [freezeSimTime, setFreezeSimTime] = useState(false)
  const [coupling] = useState(() => ({ ...DEFAULT_TEMPERATURE_COUPLING }))
  const [thermalMemory] = useState(() => ({ ...DEFAULT_THERMAL_MEMORY }))
  const [memoryA, setMemoryA] = useState(createThermalMemoryState)
  const [memoryB, setMemoryB] = useState(createThermalMemoryState)
  const [moistureOverride, setMoistureOverride] = useState(null)
  const [turbulenceOverride, setTurbulenceOverride] = useState(null)
  const [temperatureOverride, setTemperatureOverride] = useState(null)

  const sharedTimeRef = useRef(0)
  const sharedOrbitRef = useRef({
    theta: Math.atan2(SHARED_CAMERA_POSITION[0], SHARED_CAMERA_POSITION[2]),
    phi: Math.acos(
      SHARED_CAMERA_POSITION[1] /
        Math.hypot(...SHARED_CAMERA_POSITION),
    ),
    radius: SHARED_ORBIT_RADIUS,
    revision: 0,
  })
  const freezeSimTimeRef = useRef(false)
  const memoryARef = useRef(memoryA)
  const memoryBRef = useRef(memoryB)
  const thermalMemoryRef = useRef(thermalMemory)
  const temperatureRef = useRef(BASELINE_TEMPERATURE)
  const temperatureOverrideRef = useRef(temperatureOverride)
  const uiAccumRef = useRef(0)
  const syncedMoistureRef = useRef(null)
  const syncedTurbulenceRef = useRef(null)

  freezeSimTimeRef.current = freezeSimTime
  memoryARef.current = memoryA
  memoryBRef.current = memoryB
  thermalMemoryRef.current = thermalMemory
  temperatureOverrideRef.current = temperatureOverride

  const lifeA = useLifeEngine(LIFE_A_SEED)
  const lifeB = useLifeEngine(LIFE_B_SEED)

  const {
    environment,
    environmentRef,
    influence,
    targets,
    trends,
    graph,
    history,
    lastParse,
    submitLanguage,
    resetEnvironment,
  } = useEnvironmentSimulation()

  const affectedTemperature =
    temperatureOverride == null
      ? environment.temperature
      : temperatureOverride

  const setPlayingA = lifeA.setPlaying
  const setPlayingB = lifeB.setPlaying
  useEffect(() => {
    setPlayingA(true)
    setPlayingB(true)
    return () => {
      setPlayingA(false)
      setPlayingB(false)
    }
  }, [setPlayingA, setPlayingB])

  useEffect(() => {
    if (freezeAgeA) lifeA.setPlaying(false)
  }, [freezeAgeA, lifeA.setPlaying])

  useEffect(() => {
    if (freezeAgeB) lifeB.setPlaying(false)
  }, [freezeAgeB, lifeB.setPlaying])

  // Language Moisture / Disturbance → both Life Engines (independent histories).
  useEffect(() => {
    if (moistureOverride != null) return
    if (lifeA.life.dead && lifeB.life.dead) return
    const next = quantizeEnvChannel(environment.moisture)
    if (
      syncedMoistureRef.current != null &&
      Math.abs(syncedMoistureRef.current - next) < 0.005
    ) {
      return
    }
    syncedMoistureRef.current = next
    if (!lifeA.life.dead) lifeA.setMoistureAtStep(next)
    if (!lifeB.life.dead) lifeB.setMoistureAtStep(next)
  }, [
    environment.moisture,
    moistureOverride,
    lifeA.life.dead,
    lifeB.life.dead,
    lifeA.setMoistureAtStep,
    lifeB.setMoistureAtStep,
  ])

  useEffect(() => {
    if (turbulenceOverride != null) return
    if (lifeA.life.dead && lifeB.life.dead) return
    const next = quantizeEnvChannel(
      disturbanceToTurbulence(environment.disturbance),
    )
    if (
      syncedTurbulenceRef.current != null &&
      Math.abs(syncedTurbulenceRef.current - next) < 0.005
    ) {
      return
    }
    syncedTurbulenceRef.current = next
    if (!lifeA.life.dead) lifeA.setTurbulence(next)
    if (!lifeB.life.dead) lifeB.setTurbulence(next)
  }, [
    environment.disturbance,
    turbulenceOverride,
    lifeA.life.dead,
    lifeB.life.dead,
    lifeA.setTurbulence,
    lifeB.setTurbulence,
  ])

  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000))
      previous = now
      const override = temperatureOverrideRef.current
      const liveTemp =
        environmentRef.current?.values?.temperature ?? BASELINE_TEMPERATURE
      temperatureRef.current = override == null ? liveTemp : override
      if (!freezeSimTimeRef.current) {
        sharedTimeRef.current += dt
        const nextA = stepThermalExposure(
          memoryARef.current,
          temperatureRef.current,
          dt,
          thermalMemoryRef.current,
        )
        const nextB = stepThermalExposure(
          memoryBRef.current,
          temperatureRef.current,
          dt,
          thermalMemoryRef.current,
        )
        memoryARef.current = nextA
        memoryBRef.current = nextB
        uiAccumRef.current += dt
        if (uiAccumRef.current >= 0.12) {
          uiAccumRef.current = 0
          setMemoryA({ ...nextA })
          setMemoryB({ ...nextB })
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [environmentRef])

  const resetCameraView = useCallback(() => {
    sharedOrbitRef.current = {
      theta: Math.atan2(SHARED_CAMERA_POSITION[0], SHARED_CAMERA_POSITION[2]),
      phi: Math.acos(
        SHARED_CAMERA_POSITION[1] / Math.hypot(...SHARED_CAMERA_POSITION),
      ),
      radius: SHARED_ORBIT_RADIUS,
      revision: (sharedOrbitRef.current.revision ?? 0) + 1,
    }
  }, [])

  const clearMemories = useCallback(() => {
    const clearedA = createThermalMemoryState()
    const clearedB = createThermalMemoryState()
    memoryARef.current = clearedA
    memoryBRef.current = clearedB
    setMemoryA(clearedA)
    setMemoryB(clearedB)
  }, [])

  const handleRestartA = useCallback(() => {
    setFreezeAgeA(false)
    lifeA.restart({ clearEnvironment: true })
  }, [lifeA])

  const handleRestartB = useCallback(() => {
    setFreezeAgeB(false)
    lifeB.restart({ clearEnvironment: true })
  }, [lifeB])

  const handleRestartBoth = useCallback(() => {
    sharedTimeRef.current = 0
    resetCameraView()
    setFreezeAgeA(false)
    setFreezeAgeB(false)
    setFreezeSimTime(false)
    setMoistureOverride(null)
    setTurbulenceOverride(null)
    setTemperatureOverride(null)
    syncedMoistureRef.current = null
    syncedTurbulenceRef.current = null
    clearMemories()
    resetEnvironment()
    lifeA.restart({ clearEnvironment: true })
    lifeB.restart({ clearEnvironment: true })
  }, [clearMemories, lifeA, lifeB, resetCameraView, resetEnvironment])

  const handleToggleA = useCallback(() => {
    if (freezeAgeA) {
      setFreezeAgeA(false)
      lifeA.setPlaying(true)
      return
    }
    lifeA.togglePlaying()
  }, [freezeAgeA, lifeA])

  const handleToggleB = useCallback(() => {
    if (freezeAgeB) {
      setFreezeAgeB(false)
      lifeB.setPlaying(true)
      return
    }
    lifeB.togglePlaying()
  }, [freezeAgeB, lifeB])

  const seekA = useCallback(
    (age, freeze = false) => {
      if (freeze) setFreezeAgeA(true)
      lifeA.seekToAge(age)
    },
    [lifeA],
  )

  const seekB = useCallback(
    (age, freeze = false) => {
      if (freeze) setFreezeAgeB(true)
      lifeB.seekToAge(age)
    },
    [lifeB],
  )

  const handleSubmit = useCallback(() => {
    const trimmed = languageText.trim()
    if (!trimmed) return
    const parsed = submitLanguage(trimmed)
    if (parsed?.applied) {
      if (parsed.impulses?.moisture) {
        setMoistureOverride(null)
        syncedMoistureRef.current = null
      }
      if (parsed.impulses?.disturbance) {
        setTurbulenceOverride(null)
        syncedTurbulenceRef.current = null
      }
    }
    setLanguageText('')
  }, [languageText, submitLanguage])

  const onLanguageKeyDown = (event) => {
    if (event.key !== 'Enter') return
    if (event.shiftKey) return
    event.preventDefault()
    handleSubmit()
  }

  const handleManualMoisture = useCallback(
    (value) => {
      const next = quantizeEnvChannel(value)
      setMoistureOverride(next)
      syncedMoistureRef.current = next
      if (!lifeA.life.dead) lifeA.setMoisture(next)
      if (!lifeB.life.dead) lifeB.setMoisture(next)
    },
    [lifeA, lifeB],
  )

  const handleManualTurbulence = useCallback(
    (value) => {
      const next = quantizeEnvChannel(value)
      setTurbulenceOverride(next)
      syncedTurbulenceRef.current = next
      if (!lifeA.life.dead) lifeA.setTurbulence(next)
      if (!lifeB.life.dead) lifeB.setTurbulence(next)
    },
    [lifeA, lifeB],
  )

  const multipliers = useMemo(
    () => temperatureDeformationMultipliers(affectedTemperature, coupling),
    [affectedTemperature, coupling],
  )

  const resolveAffectedLife = useCallback(
    (sourceLife, elapsed) => {
      const override = temperatureOverrideRef.current
      const liveTemp =
        environmentRef.current?.values?.temperature ?? BASELINE_TEMPERATURE
      const temperature = override == null ? liveTemp : override
      return resolveCoupledLife(sourceLife, {
        temperature,
        sharedElapsed: elapsed,
        coupling,
        role: 'affected',
      })
    },
    [coupling, environmentRef],
  )

  const spatialA = useMemo(
    () =>
      resolveSpatialSampler({
        seed: lifeA.life.seed,
        temperature: affectedTemperature,
        coupling,
        role: 'affected',
      }),
    [lifeA.life.seed, affectedTemperature, coupling],
  )

  const spatialB = useMemo(
    () =>
      resolveSpatialSampler({
        seed: lifeB.life.seed,
        temperature: affectedTemperature,
        coupling,
        role: 'affected',
      }),
    [lifeB.life.seed, affectedTemperature, coupling],
  )

  const memorySamplerA = useMemo(
    () =>
      createStructuralMemorySampler({
        seed: lifeA.life.seed,
        thermalExposure: memoryA.thermalExposure,
        exposureBias: memoryA.exposureBias || 1,
        memory: thermalMemory,
      }),
    [lifeA.life.seed, memoryA.thermalExposure, memoryA.exposureBias, thermalMemory],
  )

  const memorySamplerB = useMemo(
    () =>
      createStructuralMemorySampler({
        seed: lifeB.life.seed,
        thermalExposure: memoryB.thermalExposure,
        exposureBias: memoryB.exposureBias || 1,
        memory: thermalMemory,
      }),
    [lifeB.life.seed, memoryB.thermalExposure, memoryB.exposureBias, thermalMemory],
  )

  const offsetA = combineRadialOffsets(
    spatialA.active ? spatialA.sampleOffset : null,
    memorySamplerA.active ? memorySamplerA.sampleOffset : null,
  )
  const offsetB = combineRadialOffsets(
    spatialB.active ? spatialB.sampleOffset : null,
    memorySamplerB.active ? memorySamplerB.sampleOffset : null,
  )

  const organisms = useMemo(
    () => [
      {
        id: 'organism-a',
        life: lifeA.life,
        onStimulus: lifeA.addStimulus,
        position: POSITION_A,
        resolveLifeForRender: resolveAffectedLife,
        breathAmplitude: COMPARE_BREATH_AMPLITUDE,
        deformAmplitudeScale: multipliers.amplitude,
        deformFrequencyScale: multipliers.frequency,
        extraRadialOffset: offsetA,
      },
      {
        id: 'organism-b',
        life: lifeB.life,
        onStimulus: lifeB.addStimulus,
        position: POSITION_B,
        resolveLifeForRender: resolveAffectedLife,
        breathAmplitude: COMPARE_BREATH_AMPLITUDE,
        deformAmplitudeScale: multipliers.amplitude,
        deformFrequencyScale: multipliers.frequency,
        extraRadialOffset: offsetB,
      },
    ],
    [
      lifeA.life,
      lifeA.addStimulus,
      lifeB.life,
      lifeB.addStimulus,
      resolveAffectedLife,
      multipliers.amplitude,
      multipliers.frequency,
      offsetA,
      offsetB,
    ],
  )

  const lifeMoistureA =
    lifeA.life.environment?.moisture ?? ENV_MOISTURE_NEUTRAL
  const lifeTurbulenceA =
    lifeA.life.environment?.turbulence ?? ENV_TURBULENCE_DEFAULT

  return (
    <article className="playground-experiment playground-experiment--exp02">
      <header className="playground-experiment__intro">
        <p className="playground-experiment__eyebrow">Playground · Experiment 02</p>
        <h1 className="playground-experiment__title">{title}</h1>
        <p className="playground-experiment__desc">{description}</p>
      </header>

      <div className="playground-experiment__workspace">
        <div className="playground-experiment__stage">
          <section
            className="playground-experiment__scene playground-experiment__scene--live playground-experiment__scene--exp02"
            aria-label="Shared scene with organisms A and B"
          >
            <WorldViewport
              className="playground-experiment__viewport"
              view="exterior"
              organisms={organisms}
              backgroundStudy={BACKGROUND_STUDY}
              onCameraReset={resetCameraView}
              sharedTimeRef={sharedTimeRef}
              sharedOrbitRef={sharedOrbitRef}
              orbitPivot={ORBIT_PIVOT}
              cameraPosition={SHARED_CAMERA_POSITION}
            />
            <div className="playground-experiment__exp02-labels" aria-hidden="true">
              <span>Organism A</span>
              <span>Organism B</span>
            </div>
            <div className="playground-experiment__scene-chrome">
              <div className="playground-experiment__scene-hud">
                <span>
                  Shared scene · A seed {LIFE_A_SEED} · B seed {LIFE_B_SEED}
                </span>
                <button type="button" onClick={handleRestartBoth}>
                  Reset Both
                </button>
                <button
                  type="button"
                  aria-pressed={freezeSimTime}
                  onClick={() => setFreezeSimTime((v) => !v)}
                >
                  {freezeSimTime ? 'Resume Time' : 'Pause Time'}
                </button>
              </div>
            </div>
          </section>

          <div className="playground-experiment__language">
            <span
              className="playground-experiment__controls-label"
              id="exp02-language-label"
            >
              Language
            </span>
            <textarea
              id="exp02-language-input"
              className="playground-experiment__language-input"
              value={languageText}
              onChange={(event) => setLanguageText(event.target.value)}
              onKeyDown={onLanguageKeyDown}
              rows={2}
              placeholder="Type a complete sentence about the environment…"
              spellCheck
              aria-labelledby="exp02-language-label"
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
                Same env input syncs to A and B independently · Enter to send
              </span>
            </div>
            {history.length > 0 ? (
              <ul
                className="playground-experiment__history"
                aria-label="Interaction history"
              >
                {history.map((entry, index) => (
                  <li key={`${index}-${entry.text}`}>
                    <span>{entry.text}</span>
                    {entry.applied ? (
                      <em className="playground-experiment__history-tag">
                        applied
                      </em>
                    ) : (
                      <em className="playground-experiment__history-tag">
                        ignored
                      </em>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <aside
          className="playground-experiment__controls"
          aria-label="Experiment 02 controls"
        >
          <p className="playground-experiment__controls-label">Controls</p>
          <p className="playground-experiment__controls-note">
            Two independent Life Engines in one Canvas. Language env applies the
            same Temperature / Moisture / Disturbance→Turbulence to both; each
            keeps its own AGE, crystals, and env history. No organism coupling.
          </p>

          <OrganismControls
            label="Organism A"
            seed={LIFE_A_SEED}
            life={lifeA.life}
            playing={lifeA.playing}
            freezeAge={freezeAgeA}
            onTogglePlaying={handleToggleA}
            onRestart={handleRestartA}
            onToggleFreezeAge={() => setFreezeAgeA((v) => !v)}
            onSeekAge={seekA}
          />

          <OrganismControls
            label="Organism B"
            seed={LIFE_B_SEED}
            life={lifeB.life}
            playing={lifeB.playing}
            freezeAge={freezeAgeB}
            onTogglePlaying={handleToggleB}
            onRestart={handleRestartB}
            onToggleFreezeAge={() => setFreezeAgeB((v) => !v)}
            onSeekAge={seekB}
          />

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
                        : undefined
                  }
                >
                  <span className="playground-experiment__env-current">
                    {environment[key].toFixed(2)}
                  </span>
                  <span className="playground-experiment__trend" aria-hidden="true">
                    {trends[key] > 0 ? '↑' : trends[key] < 0 ? '↓' : '·'}
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
            aria-label="Crystal moisture"
          >
            <p className="playground-experiment__controls-label">
              Crystal Moisture
            </p>
            <p className="playground-experiment__controls-note">
              Applies to both organisms (independent rebuild / history). Live
              follows language Moisture.
            </p>
            <div className="playground-experiment__preset-row">
              {[0.2, 0.5, 0.8].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    moistureOverride != null &&
                    Math.abs(moistureOverride - value) < 0.005
                      ? 'playground-experiment__preset is-active'
                      : 'playground-experiment__preset'
                  }
                  onClick={() => handleManualMoisture(value)}
                >
                  {value.toFixed(2)}
                </button>
              ))}
              <button
                type="button"
                className={
                  moistureOverride == null
                    ? 'playground-experiment__preset is-active'
                    : 'playground-experiment__preset'
                }
                onClick={() => {
                  setMoistureOverride(null)
                  syncedMoistureRef.current = null
                }}
              >
                Live
              </button>
            </div>
            <label className="playground-experiment__tuning-row">
              <span>
                Moisture
                <em>
                  {lifeMoistureA.toFixed(2)}
                  {moistureOverride == null ? ' · live' : ' · override'}
                </em>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={lifeMoistureA}
                onChange={(event) =>
                  handleManualMoisture(Number(event.target.value))
                }
              />
            </label>
          </div>

          <div
            className="playground-experiment__coupling"
            aria-label="Membrane turbulence"
          >
            <p className="playground-experiment__controls-label">
              Membrane Turbulence
            </p>
            <div className="playground-experiment__preset-row">
              {[0, 0.5, 1].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    turbulenceOverride != null &&
                    Math.abs(turbulenceOverride - value) < 0.005
                      ? 'playground-experiment__preset is-active'
                      : 'playground-experiment__preset'
                  }
                  onClick={() => handleManualTurbulence(value)}
                >
                  {value.toFixed(2)}
                </button>
              ))}
              <button
                type="button"
                className={
                  turbulenceOverride == null
                    ? 'playground-experiment__preset is-active'
                    : 'playground-experiment__preset'
                }
                onClick={() => {
                  setTurbulenceOverride(null)
                  syncedTurbulenceRef.current = null
                }}
              >
                Live
              </button>
            </div>
            <label className="playground-experiment__tuning-row">
              <span>
                Turbulence
                <em>
                  {lifeTurbulenceA.toFixed(2)}
                  {turbulenceOverride == null ? ' · live' : ' · override'}
                </em>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={lifeTurbulenceA}
                onChange={(event) =>
                  handleManualTurbulence(Number(event.target.value))
                }
              />
            </label>
          </div>

          <div
            className="playground-experiment__coupling"
            aria-label="Temperature"
          >
            <p className="playground-experiment__controls-label">
              Temperature
            </p>
            <div className="playground-experiment__preset-row">
              {[0.3, 0.5, 0.7, 1.0].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    temperatureOverride != null &&
                    Math.abs(temperatureOverride - value) < 0.005
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
                className={
                  temperatureOverride == null
                    ? 'playground-experiment__preset is-active'
                    : 'playground-experiment__preset'
                }
                onClick={() => setTemperatureOverride(null)}
              >
                Live
              </button>
            </div>
            <dl className="playground-experiment__coupling-readout">
              <div>
                <dt>Preview T</dt>
                <dd>{affectedTemperature.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Memory A / B</dt>
                <dd>
                  {persistentMemoryMagnitude(
                    memoryA.thermalExposure,
                    thermalMemory,
                  ).toFixed(2)}
                  {' / '}
                  {persistentMemoryMagnitude(
                    memoryB.thermalExposure,
                    thermalMemory,
                  ).toFixed(2)}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              className="playground-experiment__reset-env"
              onClick={clearMemories}
            >
              Clear Structural Memory
            </button>
            <button
              type="button"
              className="playground-experiment__reset-env"
              onClick={resetEnvironment}
            >
              Reset Environment
            </button>
          </div>

          <div className="playground-experiment__parse-feedback">
            <p className="playground-experiment__controls-label">Last Parse</p>
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
                  {lastParse.applied
                    ? 'Applied to environment'
                    : 'Ignored — no impulse'}
                </p>
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
        </aside>
      </div>
    </article>
  )
}
