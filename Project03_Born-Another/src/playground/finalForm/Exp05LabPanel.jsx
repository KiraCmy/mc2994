import {
  EXP05_COMPOSITION_MODE_OPTIONS,
  EXP05_DIAGNOSTIC_MODE_OPTIONS,
  EXP05_LAB_DEFAULTS,
  EXP05_LAB_META,
  EXP05_MATERIAL_MODE_OPTIONS,
} from './exp05LabParams.js'
import {
  EXP05_ENV_META,
  EXP05_ENV_MOISTURE_NEUTRAL,
  EXP05_ENV_TEMPERATURE_NEUTRAL,
  EXP05_ENV_TURBULENCE_DEFAULT,
  readExp05Environment,
} from './exp05EnvironmentCoupling.js'
import {
  applyMorphPreset,
  EXP05_MORPH_PRESET_OPTIONS,
  matchMorphPresetId,
} from './exp05MorphologyCalibration.js'
import { EXP05_MORPHOLOGY_TYPE_OPTIONS } from './exp05MorphologyTypes.js'

const LIVE_KEYS = [
  'petalDensity',
  'petalScale',
  'particleDensity',
  'particleMotion',
  'macroDeformationStrength',
  'morphologyComplexity',
  'sculpturalStrength',
]

function LabSlider({ id, value, onChange }) {
  const meta = EXP05_LAB_META[id]
  if (!meta) return null
  return (
    <label className="exp05-lab__row">
      <span className="exp05-lab__row-head">
        <span>{meta.label}</span>
        <span className="exp05-lab__value">{Number(value).toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={meta.min}
        max={meta.max}
        step={meta.step}
        value={value}
        aria-valuetext={`${meta.label} ${Number(value).toFixed(2)}`}
        onChange={(event) => onChange(id, Number(event.target.value))}
      />
    </label>
  )
}

/**
 * Collapsible Exp05-only Final Form Lab parameter panel.
 * Environment sliders bind to Life Engine state (not visual lab knobs).
 */
export default function Exp05LabPanel({
  lab,
  onChange,
  open,
  onToggle,
  life = null,
  onMoistureChange,
  onTurbulenceChange,
}) {
  const values = lab ?? EXP05_LAB_DEFAULTS
  const environment = readExp05Environment(life, values)

  const handleChange = (key, value) => {
    onChange?.({ ...values, [key]: value })
  }

  const handleReset = () => {
    onChange?.({ ...EXP05_LAB_DEFAULTS })
  }

  const activeMorphPreset = matchMorphPresetId(values)

  const handleMorphPreset = (presetId) => {
    onChange?.(applyMorphPreset(values, presetId))
  }

  return (
    <div className={`exp05-lab${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="exp05-lab__toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>Lab Parameters</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div className="exp05-lab__body">
          <p className="exp05-lab__note">
            Live knobs for petals, particles, and World body morph. Does not
            reset AGE or Seed.
          </p>

          <p className="exp05-lab__section">Environment</p>
          <p className="exp05-lab__hint">
            Temperature (Playground membrane expand/contract), Moisture (Life
            growth), Turbulence (Life membrane). Shared surface evaluator keeps
            body / petals / particles in sync. Temperature is immediate and does
            not reset the organism; Moisture rebuilds from birth at current AGE.
          </p>
          <label className="exp05-lab__row">
            <span className="exp05-lab__row-head">
              <span>{EXP05_ENV_META.temperature.label}</span>
              <span className="exp05-lab__value">
                {environment.temperature.toFixed(2)}
              </span>
            </span>
            <input
              type="range"
              min={EXP05_ENV_META.temperature.min}
              max={EXP05_ENV_META.temperature.max}
              step={EXP05_ENV_META.temperature.step}
              value={environment.temperature}
              aria-valuetext={`Temperature ${environment.temperature.toFixed(2)}`}
              onChange={(event) =>
                handleChange('temperature', Number(event.target.value))
              }
            />
          </label>
          <label className="exp05-lab__row">
            <span className="exp05-lab__row-head">
              <span>{EXP05_ENV_META.moisture.label}</span>
              <span className="exp05-lab__value">
                {environment.moisture.toFixed(2)}
              </span>
            </span>
            <input
              type="range"
              min={EXP05_ENV_META.moisture.min}
              max={EXP05_ENV_META.moisture.max}
              step={EXP05_ENV_META.moisture.step}
              value={environment.moisture}
              aria-valuetext={`Moisture ${environment.moisture.toFixed(2)}`}
              disabled={!onMoistureChange}
              onChange={(event) =>
                onMoistureChange?.(Number(event.target.value))
              }
            />
          </label>
          <label className="exp05-lab__row">
            <span className="exp05-lab__row-head">
              <span>{EXP05_ENV_META.turbulence.label}</span>
              <span className="exp05-lab__value">
                {environment.turbulence.toFixed(2)}
              </span>
            </span>
            <input
              type="range"
              min={EXP05_ENV_META.turbulence.min}
              max={EXP05_ENV_META.turbulence.max}
              step={EXP05_ENV_META.turbulence.step}
              value={environment.turbulence}
              aria-valuetext={`Turbulence ${environment.turbulence.toFixed(2)}`}
              disabled={!onTurbulenceChange}
              onChange={(event) =>
                onTurbulenceChange?.(Number(event.target.value))
              }
            />
          </label>
          <button
            type="button"
            className="exp05-lab__reset"
            onClick={() => {
              handleChange('temperature', EXP05_ENV_TEMPERATURE_NEUTRAL)
              onMoistureChange?.(EXP05_ENV_MOISTURE_NEUTRAL)
              onTurbulenceChange?.(EXP05_ENV_TURBULENCE_DEFAULT)
            }}
          >
            Reset environment
          </button>

          <p className="exp05-lab__section">Morphology Type</p>
          <p className="exp05-lab__hint">
            Radial rest silhouette (World / quilted Segmented / Spiral).
            Independent of Low / Medium / High and deformation strength. Does
            not reset AGE or Seed.
          </p>
          <div
            className="exp05-lab__presets"
            role="group"
            aria-label="Morphology type"
          >
            {EXP05_MORPHOLOGY_TYPE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={values.morphologyType === option.id}
                onClick={() => handleChange('morphologyType', option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="exp05-lab__section">Morphology Presets</p>
          <p className="exp05-lab__hint">
            Same AGE / Seed / Type — only radiusAt lobe amplitude and
            deformation scale change.
          </p>
          <div
            className="exp05-lab__presets"
            role="group"
            aria-label="Morphology presets"
          >
            {EXP05_MORPH_PRESET_OPTIONS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={activeMorphPreset === preset.id}
                onClick={() => handleMorphPreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {LIVE_KEYS.map((key) => (
            <LabSlider
              key={key}
              id={key}
              value={values[key]}
              onChange={handleChange}
            />
          ))}

          <p className="exp05-lab__section">Body Material</p>
          <p className="exp05-lab__hint">
            A/B/C study — body shader only. Pearlescent V2 refines gloss,
            thickness, and fold optics. Petals / particles stay Explore. Does
            not reset AGE, Seed, morphology, or environment.
          </p>
          <div
            className="exp05-lab__composition"
            role="group"
            aria-label="Body material"
          >
            {EXP05_MATERIAL_MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={values.materialMode === option.id}
                onClick={() => handleChange('materialMode', option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="exp05-lab__section">Morphology Diagnostic</p>
          <p className="exp05-lab__hint">
            Same geometry and Life state — only appearance changes. Use Geometry
            Only / Surface + Lighting to read ribs without petals, particles, or
            Explore shading. Does not reset AGE or Seed.
          </p>
          <div
            className="exp05-lab__composition"
            role="group"
            aria-label="Morphology diagnostic"
          >
            {EXP05_DIAGNOSTIC_MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={values.diagnosticMode === option.id}
                onClick={() => handleChange('diagnosticMode', option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="exp05-lab__section">Debug · Composition</p>
          <p className="exp05-lab__hint">
            Temporary layer isolation for white-out diagnosis. Default is Full.
            Ignored while Morphology Diagnostic is not Full Appearance.
          </p>
          <div
            className="exp05-lab__composition"
            role="group"
            aria-label="Composition debug"
          >
            {EXP05_COMPOSITION_MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={values.compositionMode === option.id}
                onClick={() => handleChange('compositionMode', option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="exp05-lab__reset"
            onClick={handleReset}
          >
            Reset lab defaults
          </button>
        </div>
      ) : null}
    </div>
  )
}
