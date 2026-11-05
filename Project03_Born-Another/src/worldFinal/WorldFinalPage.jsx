import { useCallback, useMemo, useState } from 'react'
import SiteHud from '../SiteHud.jsx'
import { useAutoHideHeader } from '../useAutoHideHeader.js'
import '../playground/playground.css'
import {
  normalizeWorldFinalConfig,
  WORLD_FINAL_DEFAULTS,
} from './config.js'
import WorldFinalScene from './WorldFinalScene.jsx'
import './worldFinal.css'

const fixed = (digits) => (v) => Number(v).toFixed(digits)

/** Primary controls, grouped macro → meso → micro. */
const TERRAIN_GROUPS = [
  {
    label: 'Basin',
    sliders: [
      { key: 'basinDepth', label: 'Basin depth', min: 0, max: 120, step: 1, format: fixed(0) },
      {
        key: 'basinWidth',
        label: 'Basin width',
        min: 0.45,
        max: 1.05,
        step: 0.01,
        format: (v) => `${Math.round(v * 100)}%`,
      },
      { key: 'basinAsymmetry', label: 'Basin asymmetry', min: 0, max: 1, step: 0.01, format: fixed(2) },
    ],
  },
  {
    label: 'Ridges',
    sliders: [
      { key: 'ridgeHeight', label: 'Ridge height', min: 0, max: 18, step: 0.1, format: fixed(1) },
      { key: 'ridgeSpacing', label: 'Ridge spacing', min: 50, max: 260, step: 1, format: fixed(0) },
    ],
  },
  {
    label: 'Surface',
    sliders: [
      { key: 'surfaceDetail', label: 'Surface detail', min: 0, max: 3, step: 0.05, format: fixed(2) },
      { key: 'seed', label: 'Seed', min: 1, max: 9999, step: 1, format: (v) => String(Math.floor(v)) },
    ],
  },
]

const ATMOSPHERE_SLIDERS = [
  { key: 'lightIntensity', label: 'Light intensity', min: 0, max: 2, step: 0.01, format: fixed(2) },
  {
    key: 'colorBalance',
    label: 'Color balance',
    min: -1,
    max: 1,
    step: 0.01,
    format: (v) => (Math.abs(v) < 0.005 ? 'pearl' : `${v < 0 ? 'cool' : 'warm'} ${Math.abs(v).toFixed(2)}`),
  },
  {
    key: 'fogDensity',
    label: 'Fog density',
    min: 0,
    max: 0.005,
    step: 0.0001,
    format: (v) => (v * 1000).toFixed(1),
  },
  { key: 'fogDistance', label: 'Fog distance', min: 0, max: 400, step: 5, format: (v) => `${Math.round(v)} u` },
  { key: 'valleyHaze', label: 'Valley haze', min: 0, max: 1, step: 0.01, format: fixed(2) },
  { key: 'lightFiltering', label: 'Light filtering', min: 0, max: 1, step: 0.01, format: fixed(2) },
]

const SEDIMENT_SLIDERS = [
  { key: 'sedimentGrain', label: 'Sediment grain', min: 0, max: 2, step: 0.01, format: fixed(2) },
]

const SPEED_SLIDER = {
  key: 'maxSpeed',
  label: 'Move speed',
  min: 5,
  max: 120,
  step: 1,
  format: (v) => `${Math.round(v)} u/s`,
}

const ADVANCED_SLIDERS = [
  {
    key: 'gridRes',
    label: 'Grid resolution',
    min: 128,
    max: 512,
    step: 16,
    format: (v) => String(Math.round(v)),
  },
]

const CAMERA_MODES = [
  { id: 'drift', label: 'Drift' },
  { id: 'explore', label: 'Explore fixed' },
  { id: 'overview', label: 'Overview' },
]

const MATERIAL_MODES = [
  { id: 'shaded', label: 'Shaded' },
  { id: 'diagnostic', label: 'Neutral + wire' },
  { id: 'normals', label: 'Normals' },
]

