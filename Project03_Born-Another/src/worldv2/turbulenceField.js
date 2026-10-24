/**
 * Environmental Turbulence — reversible radial membrane field.
 * Deterministic in (seed, position, life.time, intensity). Not particle.turbulence.
 */

import { lifeHash } from './life/lifeEngine.js'

/** Peak radial displacement at Turbulence = 1.0 (organism units). */
export const TURBULENCE_MAX_DISPLACEMENT = 0.36

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function latticeValue(seed, ix, iy, iz, channel) {
  const mixed =
    (Math.imul(ix | 0, 73856093) ^
      Math.imul(iy | 0, 19349663) ^
      Math.imul(iz | 0, 83492791) ^
      (channel | 0)) >>>
    0
  return lifeHash(seed, mixed, 520 + (channel | 0)) * 2 - 1
}

/** Smooth value-noise in 3D (one octave). */
function valueNoise3(seed, x, y, z, channel = 0) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const z0 = Math.floor(z)
  const fx = fade(x - x0)
  const fy = fade(y - y0)
  const fz = fade(z - z0)

  const n000 = latticeValue(seed, x0, y0, z0, channel)
  const n100 = latticeValue(seed, x0 + 1, y0, z0, channel)
  const n010 = latticeValue(seed, x0, y0 + 1, z0, channel)
  const n110 = latticeValue(seed, x0 + 1, y0 + 1, z0, channel)
  const n001 = latticeValue(seed, x0, y0, z0 + 1, channel)
  const n101 = latticeValue(seed, x0 + 1, y0, z0 + 1, channel)
  const n011 = latticeValue(seed, x0, y0 + 1, z0 + 1, channel)
  const n111 = latticeValue(seed, x0 + 1, y0 + 1, z0 + 1, channel)

  const x00 = lerp(n000, n100, fx)
  const x10 = lerp(n010, n110, fx)
  const x01 = lerp(n001, n101, fx)
  const x11 = lerp(n011, n111, fx)
  const y0v = lerp(x00, x10, fy)
  const y1v = lerp(x01, x11, fy)
  return lerp(y0v, y1v, fz)
}

/**
 * Radial membrane offset from environmental Turbulence.
 * @returns {number} signed radial delta (0 when intensity is 0)
 */
export function sampleTurbulenceRadialOffset(
  x,
  y,
  z,
  { seed = 1, time = 0, turbulence = 0 } = {},
) {
  const intensity = clamp01(turbulence)
  if (intensity <= 1e-6) return 0

  const radius = Math.hypot(x, y, z) || 1
  const px = x / radius
  const py = y / radius
  const pz = z / radius
  const t = Number(time) || 0
  const s = Number(seed) || 1

  // Advection + mid spatial frequency → traveling lobes readable on the form.
  const freq = 1.55
  const drift = t * 0.48
  const nx = px * freq + drift * 0.42
  const ny = py * freq - drift * 0.26
  const nz = pz * freq + drift * 0.34

  const field =
    valueNoise3(s, nx, ny, nz, 0) * 0.58 +
    valueNoise3(s, nx * 1.85 + 2.1, ny * 1.85, nz * 1.85 - 1.3, 1) * 0.42

  // Traveling wrap: stronger phase motion so waves read as flow, not static noise.
  const wrap =
    Math.sin((px * 2.35 + py * 1.55 - pz * 1.05) * Math.PI - t * 1.45) * 0.42 +
    Math.sin((py * 2.7 - px * 0.85 + pz * 0.4) * Math.PI + t * 0.95) * 0.28

  const shaped = field * 0.62 + wrap * 0.38
  // Near-linear gain so mid Turbulence (0.5) already reads on the membrane.
  const gain = intensity * (0.65 + 0.35 * intensity)
  return shaped * TURBULENCE_MAX_DISPLACEMENT * gain
}

/** Sample using a Life Engine state object. */
export function sampleTurbulenceFromLife(x, y, z, life) {
  if (!life) return 0
  return sampleTurbulenceRadialOffset(x, y, z, {
    seed: life.seed,
    time: life.time,
    turbulence: life.environment?.turbulence ?? 0,
  })
}
