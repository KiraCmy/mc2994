import { useState } from 'react'

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
  { key: 'displacement', label: 'Displacement', min: 0, max: 0.2, step: 0.001 },
  { key: 'noiseAmount', label: 'Identity Noise', min: 0, max: 2, step: 0.01 },
]

function formatValue(slider, value) {
  if (slider.integers) return String(Math.round(value))
  if (slider.key === 'displacement') return Number(value).toFixed(3)
  return Number(value).toFixed(2)
}

function controlsFor(studyId) {
  if (studyId === 'individuality') {
    return { sliders: IDENTITY_SLIDERS, colors: IDENTITY_COLORS }
  }
  if (studyId === 'development') {
    return { sliders: DEVELOPMENT_SLIDERS, colors: [] }
  }
  return { sliders: SURFACE_SLIDERS, colors: SURFACE_COLORS }
}

export default function AdjustBar({ study, params, onChange }) {
  const [open, setOpen] = useState(false)
  const { sliders, colors } = controlsFor(study.id)

  return (
    <form
      className={`adjust${open ? ' is-open' : ''}`}
      onSubmit={(event) => event.preventDefault()}
    >
      {open && (
        <div className="adjust-panel">
          <p className="adjust-heading">{study.heading}</p>

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
