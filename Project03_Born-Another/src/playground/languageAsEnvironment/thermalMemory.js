/**
 * Step 03B/03D — Thermal exposure & structural memory (Playground only).
 *
 * thermalExposure accumulates from |T − 0.50| over advancing simulation time.
 * Persistent morphology uses a seed-locked multi-band spatial field scaled by
 * memory magnitude — not a frozen mesh snapshot. Environment recovery is unchanged.
 *
 * Step 03D: progressive magnitude→displacement (no residual ΔT floor) and
 * low-frequency silhouette bands so preview steps 0.05 / 0.10 / 0.20 diverge clearly.
 */

import { ENV_NEUTRAL } from './envState.js'

export const DEFAULT_THERMAL_MEMORY = Object.freeze({
  enabled: true,
  /** |ΔT| must exceed this before exposure integrates. */
  exposureThreshold: 0.06,
  /** Exposure units per second at |ΔT| = 1 above threshold. */
  accumulationRate: 0.3,
  /** Soft cap on thermalExposure. */
  exposureLimit: 1,
  /**
   * How fast structural memory eases back while Temperature is near-neutral (1/s).
   * Lower = longer-lived scars; 0 = never recovers until cleared.
   */
  memoryRecoveryRate: 0.028,
  /**
   * Multiplier on structural radial peak at magnitude = 1.
   * Default 1.55 keeps the existing calibration slider centered.
   */
  memoryDeformationStrength: 1.55,
  /** Active fraction of the surface (soft mask on |field|). */
  memoryCoverage: 0.88,
  /**
   * Mix toward mid/high detail (0 = silhouette-only, 1 = more local variation).
   * Kept moderate so memory reads as form change, not wrinkle noise.
   */
  memoryVariation: 0.28,
})

/**
 * Step 03F — scale-aware radial gain.
 * Chosen so default strength + mag 0.20 → ~16.5% max |disp| / meanRestRadius
 * (field peak |influence| ≈ 0.51 from 03E final-geometry measures).
 *
 *   response = memoryGeometryResponse(magnitude)
 *   radialScale = min(CEILING_FRAC · R, response · GAIN · (strength/1.55) · R)
 */
export const MEMORY_RADIUS_RESPONSE_GAIN = 1.79

/** Soft ceiling as a fraction of mean rest radius (preserves organism identity). */
export const MEMORY_RADIAL_CEILING_FRAC = 0.42

/** @deprecated Absolute peak from 03D; kept for diagnostics/docs only. */
export const MEMORY_STRUCTURE_PEAK = 2.2

/** Reference strength that MEMORY_RADIUS_RESPONSE_GAIN was authored against. */
const MEMORY_STRENGTH_REFERENCE = 1.55

/** Fallback if caller omits measured radius (unitless legacy path). */
const MEMORY_RADIUS_FALLBACK = 1

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function clamp01(value) {
  return clamp(Number(value) || 0, 0, 1)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function smootherstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / Math.max(1e-8, edge1 - edge0))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

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
  const gx = h < 0.5 ? 1 : -1
  const gy = h % 0.25 < 0.125 ? 1 : -1
  const gz = (h * 7) % 1 < 0.5 ? 1 : -1
  return gx * x + gy * y + gz * z
}

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
  return lerp(y0n, y1n, w) * 0.577
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
 * Progressive geometry gain from memory magnitude.
 * Linear primary term preserves equal preview spacing (0.05 / 0.10 / 0.20);
 * mild ease-in keeps very tiny magnitudes quieter without a large floor.
 */
export function memoryGeometryResponse(magnitude) {
  const m = clamp01(magnitude)
  if (m <= 1e-8) return 0
  // 0.88·m + 0.12·m² → nearly linear, slight acceleration toward higher memory.
  return m * (0.88 + 0.12 * m)
}

/** Deterministic unit axis from seed — gradual body asymmetry. */
function asymmetryAxis(seed) {
  const s = (Number(seed) || 0) ^ 0x61a55
  const u = hash3(3, 7, 11, s)
  const v = hash3(13, 17, 19, s ^ 0x9e37)
  const yaw = u * Math.PI * 2
  const pitch = (v - 0.5) * Math.PI * 0.7
  const cp = Math.cos(pitch)
  return [Math.cos(yaw) * cp, Math.sin(pitch), Math.sin(yaw) * cp]
}

/**
 * Multi-band structural field in rest-space directions.
 * Low frequency dominates silhouette; mid/high add coherent local variation.
 */
