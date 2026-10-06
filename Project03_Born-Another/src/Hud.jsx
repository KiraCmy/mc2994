import { STUDIES, studyLabel } from './surfaceParams.js'
import { MODES, isShaderMode } from './modes.js'

export default function Hud({
  modeId,
  studyId,
  age,
  seed,
  stage,
  isDead,
  animating,
  onSelectMode,
  onSelectStudy,
  onToggleAnimate,
}) {
  const animateLabel = isDead ? 'New Life' : animating ? 'Pause' : 'Animate'
  const showShaderChrome = isShaderMode(modeId)
  const showAnimate =
    showShaderChrome || modeId === 'scatter' || modeId === 'path'

  return (
    <div className="hud">
      <p className="hud-title">Born Another</p>

      <div className="hud-modes" role="tablist" aria-label="Modes">
        {MODES.map((mode) => {
          const active = mode.id === modeId
          return (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`hud-mode-item${active ? ' is-active' : ''}`}
              onClick={() => onSelectMode(mode.id)}
            >
              {mode.label}
            </button>
          )
        })}
      </div>

      <div className="hud-meta">
        <p>
          Age {Number(age).toFixed(2)}
          <br />
          Seed {seed}
          {stage ? (
            <>
              <br />
              {stage}
            </>
          ) : null}
        </p>
        {showAnimate ? (
          <button
            type="button"
            className={`hud-animate${animating ? ' is-active' : ''}`}
            aria-pressed={animating}
            onClick={onToggleAnimate}
          >
            {animateLabel}
          </button>
        ) : null}
      </div>

      {showShaderChrome ? (
        <div className="hud-studies" role="tablist" aria-label="Studies">
          {STUDIES.map((item) => {
            const active = item.id === studyId
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`hud-study-item${active ? ' is-active' : ''}`}
                onClick={() => onSelectStudy(item.id)}
              >
                {studyLabel(item)}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="hud-life">
        <span>Birth</span>
        <div
          className="hud-life-track"
          role="progressbar"
          aria-label="Life journey"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={Number(age)}
          aria-valuetext={`Age ${Number(age).toFixed(2)}`}
        >
          <i className="hud-life-line" />
          <b
            className="hud-life-dot"
            style={{ left: `${Math.min(1, Math.max(0, Number(age))) * 100}%` }}
          />
        </div>
        <span>Death</span>
      </div>
    </div>
  )
}
