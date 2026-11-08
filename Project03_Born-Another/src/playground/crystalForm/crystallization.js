/**
 * Exp06 Crystal Form Lab — crystallization dynamics (pure, no three.js).
 *
 * Temperature (Playground coupling), Moisture and Turbulence (Life Engine
 * environment) set a target crystallization level. The live level eases toward
 * it: growth is slower than melting, and turbulence fractures faster still.
 *
 * Level 0 = fluid membrane, 1 = full lattice.
 */

export const CRYSTAL_DEFAULTS = {
  temperature: 0.24,
  moisture: 0.66,
  turbulence: 0.06,
  level: 0.3,
}

export const CRYSTAL_PRESETS = [
  { id: 'neutral', label: 'Neutral', temperature: 0.5, moisture: 0.5, turbulence: 0 },
  { id: 'freeze', label: 'Deep freeze', temperature: 0.04, moisture: 0.82, turbulence: 0 },
  { id: 'thaw', label: 'Thaw', temperature: 0.82, moisture: 0.5, turbulence: 0.05 },
  { id: 'storm', label: 'Storm', temperature: 0.22, moisture: 0.6, turbulence: 0.85 },
]

/** Seconds⁻¹ easing rates. */
export const CRYSTAL_RATES = {
  grow: 0.34,
  melt: 0.55,
  fracture: 0.9,
}

function clamp01(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/**
 * Cold drives nucleation, moisture supplies mass, turbulence breaks the lattice.
 */
export function crystallizationTarget({
  temperature = 0.5,
  moisture = 0.5,
  turbulence = 0,
} = {}) {
  const cold = 1 - clamp01(temperature)
  const nucleation = clamp01(cold * 1.32 - 0.3)
  const mass = 0.42 + 0.58 * clamp01(moisture)
  const stability = 1 - 0.78 * clamp01(turbulence)
  return clamp01(nucleation * mass * stability)
}

/** Ease `level` toward `target` over `dt` seconds. */
export function stepCrystallization(level, target, { turbulence = 0, dt = 0 } = {}) {
  const current = clamp01(level)
  if (!(dt > 0)) return current
  const goal = clamp01(target)
  let rate = CRYSTAL_RATES.grow
  if (goal < current) {
    rate = clamp01(turbulence) > 0.4 ? CRYSTAL_RATES.fracture : CRYSTAL_RATES.melt
  }
  return clamp01(current + (goal - current) * (1 - Math.exp(-rate * dt)))
}

/** Surface rime coverage: needs both crystallization and moisture. */
export function rimeAmount(level, moisture) {
  return clamp01(level) * (0.3 + 0.7 * clamp01(moisture))
}

/** Per-crystal growth 0..1 once the level passes its threshold. */
export function crystalGrowth(level, threshold, span = 0.24) {
  return smoothstep(threshold, threshold + span, clamp01(level))
}

/**
 * Human-readable phase for the HUD.
 * @param {number} level 0..1
 * @param {number} ratePerSec d(level)/dt
 * @param {number} turbulence 0..1
 */
export function crystallizationState(level, ratePerSec, turbulence = 0) {
  const c = clamp01(level)
  const rate = Number(ratePerSec) || 0
  if (clamp01(turbulence) > 0.4 && rate < -0.004 && c > 0.08) return 'Fracturing'
  if (rate < -0.004) return 'Thawing'
  if (c < 0.04) return 'Fluid'
  if (rate > 0.004) return c < 0.28 ? 'Nucleating' : 'Crystallizing'
  return c > 0.62 ? 'Crystalline' : 'Holding'
}
