import { useState } from 'react'
import { MATERIAL_FAMILIES } from './surfaceParams.js'
import { SCATTER_GROWTH_TYPES } from './scatter/scatterParams.js'
import {
  MATERIAL_DIAGNOSTIC_MODES,
  MATERIAL_OPTICAL_MODES,
  ORGANISM_MATERIAL_SLIDERS,
} from './material/materialParams.js'
import {
  PARTICLE_COUNT_MAX,
  PARTICLE_COUNT_MIN,
  PARTICLE_FIELD_COMPLEXITY_MAX,
  PARTICLE_FIELD_COMPLEXITY_MIN,
  PARTICLE_FIELD_THICKNESS_MAX,
  PARTICLE_FIELD_THICKNESS_MIN,
  PARTICLE_TRAIL_LENGTH_MAX,
  PARTICLE_TRAIL_LENGTH_MIN,
} from './particle/particleParams.js'
import {
  LSYSTEM_ANGLE_MAX,
  LSYSTEM_ANGLE_MIN,
  LSYSTEM_BRANCH_ROTATION_MAX,
  LSYSTEM_BRANCH_ROTATION_MIN,
  LSYSTEM_DEPTH_MAX,
  LSYSTEM_DEPTH_MIN,
  LSYSTEM_LENGTH_MAX,
  LSYSTEM_LENGTH_MIN,
  LSYSTEM_RANDOMNESS_MAX,
  LSYSTEM_RANDOMNESS_MIN,
  LSYSTEM_BASE_THICKNESS_MIN,
  LSYSTEM_BASE_THICKNESS_MAX,
  LSYSTEM_TAPER_MIN,
  LSYSTEM_TAPER_MAX,
  LSYSTEM_CHILD_RATIO_MIN,
  LSYSTEM_CHILD_RATIO_MAX,
} from './lsystem/lsystemParams.js'

const SEED_SLIDER = {
  key: 'seed',
  label: 'Seed',
  min: 0,
  max: 999999,
  step: 1,
  integers: true,
}

function withSeed(sliders) {
  if (sliders.some((slider) => slider.key === 'seed')) return sliders
  return [SEED_SLIDER, ...sliders]
}

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
  { key: 'decayStart', label: 'Decay Start', min: 0.2, max: 0.95, step: 0.01 },
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
  { key: 'age', label: 'Age', min: 0, max: 1, step: 0.01 },
  { key: 'density', label: 'Density', min: 0, max: 1, step: 0.01 },
  { key: 'size', label: 'Size', min: 0.35, max: 2.2, step: 0.01 },
]

const PATH_SLIDERS = [
  { key: 'age', label: 'Age', min: 0, max: 1, step: 0.01 },
  { key: 'growthStrength', label: 'Growth Strength', min: 0, max: 0.85, step: 0.01 },
  { key: 'growthRadius', label: 'Growth Radius', min: 0.06, max: 0.85, step: 0.01 },
]

