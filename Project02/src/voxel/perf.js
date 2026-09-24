/** Stage 6 timing helpers — keep fill vs mesh costs separate. */

export function nowMs() {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now()
}

/** Run fn and return { result, ms }. */
export function timeMs(fn) {
  const t0 = nowMs()
  const result = fn()
  return { result, ms: nowMs() - t0 }
}

export function formatMs(ms) {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms < 10) return `${ms.toFixed(1)}ms`
  return `${Math.round(ms)}ms`
}
