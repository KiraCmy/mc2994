import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WorldViewport } from '../worldv2/WorldViewport.jsx'
import { useLifeEngine } from '../worldv2/life/useLifeEngine.js'
import { createWorldGeometry } from '../worldv2/worldGeometry.js'
import '../worldv2/worldV2.css'
import {
  createMorphologyRadiusAt,
  DEFAULT_MORPHOLOGY_PARAMS,
  MORPHOLOGY_IDS,
  MORPHOLOGY_PRESETS,
} from './morphologyLab/morphologyPresets.js'

const BACKGROUND_STUDY = 'dark'
/** Distinct seeds so crystal scatter differs while morphology drives silhouette. */
const FORM_SEEDS = {
  flattened: 7319,
  spiral: 9043,
  segmented: 5129,
}
const POSITIONS = {
  flattened: [-5.2, 0, 0],
  spiral: [0, 0, 0],
  segmented: [5.2, 0, 0],
}
const ORBIT_PIVOT = [0, 0, 0]
const SHARED_CAMERA_POSITION = [0, 1.2, -22]
const SHARED_ORBIT_RADIUS = 22

const SLIDERS = {
  flattened: [
    { key: 'radius', label: 'Radius', min: 1.4, max: 2.6, step: 0.02 },
    { key: 'flatten', label: 'Flatten', min: 0.15, max: 0.88, step: 0.01 },
    { key: 'rim', label: 'Rim', min: 0, max: 0.4, step: 0.01 },
  ],
  spiral: [
    { key: 'radius', label: 'Radius', min: 1.4, max: 2.6, step: 0.02 },
    { key: 'turns', label: 'Turns', min: 0.8, max: 4.5, step: 0.05 },
    { key: 'bulge', label: 'Bulge', min: 0.05, max: 0.5, step: 0.01 },
    { key: 'taper', label: 'Taper', min: 0, max: 0.4, step: 0.01 },
  ],
  segmented: [
    { key: 'radius', label: 'Radius', min: 1.4, max: 2.5, step: 0.02 },
    { key: 'segments', label: 'Segments', min: 2, max: 6, step: 1 },
    { key: 'lobe', label: 'Lobe', min: 0.05, max: 0.45, step: 0.01 },
    { key: 'waist', label: 'Waist', min: 0, max: 0.3, step: 0.01 },
  ],
}

function createCloseOrbitState() {
  return {
    theta: Math.atan2(SHARED_CAMERA_POSITION[0], SHARED_CAMERA_POSITION[2]),
    phi: Math.acos(
      SHARED_CAMERA_POSITION[1] /
        Math.hypot(...SHARED_CAMERA_POSITION),
    ),
    radius: SHARED_ORBIT_RADIUS,
    revision: 0,
  }
}

function makeGeometryFactory(morphologyId, params) {
  const radiusAt = createMorphologyRadiusAt(morphologyId, params)
  return (seed) => createWorldGeometry(seed, { radiusAt })
}

/**
 * Experiment 04 — Morphology Lab
 * Three radial rest-shape presets in one WorldViewport (Exp 02 pattern).
 */
