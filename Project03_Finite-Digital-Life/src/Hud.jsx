import { STUDIES, studyLabel } from './surfaceParams.js'

export default function Hud({ studyId, age, seed, onSelectStudy }) {
  return (
    <div className="hud">
      <p className="hud-title">Finite Digital Life</p>
      <p className="hud-meta">
        Age {Number(age).toFixed(2)}
        <br />
        Seed {seed}
      </p>
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
        <i />
        <span>Death</span>
      </div>
    </div>
  )
}
