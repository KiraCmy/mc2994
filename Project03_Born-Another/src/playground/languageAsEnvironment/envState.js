/**
 * Environmental conditions for Language as Environment (Step 01).
 * Continuous 0–1 values; language → env → growth wiring comes later.
 */

export const ENV_NEUTRAL = 0.5

export const INITIAL_ENVIRONMENT = Object.freeze({
  temperature: ENV_NEUTRAL,
  moisture: ENV_NEUTRAL,
  disturbance: ENV_NEUTRAL,
})

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
