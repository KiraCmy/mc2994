import { useState } from 'react'
import { MATERIAL_FAMILIES } from './surfaceParams.js'

const SURFACE_SLIDERS = [
  { key: 'fresnelPower', label: 'Fresnel', min: 1, max: 6, step: 0.05 },
  { key: 'rimStrength', label: 'Strength', min: 0, max: 1, step: 0.01 },
  { key: 'opacity', label: 'Opacity', min: 0.35, max: 1, step: 0.01 },
]

const SURFACE_COLORS = [
  { key: 'colorA', label: 'Lower' },
  { key: 'colorB', label: 'Upper' },
  { key: 'rimColor', label: 'Rim' },
]

const IDENTITY_SLIDERS = [
  { key: 'seed', label: 'Seed', min: 0, max: 999999, step: 1, integers: true },
  { key: 'noiseScale', label: 'Noise Scale', min: 0.4, max: 5.5, step: 0.05 },
  { key: 'patternContrast', label: 'Pattern Contrast', min: 0, max: 1, step: 0.01 },
  { key: 'accentStrength', label: 'Accent Strength', min: 0, max: 1, step: 0.01 },
]

const IDENTITY_COLORS = [{ key: 'accentColor', label: 'Accent Color' }]

const DEVELOPMENT_SLIDERS = [
  { key: 'age', label: 'Age', min: 0, max: 1, step: 0.01 },
  { key: 'speed', label: 'Speed', min: 0, max: 0.7, step: 0.01 },
  { key: 'pulseSpeed', label: 'Pulse', min: 0.1, max: 3, step: 0.01 },
  { key: 'displacement', label: 'Displacement', min: 0, max: 0.45, step: 0.001 },
  { key: 'noiseAmount', label: 'Identity Noise', min: 0, max: 2.5, step: 0.01 },
]

const DECAY_SLIDERS = [
  { key: 'age', label: 'Age', min: 0, max: 1, step: 0.01 },
  { key: 'decayStart', label: 'Decay Start', min: 0.2, max: 0.9, step: 0.01 },
  { key: 'edgeSoftness', label: 'Edge Softness', min: 0.02, max: 0.35, step: 0.01 },
  { key: 'boundaryWidth', label: 'Boundary', min: 0.02, max: 0.2, step: 0.005 },
  { key: 'discardThreshold', label: 'Discard', min: 0.01, max: 0.25, step: 0.01 },
  { key: 'decayDisplacement', label: 'Instability', min: 0, max: 0.18, step: 0.001 },
  { key: 'decayScale', label: 'Decay Scale', min: 0.8, max: 5, step: 0.05 },
]

const DECAY_COLORS = [{ key: 'decayAccent', label: 'Decay Accent' }]

const TRACE_SLIDERS = [
  { key: 'age', label: 'Age', min: 0, max: 1, step: 0.01 },
  { key: 'traceThreshold', label: 'Density', min: 0.2, max: 0.9, step: 0.01 },
  { key: 'traceScale', label: 'Trace Scale', min: 0.6, max: 5, step: 0.05 },
  { key: 'internalTrace', label: 'Internal', min: 0, max: 1, step: 0.01 },
  { key: 'rimTrace', label: 'Rim Trace', min: 0, max: 1, step: 0.01 },
  { key: 'boundaryTrace', label: 'Boundary', min: 0, max: 1, step: 0.01 },
  { key: 'traceOpacity', label: 'Opacity', min: 0.05, max: 0.9, step: 0.01 },
  { key: 'traceFresnelPower', label: 'Fresnel', min: 1, max: 6, step: 0.05 },
  { key: 'persistence', label: 'Persistence', min: 0, max: 1, step: 0.01 },
]

const TRACE_COLORS = [{ key: 'traceColor', label: 'Trace Color' }]

const LIFECYCLE_SLIDERS = [
  { key: 'age', label: 'Age', min: 0, max: 1, step: 0.01 },
]

const MATERIAL_SLIDERS = [
  { key: 'age', label: 'Age', min: 0, max: 1, step: 0.01 },
  { key: 'clarity', label: 'Clarity', min: 0, max: 1, step: 0.01 },
  { key: 'fresnelPower', label: 'Fresnel', min: 1, max: 6, step: 0.05 },
  { key: 'iridescence', label: 'Iridescence', min: 0, max: 1, step: 0.01 },
  { key: 'internalContrast', label: 'Internal Contrast', min: 0, max: 1, step: 0.01 },
]

const BEHAVIOR_SLIDERS = [
  { key: 'age', label: 'Age', min: 0, max: 1, step: 0.01 },
  { key: 'thinning', label: 'Thinning', min: 0, max: 1, step: 0.01 },
  { key: 'fractureSharpness', label: 'Fracture', min: 0, max: 1, step: 0.01 },
  { key: 'lateWarp', label: 'Late Warp', min: 0.4, max: 1.4, step: 0.01 },
]

const LAYERED_SLIDERS = [
  { key: 'age', label: 'Age', min: 0, max: 1, step: 0.01 },
  { key: 'glow', label: 'Interior Glow', min: 0, max: 1.4, step: 0.01 },
  { key: 'foil', label: 'Foil Fracture', min: 0, max: 1.2, step: 0.01 },
  { key: 'iridescence', label: 'Iridescence', min: 0, max: 1, step: 0.01 },
  { key: 'grain', label: 'Edge Grain', min: 0, max: 1, step: 0.01 },
]