function Slider({ slider, value, onChange }) {
  return (
    <label className="world-final-page__slider">
      <span>
        {slider.label}
        <em>{slider.format(value)}</em>
      </span>
      <input
        type="range"
        min={slider.min}
        max={slider.max}
        step={slider.step}
        value={value}
        aria-label={slider.label}
        onChange={(event) => onChange(slider.key, Number(event.target.value))}
      />
    </label>
  )
}

function ModeRow({ label, modes, value, onSelect }) {
  return (
    <div className="world-final-page__mode-row" role="group" aria-label={label}>
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          className={
            value === mode.id ? 'world-final-page__mode is-active' : 'world-final-page__mode'
          }
          onClick={() => onSelect(mode.id)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Top-level World Final tab — M1.3 basin morphology + M2A atmosphere.
 * UI chrome matches Playground Experiment 04 (Final Form Lab / exp05-*).
 */
export default function WorldFinalPage({ header }) {
  const { hidden, scrolled, scrollerRef } = useAutoHideHeader()
  const [terrain, setTerrain] = useState(() =>
    normalizeWorldFinalConfig(WORLD_FINAL_DEFAULTS),
  )
  const [resetEpoch, setResetEpoch] = useState(0)
  const [cameraMode, setCameraMode] = useState('explore')
  const [showHelpers, setShowHelpers] = useState(false)
  const [fogEnabled, setFogEnabled] = useState(true)
  const [materialMode, setMaterialMode] = useState('shaded')
  const [debugSample, setDebugSample] = useState(null)

  const cfg = useMemo(() => normalizeWorldFinalConfig(terrain), [terrain])

  const setParam = useCallback((key, value) => {
    setTerrain((current) =>
      normalizeWorldFinalConfig({ ...current, [key]: value }),
    )
  }, [])

  const handleResetParams = useCallback(() => {
    setTerrain(normalizeWorldFinalConfig(WORLD_FINAL_DEFAULTS))
    setResetEpoch((n) => n + 1)
  }, [])

  const handleResetCamera = useCallback(() => {
    setResetEpoch((n) => n + 1)
  }, [])

  const handleCameraMode = useCallback((mode) => {
    setCameraMode(mode)
    setResetEpoch((n) => n + 1)
  }, [])

  /* WASD / drag / scroll in a fixed preset: switch without resetting. */
  const handleRequestDrift = useCallback(() => {
    setCameraMode('drift')
  }, [])

  const handleDebugSample = useCallback((sample) => {
    setDebugSample(sample)
  }, [])

  return (
    <div className="playground-page playground-page--exp05 world-final-page">
      <SiteHud
        className="playground-page__hud"
        hidden={hidden}
        scrolled={scrolled}
      >
        {header}
      </SiteHud>

      <main className="playground-page__content" ref={scrollerRef}>
        <article className="playground-experiment playground-experiment--exp05">
          <div className="exp05-immerse" aria-label="World Final">
            <WorldFinalScene
              config={cfg}
              className="exp05-viewport"
              resetEpoch={resetEpoch}
              cameraMode={cameraMode}
              showHelpers={showHelpers}
              fogEnabled={fogEnabled}
              materialMode={materialMode}
              onDebugSample={handleDebugSample}
              onRequestDrift={handleRequestDrift}
            />

            <header className="exp05-intro">
              <p className="exp05-intro__eyebrow">World Final · M2B</p>
              <h1 className="exp05-intro__title">Seabed Basin</h1>
              <p className="exp05-intro__desc">
                A broad, asymmetric basin organised by long sediment ridges,
                settled with soft silt and dissolving into pearl-lavender water.
              </p>
            </header>

            <aside className="exp05-panel" aria-label="World Final terrain controls">
              <p className="exp05-panel__label">View</p>
              <ModeRow
                label="Camera mode"
                modes={CAMERA_MODES}
                value={cameraMode}
                onSelect={handleCameraMode}
              />
              <p className="world-final-page__view-hint">
                {cameraMode === 'drift'
                  ? 'WASD move · Shift sprint · Q / E down / up · drag look · scroll zoom'
                  : 'Scroll to zoom · press WASD, Q / E or drag to start drifting from here'}
              </p>
              <Slider slider={SPEED_SLIDER} value={cfg.maxSpeed} onChange={setParam} />

              <p className="exp05-panel__label">Terrain</p>
              <p className="exp05-panel__note">
                Three scales: basin (macro), sediment ridges (meso), surface
                detail (micro). Lifecycle zones are spatial logic only.
              </p>

              {TERRAIN_GROUPS.map((group) => (
                <div key={group.label} className="world-final-page__group">
                  <p className="world-final-page__group-label">{group.label}</p>
                  {group.sliders.map((slider) => (
                    <Slider
                      key={slider.key}
                      slider={slider}
                      value={cfg[slider.key]}
                      onChange={setParam}
                    />
                  ))}
                </div>
              ))}

              <p className="exp05-panel__label">Atmosphere</p>
              <div className="world-final-page__group">
                {ATMOSPHERE_SLIDERS.map((slider) => (
                  <Slider
                    key={slider.key}
                    slider={slider}
                    value={cfg[slider.key]}
                    onChange={setParam}
                  />
                ))}
              </div>
              <div className="world-final-page__group">
                <p className="world-final-page__group-label">Sediment</p>
                {SEDIMENT_SLIDERS.map((slider) => (
                  <Slider
                    key={slider.key}
                    slider={slider}
                    value={cfg[slider.key]}
                    onChange={setParam}
                  />
                ))}
              </div>

              <details className="world-final-page__advanced">
                <summary>Advanced · debug</summary>
                {ADVANCED_SLIDERS.map((slider) => (
                  <Slider
                    key={slider.key}
                    slider={slider}
                    value={cfg[slider.key]}
                    onChange={setParam}
                  />
                ))}

                <p className="world-final-page__group-label">Material</p>
                <ModeRow
                  label="Material mode"
                  modes={MATERIAL_MODES}
                  value={materialMode}
                  onSelect={setMaterialMode}
                />

                <label className="world-final-page__check">
                  <input
                    type="checkbox"
                    checked={fogEnabled}
                    onChange={(event) => setFogEnabled(event.target.checked)}
                  />
                  Distance + valley haze
                </label>
                <label className="world-final-page__check">
                  <input
                    type="checkbox"
                    checked={showHelpers}
                    onChange={(event) => setShowHelpers(event.target.checked)}
                  />
                  Axes, XZ grid, preset markers + camera readout
                </label>
              </details>

              <p className="exp05-panel__hint">
                Explore fixed and Overview are presets; any movement input
                switches to Drift.
              </p>
            </aside>

            {debugSample && showHelpers && (
              <pre className="world-final-page__debug-hud" aria-live="polite">
                {`mode ${debugSample.mode}
pos  ${fmt(debugSample.x)} ${fmt(debugSample.y)} ${fmt(debugSample.z)}
rot  ${fmt(debugSample.rotX)} ${fmt(debugSample.rotY)} ${fmt(debugSample.rotZ)}  (YXZ rad)
fwd  ${fmt(debugSample.fwdX)} ${fmt(debugSample.fwdY)} ${fmt(debugSample.fwdZ)}
groundY ${fmt(debugSample.groundY)}  clearance ${fmt(debugSample.y - debugSample.groundY)}
fov  ${fmt(debugSample.fov)}`}
              </pre>
            )}

            <div className="exp05-chrome">
              <div className="exp05-chrome__actions">
                <button type="button" onClick={handleResetCamera}>
                  Reset camera
                </button>
                <button type="button" onClick={handleResetParams}>
                  Reset terrain + atmosphere
                </button>
              </div>
              <p className="exp05-chrome__hint">
                WASD · move · Shift · sprint · Q / E · elevation · drag · look · scroll · zoom
              </p>
            </div>
          </div>
        </article>
      </main>
    </div>
  )
}

function fmt(n) {
  return Number(n).toFixed(2).padStart(7, ' ')
}
