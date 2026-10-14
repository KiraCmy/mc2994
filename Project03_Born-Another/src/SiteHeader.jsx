import { MODES, sectionForMode } from './modes.js'

/**
 * Shared site header: logo, mode tabs under it, and a top-right meta slot.
 * Must sit inside a `.hud` layer, which supplies the typography and the
 * fixed positions shared by every page.
 */
export default function SiteHeader({ modeId, onSelectMode, children }) {
  const activeSection = sectionForMode(modeId)
  return (
    <>
      <p className="hud-title">Born Another</p>

      <div className="hud-modes" role="tablist" aria-label="Modes">
        {MODES.map((mode) => {
          const active = mode.id === activeSection
          return (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`hud-mode-item${active ? ' is-active' : ''}`}
              onClick={() => onSelectMode?.(mode.id)}
            >
              {mode.label}
            </button>
          )
        })}
      </div>

      {children ? <div className="hud-meta">{children}</div> : null}
    </>
  )
}