export default function Experiment04({ title, description }) {
  const [params, setParams] = useState(() => ({
    flattened: { ...DEFAULT_MORPHOLOGY_PARAMS.flattened },
    spiral: { ...DEFAULT_MORPHOLOGY_PARAMS.spiral },
    segmented: { ...DEFAULT_MORPHOLOGY_PARAMS.segmented },
  }))
  const [activeForm, setActiveForm] = useState('flattened')
  const [freezeAge, setFreezeAge] = useState(false)
  const [geometryRevision, setGeometryRevision] = useState(0)
  const sharedTimeRef = useRef(0)
  const sharedOrbitRef = useRef(createCloseOrbitState())
  const freezeAgeRef = useRef(false)
  freezeAgeRef.current = freezeAge

  const lifeFlat = useLifeEngine(FORM_SEEDS.flattened)
  const lifeSpiral = useLifeEngine(FORM_SEEDS.spiral)
  const lifeSeg = useLifeEngine(FORM_SEEDS.segmented)

  const engines = useMemo(
    () => ({
      flattened: lifeFlat,
      spiral: lifeSpiral,
      segmented: lifeSeg,
    }),
    [lifeFlat, lifeSpiral, lifeSeg],
  )

  useEffect(() => {
    for (const id of MORPHOLOGY_IDS) engines[id].setPlaying(true)
    return () => {
      for (const id of MORPHOLOGY_IDS) engines[id].setPlaying(false)
    }
    // Mount-only: start the three independent clocks together.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!freezeAge) return undefined
    for (const id of MORPHOLOGY_IDS) engines[id].setPlaying(false)
    return undefined
  }, [freezeAge, engines])

  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - previous) / 1000)
      previous = now
      if (!freezeAgeRef.current) sharedTimeRef.current += dt
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const organisms = useMemo(
    () =>
      MORPHOLOGY_IDS.map((id) => ({
        id: `morph-${id}`,
        life: engines[id].life,
        onStimulus: engines[id].addStimulus,
        position: POSITIONS[id],
        createGeometry: makeGeometryFactory(id, params[id]),
        geometryRevision,
        autoRotate: true,
      })),
    [engines, params, geometryRevision],
  )

  const bumpGeometry = useCallback(() => {
    setGeometryRevision((n) => n + 1)
  }, [])

  const setParam = useCallback(
    (formId, key, value) => {
      setParams((current) => ({
        ...current,
        [formId]: { ...current[formId], [key]: value },
      }))
      bumpGeometry()
    },
    [bumpGeometry],
  )

  const handleTogglePlay = useCallback(() => {
    if (freezeAgeRef.current) {
      setFreezeAge(false)
      for (const id of MORPHOLOGY_IDS) engines[id].setPlaying(true)
      return
    }
    const anyPlaying = MORPHOLOGY_IDS.some((id) => engines[id].playing)
    for (const id of MORPHOLOGY_IDS) engines[id].setPlaying(!anyPlaying)
  }, [engines])

  const handleRestart = useCallback(() => {
    setFreezeAge(false)
    for (const id of MORPHOLOGY_IDS) {
      engines[id].restart({ clearEnvironment: true })
    }
    sharedOrbitRef.current = {
      ...createCloseOrbitState(),
      revision: (sharedOrbitRef.current?.revision ?? 0) + 1,
    }
  }, [engines])

  const handleSeekAge = useCallback(
    (age) => {
      setFreezeAge(true)
      for (const id of MORPHOLOGY_IDS) {
        engines[id].seekToAge(age, { resume: false })
      }
    },
    [engines],
  )

  const handleResetCamera = useCallback(() => {
    sharedOrbitRef.current = {
      ...createCloseOrbitState(),
      revision: (sharedOrbitRef.current?.revision ?? 0) + 1,
    }
  }, [])

  const primaryAge = engines.flattened.life.age
  const anyPlaying = MORPHOLOGY_IDS.some((id) => engines[id].playing)
  const formSliders = SLIDERS[activeForm] ?? []

  return (
    <article className="playground-experiment playground-experiment--exp04">
      <header className="playground-experiment__intro">
        <p className="playground-experiment__eyebrow">Playground · Experiment 04</p>
        <h1 className="playground-experiment__title">{title}</h1>
        <p className="playground-experiment__desc">{description}</p>
      </header>

      <div className="playground-experiment__workspace playground-experiment__workspace--exp04">
        <div className="playground-experiment__stage">
          <section
            className="playground-experiment__scene playground-experiment__scene--live playground-experiment__scene--exp04"
            aria-label="Morphology Lab shared viewport"
          >
            <WorldViewport
              className="playground-experiment__viewport"
              view="exterior"
              organisms={organisms}
              backgroundStudy={BACKGROUND_STUDY}
              onCameraReset={handleResetCamera}
              sharedTimeRef={sharedTimeRef}
              sharedOrbitRef={sharedOrbitRef}
              orbitPivot={ORBIT_PIVOT}
              cameraPosition={SHARED_CAMERA_POSITION}
            />
            <div className="playground-experiment__scene-chrome">
              <div className="playground-experiment__scene-hud">
                <span>
                  Morphology Lab · one Canvas · three rest shapes
                  {freezeAge ? ' · Frozen' : ''}
                </span>
                <button type="button" onClick={handleTogglePlay}>
                  {anyPlaying && !freezeAge ? 'Pause' : 'Play'}
                </button>
                <button type="button" onClick={handleRestart}>
                  Reset
                </button>
                <button
                  type="button"
                  aria-pressed={freezeAge}
                  onClick={() => setFreezeAge((v) => !v)}
                >
                  {freezeAge ? 'Unfreeze AGE' : 'Freeze AGE'}
                </button>
                <button type="button" onClick={handleResetCamera}>
                  Reset Camera
                </button>
              </div>
              <div
                className="playground-experiment__exp04-labels"
                aria-hidden="true"
              >
                {MORPHOLOGY_IDS.map((id) => (
                  <span key={id}>{MORPHOLOGY_PRESETS[id].label}</span>
                ))}
              </div>
              <label className="playground-experiment__timeline">
                <span className="playground-experiment__timeline-labels">
                  <span>AGE</span>
                  <span>{primaryAge.toFixed(3)}</span>
                </span>
                <input
                  className="playground-experiment__timeline-range"
                  type="range"
                  min={0}
                  max={1}
                  step={0.001}
                  value={primaryAge}
                  aria-valuemin={0}
                  aria-valuemax={1}
                  aria-valuenow={Number(primaryAge.toFixed(3))}
                  onPointerDown={() => setFreezeAge(true)}
                  onChange={(event) =>
                    handleSeekAge(Number(event.target.value))
                  }
                />
              </label>
            </div>
          </section>
        </div>

        <aside
          className="playground-experiment__controls"
          aria-label="Morphology Lab controls"
        >
          <p className="playground-experiment__controls-label">Rest shapes</p>
          <p className="playground-experiment__controls-note">
            Flattened / Spiral / Segmented inject only a radial rest field into
            the existing World geometry pipeline. Membrane deform, growth sites,
            and crystals stay on the World path. One Canvas (Exp 02 pattern).
          </p>

          <div
            className="playground-experiment__study-tabs"
            role="tablist"
            aria-label="Morphology form"
          >
            {MORPHOLOGY_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeForm === id}
                className={`playground-experiment__study-tab${
                  activeForm === id ? ' is-active' : ''
                }`}
                onClick={() => setActiveForm(id)}
              >
                <span>Form</span>
                <em>{MORPHOLOGY_PRESETS[id].label}</em>
              </button>
            ))}
          </div>

          <p className="playground-experiment__controls-note">
            {MORPHOLOGY_PRESETS[activeForm].description} · seed{' '}
            {FORM_SEEDS[activeForm]}
          </p>

          {formSliders.map((slider) => (
            <label
              key={slider.key}
              className="playground-experiment__tuning-row"
            >
              <span>
                {slider.label}
                <em>{Number(params[activeForm][slider.key]).toFixed(2)}</em>
              </span>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={params[activeForm][slider.key]}
                onChange={(event) =>
                  setParam(
                    activeForm,
                    slider.key,
                    Number(event.target.value),
                  )
                }
              />
            </label>
          ))}

          <button
            type="button"
            className="playground-experiment__preset"
            onClick={() => {
              setParams((current) => ({
                ...current,
                [activeForm]: {
                  ...DEFAULT_MORPHOLOGY_PARAMS[activeForm],
                },
              }))
              bumpGeometry()
            }}
          >
            Reset {MORPHOLOGY_PRESETS[activeForm].label} params
          </button>
        </aside>
      </div>
    </article>
  )
}
