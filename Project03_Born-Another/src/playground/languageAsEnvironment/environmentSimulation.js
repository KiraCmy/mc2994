/**
 * Continuous environmental dynamics (Step 02 refinement).
 * Influence accumulates from language; displayed values soft-follow target.
 * Frame-rate independent via dt (seconds). Deterministic for fixed params.
 */

import { ENV_NEUTRAL, createEnvironmentState } from './envState.js'

export const ENV_CHANNELS = ['temperature', 'moisture', 'disturbance']

/** Base impulse per recognized concept hit (scaled by Impulse Strength). */
export const BASE_CONCEPT_IMPULSE = 0.14

/** Soft-follow rate toward target (1/s). */
export const FOLLOW_RATE = 3.2

export const DEFAULT_TUNING = Object.freeze({
  /** Multiplier on language impulses. */
  impulseStrength: 1.55,
  /** How fast influence decays toward 0 (1/s). Lower = longer persistence. */
  recoveryRate: 0.055,
  /**
   * Max |influence| from neutral → value band ≈ [0.5−L, 0.5+L].
   * L = 0.5 lets Temperature reach the full [0, 1] scrub range.
   */
  accumulationLimit: 0.5,
})

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function createSimulationState(overrides = {}) {
  const values = createEnvironmentState(overrides)
  return {
    values,
    /** Accumulated offset from neutral; bounded by accumulationLimit. */
    influence: {
      temperature: 0,
      moisture: 0,
      disturbance: 0,
    },
  }
}

export function resetSimulationState() {
  return createSimulationState()
}

export function resolveTuning(partial = {}) {
  return {
    impulseStrength: Number.isFinite(partial.impulseStrength)
      ? clamp(partial.impulseStrength, 0.1, 3)
      : DEFAULT_TUNING.impulseStrength,
    recoveryRate: Number.isFinite(partial.recoveryRate)
      ? clamp(partial.recoveryRate, 0.01, 1.5)
      : DEFAULT_TUNING.recoveryRate,
    accumulationLimit: Number.isFinite(partial.accumulationLimit)
      ? clamp(partial.accumulationLimit, 0.05, 0.5) // 0.5 → Temperature up to 1.0
      : DEFAULT_TUNING.accumulationLimit,
  }
}

/** Target the UI/value soft-follows. */
export function environmentTargets(state) {
  const targets = {}
  for (const channel of ENV_CHANNELS) {
    targets[channel] = clamp01(ENV_NEUTRAL + (state.influence[channel] ?? 0))
  }
  return targets
}

/**
 * Accumulate language impulses into influence (not a one-shot replace).
 * @param {ReturnType<typeof createSimulationState>} state
 * @param {{ temperature?: number, moisture?: number, disturbance?: number }} impulses
 * @param {ReturnType<typeof resolveTuning>} tuning
 */
export function applyEnvironmentImpulse(state, impulses = {}, tuning = DEFAULT_TUNING) {
  const params = resolveTuning(tuning)
  const limit = params.accumulationLimit
  const influence = { ...state.influence }

  for (const channel of ENV_CHANNELS) {
    const impulse = Number(impulses[channel]) || 0
    if (impulse === 0) continue
    influence[channel] = clamp(
      influence[channel] + impulse * params.impulseStrength,
      -limit,
      limit,
    )
  }

  return {
    values: { ...state.values },
    influence,
  }
}

/**
 * @param {ReturnType<typeof createSimulationState>} state
 * @param {number} dt
 * @param {ReturnType<typeof resolveTuning>} tuning
 */
export function stepEnvironment(state, dt, tuning = DEFAULT_TUNING) {
  const safeDt = Math.min(0.05, Math.max(0, Number(dt) || 0))
  if (safeDt <= 0) return state

  const params = resolveTuning(tuning)
  const recover = Math.exp(-params.recoveryRate * safeDt)
  const follow = 1 - Math.exp(-FOLLOW_RATE * safeDt)

  const influence = { ...state.influence }
  const values = { ...state.values }

  for (const channel of ENV_CHANNELS) {
    influence[channel] *= recover
    if (Math.abs(influence[channel]) < 1e-5) influence[channel] = 0

    const target = clamp01(ENV_NEUTRAL + influence[channel])
    values[channel] = clamp01(
      values[channel] + (target - values[channel]) * follow,
    )
  }

  return { values, influence }
}

export function environmentTrend(state, channel) {
  const target = clamp01(ENV_NEUTRAL + (state.influence[channel] ?? 0))
  const current = state.values[channel] ?? ENV_NEUTRAL
  const delta = target - current
  if (Math.abs(delta) > 0.012) return Math.sign(delta)
  const vsNeutral = current - ENV_NEUTRAL
  if (Math.abs(vsNeutral) < 0.01) return 0
  return Math.sign(vsNeutral)
}
