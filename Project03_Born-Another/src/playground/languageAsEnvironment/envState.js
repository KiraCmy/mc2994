/**
 * Environmental conditions for Language as Environment (Step 01).
 * Continuous 0–1 values; Playground syncs Moisture / Disturbance into Life Engine.
 */

export const ENV_NEUTRAL = 0.5

export const INITIAL_ENVIRONMENT = Object.freeze({
  temperature: ENV_NEUTRAL,
  moisture: ENV_NEUTRAL,
  disturbance: ENV_NEUTRAL,
})

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

export function createEnvironmentState(overrides = {}) {
  return {
    temperature: Number.isFinite(overrides.temperature)
      ? overrides.temperature
      : ENV_NEUTRAL,
    moisture: Number.isFinite(overrides.moisture)
      ? overrides.moisture
      : ENV_NEUTRAL,
    disturbance: Number.isFinite(overrides.disturbance)
      ? overrides.disturbance
      : ENV_NEUTRAL,
  }
}

/**
 * Map language Disturbance (neutral 0.5) → Life Engine Turbulence (calm 0).
 * disturbance 0.5 → 0, disturbance 1.0 → 1, below neutral → 0.
 */
export function disturbanceToTurbulence(disturbance) {
  return clamp01((clamp01(disturbance) - ENV_NEUTRAL) * 2)
}

/** Quantize env → Life Engine sync to avoid history spam from soft-follow. */
export function quantizeEnvChannel(value, step = 0.01) {
  const s = step > 0 ? step : 0.01
  return Math.round(clamp01(value) / s) * s
}