const SCATTER_SLIDERS = [
  { key: 'density', label: 'Density', min: 0, max: 1, step: 0.01 },
]

function formatValue(slider, value) {
  if (slider.integers) return String(Math.round(value))
  if (slider.key === 'displacement' || slider.key === 'decayDisplacement') {
    return Number(value).toFixed(3)
  }
  return Number(value).toFixed(2)
}

function controlsForStudy(studyId) {
  if (studyId === 'individuality') {
    return { sliders: IDENTITY_SLIDERS, colors: IDENTITY_COLORS, families: null, modes: null }
  }
  if (studyId === 'development') {
    return { sliders: DEVELOPMENT_SLIDERS, colors: [], families: null, modes: null }
  }
  if (studyId === 'decay') {
    return { sliders: DECAY_SLIDERS, colors: DECAY_COLORS, families: null, modes: null }
  }
  if (studyId === 'trace') {
    return { sliders: TRACE_SLIDERS, colors: TRACE_COLORS, families: null, modes: null }
  }
  if (studyId === 'lifecycle') {
    return { sliders: LIFECYCLE_SLIDERS, colors: [], families: null, modes: null }
  }
  if (studyId === 'material') {
    return { sliders: MATERIAL_SLIDERS, colors: [], families: MATERIAL_FAMILIES, modes: null }
  }
  if (studyId === 'behavior') {
    return { sliders: BEHAVIOR_SLIDERS, colors: [], families: MATERIAL_FAMILIES, modes: null }
  }
  if (studyId === 'layered') {
    return { sliders: LAYERED_SLIDERS, colors: [], families: null, modes: null }
  }
  return { sliders: SURFACE_SLIDERS, colors: SURFACE_COLORS, families: null, modes: null }
}

function controlsForMode(modeId, studyId) {
  if (modeId === 'scatter') {
    return {
      heading: 'Scatter Parameters',
      sliders: SCATTER_SLIDERS,
      colors: [],
      families: null,
      modes: null,
      actions: [{ key: 'regenerate', label: 'Regenerate' }],
    }
  }
  if (modeId === 'path') {
    return {
      heading: 'Path Parameters',
      sliders: [],
      colors: [],
      families: null,
      modes: null,
      actions: [],
    }
  }
  if (modeId === 'particle') {
    return {
      heading: 'Particle Parameters',
      sliders: [],
      colors: [],
      families: null,
      modes: null,
      actions: [],
    }
  }
  const studyControls = controlsForStudy(studyId)
  return {
    heading: null,
    ...studyControls,
    actions: [],
  }
}

export default function AdjustBar({ modeId = 'shader', study, params, onChange }) {
  const [open, setOpen] = useState(false)
  const controls = controlsForMode(modeId, study.id)
  const heading = controls.heading ?? study.heading
  const { sliders, colors, families, modes, actions } = controls

  return (
    <form
      className={`adjust${open ? ' is-open' : ''}`}
      onSubmit={(event) => event.preventDefault()}
    >
      {open && (
        <div className="adjust-panel">
          <p className="adjust-heading">{heading}</p>

          {modes && (
            <div className="adjust-families" role="tablist" aria-label="Layer visibility">
              {modes.map((mode) => {
                const active = params.mode === mode.id
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`adjust-family${active ? ' is-active' : ''}`}
                    onClick={() => onChange('mode', mode.id)}
                  >
                    {mode.label}
                  </button>
                )
              })}
            </div>
          )}

          {families && (
            <div className="adjust-families" role="tablist" aria-label="Material family">
              {families.map((family) => {
                const active = params.family === family.id
                return (
                  <button
                    key={family.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`adjust-family${active ? ' is-active' : ''}`}
                    onClick={() => onChange('family', family.id)}
                  >
                    {family.label}
                  </button>
                )
              })}
            </div>
          )}

          {sliders.length > 0 && (
            <div className="adjust-sliders">
              {sliders.map((slider) => (
                <label key={slider.key} className="adjust-slider">
                  <span className="adjust-label">{slider.label}</span>
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={params[slider.key]}
                    aria-label={slider.label}
                    onChange={(event) => {
                      const next = Number(event.target.value)
                      onChange(slider.key, slider.integers ? Math.round(next) : next)
                    }}
                  />
                  <em className="adjust-value">{formatValue(slider, params[slider.key])}</em>
                </label>
              ))}
            </div>
          )}

          {actions.length > 0 && (
            <div className="adjust-actions">
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className="adjust-action"
                  onClick={() => onChange(action.key, true)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {colors.length > 0 && (
            <div className={`adjust-colors${colors.length === 1 ? ' is-single' : ''}`}>
              {colors.map((color) => (
                <label key={color.key} className="adjust-color">
                  <span className="adjust-label">{color.label}</span>
                  <span className="adjust-swatch" style={{ background: params[color.key] }}>
                    <input
                      type="color"
                      value={params[color.key]}
                      aria-label={`${color.label} color`}
                      onChange={(event) => onChange(color.key, event.target.value)}
                    />
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className="adjust-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? '− Parameters' : '+ Parameters'}
      </button>
    </form>
  )
}
