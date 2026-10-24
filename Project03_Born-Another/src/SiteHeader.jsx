import { MODES, sectionForMode } from './modes.js'

/**
 * Shared site header: lightweight wordmark + tagline on the left,
 * mode tabs on the right (same top band). Optional meta slot for Studies.
 * Must sit inside a `.hud` layer for shared typography and positioning.
 */
export default function SiteHeader({ modeId, onSelectMode, children }) {
  const activeSection = sectionForMode(modeId)
  return (
    <>
      <div className="hud-brand">
        <p className="hud-title">Born Another</p>
        <p className="hud-tagline">
          A procedural world of lost and possible lives
        </p>
      </div>

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
