/**
 * Distributed temperature spatial field (Step 03A refinement 02).
 * Low-frequency FBM in rest-space direction coordinates — no single lobe center.
 *
 * Coverage  → soft threshold (active surface fraction), not amplitude.
 * Variation → spatial frequency of the noise.
 * Strength  → radial displacement magnitude.
 */

import { ENV_NEUTRAL } from './envState.js'

/** Peak radial displacement scale at |ΔT| = 0.5 (Temperature 0 or 1). */
export const SPATIAL_FIELD_PEAK = 0.78

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function clamp01(value) {
  return clamp(Number(value) || 0, 0, 1)
}

function smootherstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / Math.max(1e-8, edge1 - edge0))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

/** Deterministic hash → [0, 1) */
function hash3(ix, iy, iz, seed) {
  let n = (ix * 374761393 + iy * 668265263 + iz * 1274126177 + seed) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  n = Math.imul(n ^ (n >>> 16), 2246822519)
  return ((n >>> 0) % 1000000) / 1000000
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function gradDot(ix, iy, iz, seed, x, y, z) {
  const h = hash3(ix, iy, iz, seed)
  // 8 diagonal gradients
  const gx = h < 0.5 ? 1 : -1
  const gy = h % 0.25 < 0.125 ? 1 : -1
  const gz = (h * 7) % 1 < 0.5 ? 1 : -1
  return gx * x + gy * y + gz * z
}

/** Classic value/perlin-ish noise in R3 → roughly [-1, 1]. */
function valueNoise3(x, y, z, seed) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const z0 = Math.floor(z)
  const fx = x - x0
  const fy = y - y0
  const fz = z - z0
  const u = fade(fx)
  const v = fade(fy)
  const w = fade(fz)

  const n000 = gradDot(x0, y0, z0, seed, fx, fy, fz)
  const n100 = gradDot(x0 + 1, y0, z0, seed, fx - 1, fy, fz)
  const n010 = gradDot(x0, y0 + 1, z0, seed, fx, fy - 1, fz)
  const n110 = gradDot(x0 + 1, y0 + 1, z0, seed, fx - 1, fy - 1, fz)
  const n001 = gradDot(x0, y0, z0 + 1, seed, fx, fy, fz - 1)
  const n101 = gradDot(x0 + 1, y0, z0 + 1, seed, fx - 1, fy, fz - 1)
  const n011 = gradDot(x0, y0 + 1, z0 + 1, seed, fx, fy - 1, fz - 1)
  const n111 = gradDot(x0 + 1, y0 + 1, z0 + 1, seed, fx - 1, fy - 1, fz - 1)

  const x00 = lerp(n000, n100, u)
  const x10 = lerp(n010, n110, u)
  const x01 = lerp(n001, n101, u)
  const x11 = lerp(n011, n111, u)
  const y0n = lerp(x00, x10, v)
  const y1n = lerp(x01, x11, v)
  return lerp(y0n, y1n, w) * 0.577 // normalize-ish
}

function fbm3(x, y, z, seed, octaves = 3) {
  let amp = 0.55
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i += 1) {
    sum +=
      amp *
      valueNoise3(x * freq, y * freq, z * freq, (seed + i * 1013) | 0)
    norm += amp
    amp *= 0.5
    freq *= 2.05
  }
  return sum / Math.max(1e-8, norm)
}

function unitFromPoint(x, y, z) {
  const len = Math.hypot(x, y, z) || 1
  return [x / len, y / len, z / len]
}

/**
 * Build a stable sampler for one compare branch.
 *
 * @returns {{
 *   active: boolean,
 *   sampleNoise: (x,y,z) => number,
 *   sampleMask: (x,y,z) => number,
 *   sampleInfluence: (x,y,z) => number,
 *   sampleOffset: (x,y,z) => number,
 * }}
 */
export function createTemperatureSpatialSampler({
  seed = 0,
  temperature = ENV_NEUTRAL,
  spatialEnabled = true,
  spatialCoverage = 0.85,
  spatialVariation = 0.55,
  displacementStrength = 1.25,
} = {}) {
  const t = clamp01(temperature)
  const delta = t - ENV_NEUTRAL
  const enabled = spatialEnabled !== false && Math.abs(delta) >= 1e-8
  const coverage = clamp01(spatialCoverage)
  const variation = clamp01(spatialVariation)
  const strength = clamp(Number(displacementStrength) || 0, 0, 3)

  // Variation → frequency only (independent of strength).
  const frequency = lerp(0.35, 2.6, variation)
  // Coverage → threshold on |noise| (not amplitude).
  // Noise is remapped toward ~[-1,1]; low coverage keeps only peaks.
  const threshold = lerp(0.72, -0.05, coverage)
  const soft = 0.16
  const fieldSeed = (Number(seed) || 0) ^ 0x70ffee

  const sampleNoise = (x, y, z) => {
    const [dx, dy, dz] = unitFromPoint(x, y, z)
    // Two offset FBM layers for broader coherent regions (not single lobes).
    const a = fbm3(dx * frequency, dy * frequency, dz * frequency, fieldSeed, 3)
    const b = fbm3(
      dx * frequency * 0.55 + 2.1,
      dy * frequency * 0.55 - 1.3,
      dz * frequency * 0.55 + 0.7,
      fieldSeed ^ 0x9e3779,
      2,
    )
    const raw = a * 0.72 + b * 0.28
    // Stretch typical FBM range so coverage thresholds behave predictably.
    return clamp(raw * 2.4, -1, 1)
  }

  const sampleMask = (x, y, z) => {
    if (!enabled) return 0
    const n = Math.abs(sampleNoise(x, y, z))
    return smootherstep(threshold - soft, threshold + soft, n)
  }

  /** Signed influence before displacement strength — for diagnostic overlay. */
  const sampleInfluence = (x, y, z) => {
    if (!enabled) return 0
    const n = sampleNoise(x, y, z)
    const mask = sampleMask(x, y, z)
    return n * mask
  }

  /** Radial rest-space offset (World units). */
  const sampleOffset = (x, y, z) => {
    if (!enabled || strength <= 1e-8) return 0
    const influence = sampleInfluence(x, y, z)
    return influence * delta * 2 * strength * SPATIAL_FIELD_PEAK
  }

  return {
    active: enabled,
    sampleNoise,
    sampleMask,
    sampleInfluence,
    sampleOffset,
  }
}

/** Null sampler for baseline / disabled. */
export function createNeutralSpatialSampler() {
  return {
    active: false,
    sampleNoise: () => 0,
    sampleMask: () => 0,
    sampleInfluence: () => 0,
    sampleOffset: () => 0,
  }
}
