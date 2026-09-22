function formatValue(key, value) {
  if (key === 'layerCount') {
    return String(Math.round(value))
  }
  if (key === 'opacity' || key === 'scaleProgression' || key === 'layerSpacing') {
    return Number(value).toFixed(2)
  }
  return String(value)
}

function ParamSlider({ id, label, min, max, step, value, onChange }) {
  return (
    <div className="param-row">
      <label className="param-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="param-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="param-value">{formatValue(id, value)}</span>
    </div>
  )
}

function ParamColor({ id, label, value, onChange }) {
  return (
    <div className="param-row param-row--color">
      <label className="param-label" htmlFor={id}>
        {label}
      </label>
      <div className="param-color-wrap">
        <input
          id={id}
          className="param-color"
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="param-swatch-hex">{value}</span>
      </div>
    </div>
  )
}

export default function ControlBar({ params, onChange }) {
  const stopOrbit = (event) => {
    event.stopPropagation()
  }

  const set = (key) => (value) => {
    onChange({ ...params, [key]: value })
  }

  return (
    <aside
      className="control-bar"
      aria-label="Geometry controls"
      onPointerDown={stopOrbit}
      onWheel={stopOrbit}
    >
      <div className="control-bar__grid">
        <ParamSlider
          id="layerCount"
          label="Layers"
          min={3}
          max={40}
          step={1}
          value={params.layerCount}
          onChange={set('layerCount')}
        />
        <ParamSlider
          id="layerSpacing"
          label="Spacing"
          min={0.02}
          max={0.55}
          step={0.01}
          value={params.layerSpacing}
          onChange={set('layerSpacing')}
        />
        <ParamSlider
          id="scaleProgression"
          label="Scale"
          min={-0.8}
          max={0.8}
          step={0.01}
          value={params.scaleProgression}
          onChange={set('scaleProgression')}
        />
        <ParamSlider
          id="opacity"
          label="Opacity"
          min={0.05}
          max={0.9}
          step={0.01}
          value={params.opacity}
          onChange={set('opacity')}
        />
        <ParamColor
          id="startColor"
          label="Start"
          value={params.startColor}
          onChange={set('startColor')}
        />
        <ParamColor
          id="endColor"
          label="End"
          value={params.endColor}
          onChange={set('endColor')}
        />
      </div>
    </aside>
  )
}