function createMemorySpatialField({
  seed,
  coverage = 0.88,
  variation = 0.28,
}) {
  const fieldSeed = (Number(seed) || 0) ^ 0x6d656d
  const cov = clamp01(coverage)
  const vary = clamp01(variation)
  // Higher variation → slightly more mid/high weight, never drowning the low band.
  const lowWeight = lerp(0.72, 0.52, vary)
  const midWeight = lerp(0.2, 0.32, vary)
  const highWeight = lerp(0.05, 0.14, vary)
  const asymWeight = 0.16
  const axis = asymmetryAxis(fieldSeed)
  // Soft mask: high coverage keeps broad regions; never isolates a single lobe.
  const threshold = lerp(0.55, -0.12, cov)
  const soft = 0.22

  const sampleRaw = (x, y, z) => {
    const [dx, dy, dz] = unitFromPoint(x, y, z)
    const low = fbm3(dx * 0.38, dy * 0.38, dz * 0.38, fieldSeed, 2)
    const mid = fbm3(
      dx * 0.95 + 1.7,
      dy * 0.95 - 0.9,
      dz * 0.95 + 0.4,
      fieldSeed ^ 0x51ced,
      2,
    )
    const high = fbm3(
      dx * 2.15 - 0.6,
      dy * 2.15 + 1.1,
      dz * 2.15 - 1.4,
      fieldSeed ^ 0xa31f,
      2,
    )
    const asym = dx * axis[0] + dy * axis[1] + dz * axis[2]
    const combined =
      low * lowWeight +
      mid * midWeight +
      high * highWeight +
      asym * asymWeight
    // Gentle stretch; avoid hard clipping spikes.
    return clamp(combined * 1.65, -1, 1)
  }

  const sampleMask = (x, y, z) => {
    const n = Math.abs(sampleRaw(x, y, z))
    return smootherstep(threshold - soft, threshold + soft, n)
  }

  const sampleInfluence = (x, y, z) => {
    const raw = sampleRaw(x, y, z)
    return raw * sampleMask(x, y, z)
  }

  return { sampleInfluence, sampleRaw, sampleMask }
}

export function createThermalMemoryState() {
  return {
    /** Accumulated unsigned exposure in [0, exposureLimit]. */
    thermalExposure: 0,
    /**
     * Signed bias in [-1, 1]: net heat (+) vs cold (−) history.
     * Used only to orient the persistent field polarity.
     */
    exposureBias: 0,
  }
}

/**
 * Frame-rate-independent exposure step.
 * Call only while simulation time advances (not Pause Time).
 *
 * @returns {{ thermalExposure: number, exposureBias: number }}
 */
export function stepThermalExposure(
  state,
  temperature,
  dtSeconds,
  options = DEFAULT_THERMAL_MEMORY,
) {
  const limit = clamp(Number(options.exposureLimit) || 1, 0.05, 2)
  const current = {
    thermalExposure: clamp(Number(state?.thermalExposure) || 0, 0, limit),
    exposureBias: clamp(Number(state?.exposureBias) || 0, -1, 1),
  }

  if (options.enabled === false) return current

  const dt = Math.min(0.05, Math.max(0, Number(dtSeconds) || 0))
  if (dt <= 0) return current

  const threshold = clamp(Number(options.exposureThreshold) || 0, 0, 0.49)
  const rate = clamp(Number(options.accumulationRate) || 0, 0, 3)
  const recoveryRate = clamp(Number(options.memoryRecoveryRate) || 0, 0, 1.5)
  const t = clamp01(temperature)
  const signed = t - ENV_NEUTRAL
  const deviation = Math.abs(signed)
  const excess = Math.max(0, deviation - threshold)

  // Near-neutral Temperature: slowly ease structural scars back toward rest.
  if (excess <= 0) {
    if (recoveryRate <= 0 || current.thermalExposure <= 0) return current
    const recover = Math.exp(-recoveryRate * dt)
    const thermalExposure = current.thermalExposure * recover
    const exposureBias = current.exposureBias * recover
    return {
      thermalExposure: thermalExposure < 1e-5 ? 0 : thermalExposure,
      exposureBias: Math.abs(exposureBias) < 1e-4 ? 0 : exposureBias,
    }
  }

  const gain = excess * rate * dt
  const thermalExposure = clamp(current.thermalExposure + gain, 0, limit)

  // Blend bias toward the sign of this exposure event.
  const targetBias = Math.sign(signed) || current.exposureBias
  const biasBlend = Math.min(1, gain * 3)
  const exposureBias = clamp(
    current.exposureBias + (targetBias - current.exposureBias) * biasBlend,
    -1,
    1,
  )

  return { thermalExposure, exposureBias }
}

/**
 * Persistent memory magnitude in [0, 1] for UI / field scaling.
 *
 *   u = thermalExposure / exposureLimit ∈ [0, 1]
 *   magnitude = 1 − (1 − u)^1.25
 */
export function persistentMemoryMagnitude(
  thermalExposure,
  options = DEFAULT_THERMAL_MEMORY,
) {
  if (options.enabled === false) return 0
  const limit = clamp(Number(options.exposureLimit) || 1, 0.05, 2)
  const e = clamp(Number(thermalExposure) || 0, 0, limit)
  const u = e / limit
  return 1 - (1 - u) ** 1.25
}

