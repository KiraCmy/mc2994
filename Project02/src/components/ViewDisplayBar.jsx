/**
 * Secondary VIEW / DISPLAY controls for a viewport.
 * Text-forward, lighter than primary page navigation.
 */
export default function ViewDisplayBar({
  label = 'VIEW / DISPLAY',
  modes = [],
  modeId,
  onModeChange,
  tools = [],
  end = null,
  barRef = null,
}) {
  return (
    <div ref={barRef} className="view-display-bar" aria-label={label}>
      <span className="view-display-label">{label}</span>

      {modes.length > 0 ? (
        <div className="view-display-modes" role="tablist" aria-label="Display mode">
          {modes.map((mode, index) => (
            <span key={mode.id} className="view-display-mode-item">
              {index > 0 ? <span className="view-display-sep" aria-hidden="true">/</span> : null}
              <button
                type="button"
                role="tab"
                aria-selected={modeId === mode.id}
                className={`view-display-link${modeId === mode.id ? ' is-active' : ''}`}
                onClick={() => onModeChange?.(mode.id)}
                disabled={mode.disabled}
              >
                {mode.label}
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {tools.length > 0 ? (
        <div className="view-display-tools" role="group" aria-label="Viewport tools">
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`view-display-tool${tool.active ? ' is-active' : ''}`}
              aria-pressed={tool.toggle ? !!tool.active : undefined}
              onClick={tool.onClick}
              disabled={tool.disabled}
            >
              {tool.label}
            </button>
          ))}
        </div>
      ) : null}

      {end ? <div className="view-display-end">{end}</div> : null}
    </div>
  )
}
