import { LIFE_DURATION_SECONDS } from '../worldv2/life/lifeEngine.js'
import { seedFromMemoryText } from './memorySeed.js'

/**
 * Map Memory Signature → existing World / Life Engine controls.
 * Step 01: seed + durationSeconds + optional early stimuli (history).
 * Does not change shared World defaults when MEMORY LAB is idle.
 */

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function lerp(a, b, t) {
  return a + (b - a) * clamp01(t)
}

/**
 * Unit directions for seeded stimuli (deterministic from signature).
 * Life Engine maps these to field regions.
 */
function stimulusDirections(signature, count) {
  const dirs = [
    [0.12, 0.92, 0.18],
    [-0.55, 0.35, 0.72],
    [0.7, -0.15, -0.48],
  ]
  return dirs.slice(0, Math.max(0, count)).map((direction, index) => ({
    id: index,
    step: Math.round(lerp(8, 36, signature.intensity) + index * 10),
    direction,
    strength: lerp(0.45, 1, signature.intensity),
  }))
}

/**
 * @param {object} signature
 * @param {string} text
 * @returns {{ seed: number, durationSeconds: number, history: object[] }}
 */
export function mapMemoryToWorldParameters(signature, text) {
  const seed = seedFromMemoryText(text)

  // Duration → life clock length (safe band around World default 90s).
  const durationSeconds = Math.round(
    lerp(LIFE_DURATION_SECONDS * 0.72, LIFE_DURATION_SECONDS * 1.28, signature.duration),
  )

  // Repetition → how many early growth stimuli are baked into history (0–2).
  const stimulusCount =
    signature.repetition >= 0.75 ? 2 : signature.repetition >= 0.45 ? 1 : 0
  const history = stimulusDirections(signature, stimulusCount)

  return {
    seed,
    durationSeconds,
    history,
    /** Debug-only labels for the mapping (not shown in user UI). */
    debugMapping: {
      seed,
      durationSeconds,
      stimulusCount,
      intensityStrength:
        stimulusCount > 0 ? lerp(0.45, 1, signature.intensity) : 0,
    },
  }
}
