import {
  EXP05_COMPOSITION_MODE_OPTIONS,
  EXP05_LAB_DEFAULTS,
  EXP05_LAB_META,
} from './exp05LabParams.js'
import {
  applyMorphPreset,
  EXP05_MORPH_PRESET_OPTIONS,
  matchMorphPresetId,
} from './exp05MorphologyCalibration.js'

const LIVE_KEYS = [
  'petalDensity',
  'petalScale',
  'particleDensity',
  'particleMotion',
  'macroDeformationStrength',
  'morphologyComplexity',
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
 */
export default function Exp05LabPanel({ lab, onChange, open, onToggle }) {
  const values = lab ?? EXP05_LAB_DEFAULTS

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

          <p className="exp05-lab__section">Morphology Presets</p>
          <p className="exp05-lab__hint">
            Same AGE / Seed — only radiusAt lobe amplitude and deformation
            scale change.
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

          <p className="exp05-lab__section">Debug · Composition</p>
          <p className="exp05-lab__hint">
            Temporary layer isolation for white-out diagnosis. Default is Full.
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
