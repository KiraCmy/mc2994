/**
 * Temporary Particle/Explore freeze diagnostics.
 * URL: ?baDiag=mount|cpu|geom|simple|gpu  (omit or off = normal path)
 */
export const BA_BUILD_ID = 'ba-particle-attach-20261021g'

/** Progressive stages (each includes prior stages). */
export const BA_DIAG_STAGES = ['mount', 'cpu', 'geom', 'simple', 'gpu']

export function particleDiag(stage, detail) {
  const payload = detail === undefined ? '' : detail
  console.log(`[BA-DIAG ${BA_BUILD_ID}] ${stage}`, payload)
}

export function readBaDiagMode() {
  if (typeof window === 'undefined') return null
  try {
    const raw = new URLSearchParams(window.location.search).get('baDiag')
    if (!raw || raw === 'off' || raw === '0' || raw === 'false') return null
    const mode = String(raw).toLowerCase().trim()
    return BA_DIAG_STAGES.includes(mode) ? mode : null
  } catch {
    return null
  }
}

/** True if the active diag mode includes this stage (progressive). */
export function baDiagIncludes(mode, stage) {
  if (!mode) return false
  const i = BA_DIAG_STAGES.indexOf(mode)
  const j = BA_DIAG_STAGES.indexOf(stage)
  return i >= 0 && j >= 0 && i >= j
}

function badgeText(mode) {
  return mode ? `${BA_BUILD_ID} | baDiag=${mode}` : BA_BUILD_ID
}

export function updateDiagBadge(mode = readBaDiagMode()) {
  if (typeof document === 'undefined') return
  let el = document.getElementById('ba-build-badge')
  /* Visible only while isolating particles via ?baDiag=… */
  if (!mode) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('div')
    el.id = 'ba-build-badge'
    el.style.cssText = [
      'position:fixed',
      'left:8px',
      'bottom:8px',
      'z-index:2147483647',
      'max-width:min(92vw,420px)',
      'padding:6px 10px',
      'font:11px/1.35 ui-monospace,Consolas,monospace',
      'color:#d7ecec',
      'background:rgba(0,0,0,0.78)',
      'border:1px solid rgba(215,236,236,0.4)',
      'pointer-events:none',
      'user-select:text',
      'white-space:pre-wrap',
    ].join(';')
    document.body.appendChild(el)
  }
  el.textContent = badgeText(mode)
  el.setAttribute('data-ba-build', BA_BUILD_ID)
  el.setAttribute('data-ba-diag', mode)
}

/** Call once at app boot. */
export function installBuildBadge() {
  const mode = readBaDiagMode()
  updateDiagBadge(mode)
  particleDiag('boot', { buildId: BA_BUILD_ID, baDiag: mode || 'off' })
}
