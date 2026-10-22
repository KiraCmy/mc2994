/** Match typical MacBook WebGL load on large / 4K displays. */
export const STUDIES_MAX_PIXELS = 3_500_000

/** Full particle field (canonical look on MacBook / light hosts). */
export const PARTICLE_FULL_COUNT = 75000

/**
 * Caps used only on Windows (and other heavy hosts) for Explore, where
 * Scatter + particles share a frame. Particle tab uses the full slider —
 * GPGPU (not point count) was the Chrome freeze risk.
 * MacBook keeps the full requested count + live GPGPU currents.
 */
export const PARTICLE_HEAVY_COUNT_CAP = 120000
export const PARTICLE_HEAVY_EXPLORE_CAP = 60000

/**
 * Effective DPR so width * height * dpr² stays under maxPixels.
 * Keeps the canvas CSS size; only the drawing buffer is capped.
 * Typical MacBook windows stay under the budget → full native DPR.
 */
export function resolveRenderDpr(
  width,
  height,
  devicePixelRatio = 1,
  maxPixels = STUDIES_MAX_PIXELS,
) {
  const cssW = Math.max(1, Number(width) || 1)
  const cssH = Math.max(1, Number(height) || 1)
  const native = Math.min(2, Math.max(1, Number(devicePixelRatio) || 1))
  const area = cssW * cssH
  if (!Number.isFinite(area) || area <= 0 || !Number.isFinite(maxPixels)) {
    return 1
  }
  const capped = Math.sqrt(maxPixels / area)
  const dpr = Math.max(0.75, Math.min(native, capped))
  return Number.isFinite(dpr) ? dpr : 1
}

/** Native CSS×DPR pixels (before our render budget cap). */
function nativeFramebufferPixels(
  width = typeof window !== 'undefined' ? window.innerWidth : 1280,
  height = typeof window !== 'undefined' ? window.innerHeight : 800,
  devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1,
) {
  const dpr = Math.min(2, Math.max(1, Number(devicePixelRatio) || 1))
  return Math.max(1, width) * Math.max(1, height) * dpr * dpr
}

export function isWindowsHost() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const platform = navigator.userAgentData?.platform || navigator.platform || ''
  return /Windows/i.test(ua) || /Win/i.test(platform)
}

/**
 * True when the full 75k + GPGPU particle field tends to freeze Chrome.
 * All Windows hosts use the light path (the previous pixel check was wrong:
 * it used the already-capped DPR, so Windows often looked "light" and still
 * tried to load 75k).
 */
export function isHeavyWebGLHost(
  width = typeof window !== 'undefined' ? window.innerWidth : 1280,
  height = typeof window !== 'undefined' ? window.innerHeight : 800,
  devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1,
) {
  if (typeof window === 'undefined') return false
  if (isWindowsHost()) return true
  // Non-Windows but huge native framebuffer (e.g. Mac + 4K external).
  return nativeFramebufferPixels(width, height, devicePixelRatio) >= 6_000_000
}

/**
 * Draw count for ParticleField.
 * MacBook / light hosts: requested count unchanged.
 * Windows Particle tab: full requested (GPGPU stays off in ParticleField).
 * Windows Explore: soft-cap so Scatter + particles stay interactive.
 */
export function resolveParticleDrawCount(
  requested,
  { explore = false } = {},
) {
  const n = Math.max(0, Math.floor(Number(requested) || 0))
  if (!isHeavyWebGLHost()) return n
  if (!explore) return Math.min(n, PARTICLE_HEAVY_COUNT_CAP)
  return Math.min(n, PARTICLE_HEAVY_EXPLORE_CAP)
}
