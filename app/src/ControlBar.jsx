export default function ControlBar({ subdivision, onSubdivisionChange }) {
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
      <div className="param-row">
        <label className="param-label" htmlFor="subdivision">
          Subdiv
        </label>
        <input
          id="subdivision"
          className="param-slider"
          type="range"
          min="0"
          max="5"
          step="1"
          value={subdivision}
          onChange={(event) => onSubdivisionChange(Number(event.target.value))}
        />
        <span className="param-value">{subdivision}</span>
      </div>
    </aside>
  )
}
