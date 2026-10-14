import {
  MATERIAL_DIAGNOSTIC_MODES,
  MATERIAL_OPTICAL_MODES,
} from './material/materialParams.js'
import { STUDIES, studyLabel } from './surfaceParams.js'
import { isShaderMode, isStudyMode, STUDY_MODES } from './modes.js'
import SiteHeader from './SiteHeader.jsx'
import SiteHud from './SiteHud.jsx'

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
  diagnostic = 'baseline',
  onSelectDiagnostic,
  optical = 'claude',
  onSelectOptical,
  showChecker = false,
  onToggleChecker,
}) {
  const animateLabel = isDead ? 'New Life' : animating ? 'Pause' : 'Animate'
  const showShaderChrome = isShaderMode(modeId)
  const showAnimate =
    showShaderChrome ||
    modeId === 'scatter' ||
    modeId === 'path' ||
    modeId === 'particle' ||
    modeId === 'explore' ||
    modeId === 'lsystem' ||
    modeId === 'material'

  return (
    <div className="hud">
      <SiteHud>
        <SiteHeader modeId={modeId} onSelectMode={onSelectMode}>
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
        </SiteHeader>
      </SiteHud>

      {isStudyMode(modeId) ? (
        <div
          className="hud-study-modes"
          role="tablist"
          aria-label="Technical studies"
        >
          {STUDY_MODES.map((item) => {
            const active = item.id === modeId
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`hud-study-mode-item${active ? ' is-active' : ''}`}
                onClick={() => onSelectMode(item.id)}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      ) : null}

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

      {modeId === 'material' ? (
        <div className="hud-studies" role="tablist" aria-label="Rendering comparison">
          {MATERIAL_DIAGNOSTIC_MODES.map((item) => {
            const active = diagnostic === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`hud-study-item${active ? ' is-active' : ''}`}
                onClick={() => onSelectDiagnostic(item.id)}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {modeId === 'material' ? (
        <div className="hud-optical" role="tablist" aria-label="Optical test">
          {MATERIAL_OPTICAL_MODES.map((item) => {
            const active = optical === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`hud-study-item${active ? ' is-active' : ''}`}
                onClick={() => onSelectOptical(item.id)}
              >
                {item.label}
              </button>
            )
          })}
          <button
            type="button"
            className={`hud-study-item${showChecker ? ' is-active' : ''}`}
            aria-pressed={showChecker}
            onClick={onToggleChecker}
          >
            Checker
          </button>
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