const PARTICLE_SLIDERS = [
  { key: 'age', label: 'Age', min: 0, max: 1, step: 0.01 },
  {
    key: 'count',
    label: 'Particle Count',
    min: PARTICLE_COUNT_MIN,
    max: PARTICLE_COUNT_MAX,
    step: 500,
    integers: true,
  },
  {
    key: 'fieldThickness',
    label: 'Field Thickness',
    min: PARTICLE_FIELD_THICKNESS_MIN,
    max: PARTICLE_FIELD_THICKNESS_MAX,
    step: 0.01,
  },
  {
    key: 'fieldComplexity',
    label: 'Field Complexity',
    min: PARTICLE_FIELD_COMPLEXITY_MIN,
    max: PARTICLE_FIELD_COMPLEXITY_MAX,
    step: 0.01,
  },
  {
    key: 'trailLength',
    label: 'Trail Length',
    min: PARTICLE_TRAIL_LENGTH_MIN,
    max: PARTICLE_TRAIL_LENGTH_MAX,
    step: 0.01,
  },
  { key: 'sizeVariation', label: 'Size Variation', min: 0, max: 1, step: 0.01 },
  { key: 'brightnessVariation', label: 'Brightness Variation', min: 0, max: 1, step: 0.01 },
  { key: 'colorInfluence', label: 'Color Influence', min: 0, max: 1, step: 0.01 },
  { key: 'pulseStrength', label: 'Pulse Strength', min: 0, max: 1, step: 0.01 },
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
    return { sliders: withSeed(IDENTITY_SLIDERS), colors: IDENTITY_COLORS, families: null, modes: null }
  }
  if (studyId === 'development') {
    return { sliders: withSeed(DEVELOPMENT_SLIDERS), colors: [], families: null, modes: null }
  }
  if (studyId === 'decay') {
    return { sliders: withSeed(DECAY_SLIDERS), colors: DECAY_COLORS, families: null, modes: null }
  }
  if (studyId === 'trace') {
    return { sliders: withSeed(TRACE_SLIDERS), colors: TRACE_COLORS, families: null, modes: null }
  }
  if (studyId === 'lifecycle') {
    return { sliders: withSeed(LIFECYCLE_SLIDERS), colors: [], families: null, modes: null }
  }
  if (studyId === 'material') {
    return { sliders: withSeed(MATERIAL_SLIDERS), colors: [], families: MATERIAL_FAMILIES, modes: null }
  }
  if (studyId === 'behavior') {
    return { sliders: withSeed(BEHAVIOR_SLIDERS), colors: [], families: MATERIAL_FAMILIES, modes: null }
  }
  if (studyId === 'layered') {
    return { sliders: withSeed(LAYERED_SLIDERS), colors: [], families: null, modes: null }
  }
  return { sliders: withSeed(SURFACE_SLIDERS), colors: SURFACE_COLORS, families: null, modes: null }
}

