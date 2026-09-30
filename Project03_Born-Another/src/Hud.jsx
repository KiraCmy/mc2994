import { STUDIES, studyLabel } from './surfaceParams.js'

export default function Hud({
  studyId,
  age,
  seed,
  animating,
  onSelectStudy,
  onToggleAnimate,
}) {
  return (
    <div className="hud">
      <p className="hud-title">Born Another</p>
      <div className="hud-meta">
        <p>
          Age {Number(age).toFixed(2)}
          <br />
          Seed {seed}
        </p>
        <button
          type="button"
          className={`hud-animate${animating ? ' is-active' : ''}`}
          aria-pressed={animating}
          onClick={onToggleAnimate}
        >
          {animating ? 'Pause' : 'Animate'}
        </button>
      </div>
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
