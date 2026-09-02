import { THEMES } from './themes.js'

export default function ControlBar({
  spikes,
  hue,
  themeId,
  onSpikesChange,
  onHueChange,
  onThemeChange,
}) {
  const stopOrbit = (event) => {
    event.stopPropagation()
  }

  return (
    <aside
      className="control-bar"
      aria-label="Scene controls"
      onPointerDown={stopOrbit}
      onWheel={stopOrbit}
    >
      <div className="control-group">
        <div className="slider-label-row">
          <label htmlFor="spike-count">Spikes</label>
          <span>{spikes}</span>
        </div>
        <input
          id="spike-count"
          type="range"
          min="3"
          max="48"
          value={spikes}
          onChange={(event) => onSpikesChange(Number(event.target.value))}
        />
      </div>

      <div className="control-group">
        <div className="slider-label-row">
          <label htmlFor="spike-hue">Color</label>
          <span>{hue}°</span>
        </div>
        <input
          id="spike-hue"
          className="hue-slider"
          type="range"
          min="0"
          max="360"
          value={hue}
          onChange={(event) => onHueChange(Number(event.target.value))}
        />
      </div>

      <div className="control-group theme-group">
        <p className="theme-label">Theme</p>
        <div className="theme-row" role="radiogroup" aria-label="Color theme">
          {Object.values(THEMES).map((theme) => (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={themeId === theme.id}
              title={theme.label}
              className={`theme-swatch${themeId === theme.id ? ' is-active' : ''}`}
              style={{
                '--swatch-bg': theme.background,
                '--swatch-accent': theme.accent,
              }}
              onClick={() => onThemeChange(theme.id)}
            >
              <span className="theme-swatch-dot" />
              <span className="theme-swatch-label">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