function controlsForMode(modeId, studyId) {
  if (modeId === 'scatter') {
    return {
      heading: 'Scatter Parameters',
      sliders: withSeed(SCATTER_SLIDERS),
      colors: [],
      families: SCATTER_GROWTH_TYPES,
      familyKey: 'growthType',
      familyLabel: 'Growth type',
      modes: null,
      actions: [{ key: 'regenerate', label: 'Regenerate' }],
    }
  }
  if (modeId === 'path') {
    return {
      heading: 'Path Parameters',
      sliders: withSeed(PATH_SLIDERS),
      colors: [],
      families: null,
      modes: null,
      actions: [
        { key: 'draw', label: 'Draw', toggle: true, activeKey: 'drawing' },
        { key: 'clear', label: 'Clear Path' },
      ],
    }
  }
  if (modeId === 'particle') {
    return {
      heading: 'Particle Parameters',
      sliders: withSeed(PARTICLE_SLIDERS),
      colors: [],
      families: null,
      modes: null,
      actions: [],
    }
  }
  if (modeId === 'material') {
    return {
      heading: 'Material Parameters',
      sliders: withSeed([
        { key: 'age', label: 'Age', min: 0, max: 1, step: 0.01 },
        ...ORGANISM_MATERIAL_SLIDERS,
      ]),
      colors: [],
      families: null,
      modes: MATERIAL_DIAGNOSTIC_MODES,
      modeKey: 'diagnostic',
      modeLabel: 'Geometry',
      opticalModes: MATERIAL_OPTICAL_MODES,
      actions: [
        { key: 'mask', label: 'Mask', toggle: true, activeKey: 'showMask' },
        { key: 'checker', label: 'Checker', toggle: true, activeKey: 'showChecker' },
      ],
    }
  }
  if (modeId === 'explore') {
    return {
      heading: 'Explore Parameters',
      sliders: withSeed([{ key: 'age', label: 'Age', min: 0, max: 1, step: 0.01 }]),
      colors: [],
      families: null,
      modes: null,
      actions: [],
    }
  }
  if (modeId === 'lsystem') {
    return {
      heading: 'L-System Parameters',
      sliders: withSeed([
        { key: 'age', label: 'Age', min: 0, max: 1, step: 0.01 },
        {
          key: 'depth',
          label: 'Recursion Depth',
          min: LSYSTEM_DEPTH_MIN,
          max: LSYSTEM_DEPTH_MAX,
          step: 1,
          integers: true,
        },
        {
          key: 'angle',
          label: 'Branch Angle',
          min: LSYSTEM_ANGLE_MIN,
          max: LSYSTEM_ANGLE_MAX,
          step: 1,
        },
        {
          key: 'length',
          label: 'Segment Length',
          min: LSYSTEM_LENGTH_MIN,
          max: LSYSTEM_LENGTH_MAX,
          step: 0.01,
        },
        {
          key: 'branchRotation',
          label: 'Branch Rotation',
          min: LSYSTEM_BRANCH_ROTATION_MIN,
          max: LSYSTEM_BRANCH_ROTATION_MAX,
          step: 1,
        },
        {
          key: 'randomness',
          label: 'Randomness',
          min: LSYSTEM_RANDOMNESS_MIN,
          max: LSYSTEM_RANDOMNESS_MAX,
          step: 0.01,
        },
        {
          key: 'baseThickness',
          label: 'Base Thickness',
          min: LSYSTEM_BASE_THICKNESS_MIN,
          max: LSYSTEM_BASE_THICKNESS_MAX,
          step: 0.001,
        },
        {
          key: 'taperStrength',
          label: 'Taper Strength',
          min: LSYSTEM_TAPER_MIN,
          max: LSYSTEM_TAPER_MAX,
          step: 0.01,
        },
        {
          key: 'childThicknessRatio',
          label: 'Child Thickness Ratio',
          min: LSYSTEM_CHILD_RATIO_MIN,
          max: LSYSTEM_CHILD_RATIO_MAX,
          step: 0.01,
        },
      ]),
      colors: [],
      families: null,
      modes: null,
      actions: [
        {
          key: 'debug',
          label: 'Debug',
          toggle: true,
          activeKey: 'showDebug',
        },
      ],
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
  const familyKey = controls.familyKey ?? 'family'
  const familyLabel = controls.familyLabel ?? 'Material family'
  const modeKey = controls.modeKey ?? 'mode'
  const modeLabel = controls.modeLabel ?? 'Layer visibility'
  const opticalModes = controls.opticalModes ?? null

  return (
    <form
      className={`adjust${open ? ' is-open' : ''}`}
      onSubmit={(event) => event.preventDefault()}
    >
      {open && (
        <div className="adjust-panel">
          <p className="adjust-heading">{heading}</p>

          {modes && (
            <div className="adjust-families" role="tablist" aria-label={modeLabel}>
              {modes.map((mode) => {
                const active = params[modeKey] === mode.id
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`adjust-family${active ? ' is-active' : ''}`}
                    onClick={() => onChange(modeKey, mode.id)}
                  >
                    {mode.label}
                  </button>
                )
              })}
            </div>
          )}

          {opticalModes && (
            <div className="adjust-families" role="tablist" aria-label="Optical test">
              {opticalModes.map((mode) => {
                const active = (params.optical ?? 'reflection') === mode.id
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`adjust-family${active ? ' is-active' : ''}`}
                    onClick={() => onChange('optical', mode.id)}
                  >
                    {mode.label}
                  </button>
                )
              })}
            </div>
          )}

          {families && (
            <div className="adjust-families" role="tablist" aria-label={familyLabel}>
              {families.map((family) => {
                const active = params[familyKey] === family.id
                return (
                  <button
                    key={family.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`adjust-family${active ? ' is-active' : ''}`}
                    onClick={() => onChange(familyKey, family.id)}
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
              {actions.map((action) => {
                const active =
                  action.toggle && action.activeKey
                    ? Boolean(params[action.activeKey])
                    : false
                const label =
                  action.toggle && action.key === 'draw'
                    ? active
                      ? 'Draw · On'
                      : 'Draw · Off'
                    : action.toggle && action.key === 'debug'
                      ? active
                        ? 'Debug · On'
                        : 'Debug · Off'
                      : action.toggle && action.key === 'mask'
                        ? active
                          ? 'Mask · On'
                          : 'Mask · Off'
                        : action.toggle && action.key === 'checker'
                          ? active
                            ? 'Checker · On'
                            : 'Checker · Off'
                          : action.label
                return (
                  <button
                    key={action.key}
                    type="button"
                    className={`adjust-action${active ? ' is-active' : ''}`}
                    aria-pressed={action.toggle ? active : undefined}
                    onClick={() => onChange(action.key, true)}
                  >
                    {label}
                  </button>
                )
              })}
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