/**
 * Diagnostic inverse of persistentMemoryMagnitude.
 * Lets calibration previews drive the same geometry path without mutating state.
 */
export function thermalExposureForMagnitude(
  magnitude,
  options = DEFAULT_THERMAL_MEMORY,
) {
  const limit = clamp(Number(options.exposureLimit) || 1, 0.05, 2)
  const m = clamp01(magnitude)
  if (m <= 1e-8) return 0
  if (m >= 1 - 1e-8) return limit
  const u = 1 - (1 - m) ** (1 / 1.25)
  return clamp(u * limit, 0, limit)
}

/**
 * Diagnostic: sample |radial offset| over a fibonacci sphere (rest-space units).
 * Also returns a simple silhouette proxy (RMS of samples).
 */
export function estimateRadialDisplacementStats(
  sampleOffset,
  sampleCount = 768,
) {
  if (typeof sampleOffset !== 'function') {
    return { max: 0, mean: 0, rms: 0, samples: 0 }
  }
  const n = Math.max(16, Math.floor(Number(sampleCount) || 0) || 768)
  const golden = Math.PI * (3 - Math.sqrt(5))
  let sum = 0
  let sumSq = 0
  let maxAbs = 0
  for (let i = 0; i < n; i += 1) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    const x = Math.cos(theta) * radius
    const z = Math.sin(theta) * radius
    const d = Math.abs(Number(sampleOffset(x, y, z)) || 0)
    sum += d
    sumSq += d * d
    if (d > maxAbs) maxAbs = d
  }
  return {
    max: maxAbs,
    mean: sum / n,
    rms: Math.sqrt(sumSq / n),
    samples: n,
  }
}

/**
 * Persistent structural memory sampler (distinct multi-band field).
 * Intensity follows progressive magnitude response; polarity follows exposureBias.
 * Radial amplitude is scaled by meanRestRadius (Step 03F).
 *
 * @param {number} [meanRestRadius] Measured mean rest-surface radius for this seed.
 */
export function createStructuralMemorySampler({
  seed,
  thermalExposure,
  exposureBias = 0,
  memory = DEFAULT_THERMAL_MEMORY,
  meanRestRadius = MEMORY_RADIUS_FALLBACK,
}) {
  if (memory.enabled === false) {
    return {
      active: false,
      sampleOffset: () => 0,
      sampleInfluence: () => 0,
      magnitude: 0,
      response: 0,
      radialScale: 0,
      meanRestRadius: 0,
    }
  }

  const magnitude = persistentMemoryMagnitude(thermalExposure, memory)
  const radius = Math.max(
    1e-4,
    Number.isFinite(meanRestRadius) && meanRestRadius > 0
      ? meanRestRadius
      : MEMORY_RADIUS_FALLBACK,
  )

  if (magnitude <= 1e-5) {
    return {
      active: false,
      sampleOffset: () => 0,
      sampleInfluence: () => 0,
      magnitude: 0,
      response: 0,
      radialScale: 0,
      meanRestRadius: radius,
    }
  }

  const biasSign = exposureBias >= 0 ? 1 : -1
  const response = memoryGeometryResponse(magnitude)
  const strength = clamp(
    Number(memory.memoryDeformationStrength) || MEMORY_STRENGTH_REFERENCE,
    0,
    3,
  )
  const uncapped =
    response *
    MEMORY_RADIUS_RESPONSE_GAIN *
    (strength / MEMORY_STRENGTH_REFERENCE) *
    radius
  const ceiling = MEMORY_RADIAL_CEILING_FRAC * radius
  // Preview range stays nearly linear in response; full memory soft-caps by radius.
  const radialScale = Math.min(ceiling, uncapped)

  const field = createMemorySpatialField({
    seed,
    coverage: memory.memoryCoverage ?? 0.88,
    variation: memory.memoryVariation ?? 0.28,
  })

  const sampleInfluence = (x, y, z) =>
    biasSign * field.sampleInfluence(x, y, z)

  const sampleOffset = (x, y, z) =>
    sampleInfluence(x, y, z) * radialScale

  return {
    active: radialScale > 1e-8,
    magnitude,
    response,
    radialScale,
    meanRestRadius: radius,
    sampleOffset,
    sampleInfluence,
  }
}

/** Sum immediate + memory radial offsets for one vertex pass. */
export function combineRadialOffsets(immediateOffset, memoryOffset) {
  const hasImmediate = typeof immediateOffset === 'function'
  const hasMemory = typeof memoryOffset === 'function'
  if (!hasImmediate && !hasMemory) return null
  return (x, y, z) => {
    const a = hasImmediate ? immediateOffset(x, y, z) : 0
    const b = hasMemory ? memoryOffset(x, y, z) : 0
    return a + b
  }
}
