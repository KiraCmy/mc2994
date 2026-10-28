/**
 * Exp03 Crystal Agent — shared types / constants (simulation only).
 */

export const CRYSTAL_AGENT_STATES = Object.freeze({
  DORMANT: 'dormant',
  GROWING: 'growing',
  BRANCHING: 'branching',
  STRESSED: 'stressed',
  DECAYING: 'decaying',
})

export const CRYSTAL_AGENT_STATE_LIST = Object.freeze([
  CRYSTAL_AGENT_STATES.DORMANT,
  CRYSTAL_AGENT_STATES.GROWING,
  CRYSTAL_AGENT_STATES.BRANCHING,
  CRYSTAL_AGENT_STATES.STRESSED,
  CRYSTAL_AGENT_STATES.DECAYING,
])

/** Fixed sim step — deterministic regardless of display FPS. */
export const CRYSTAL_AGENT_DT = 1 / 30

export const CRYSTAL_AGENT_DEFAULTS = Object.freeze({
  moisture: 0.55,
  /** Moisture below this → stress pathway. */
  moistureStress: 0.28,
  /** Moisture above this → leave stress / allow branching. */
  moistureComfort: 0.42,
  /** Moisture below this while stressed → decay. */
  moistureCritical: 0.12,
  /** Moisture above this → wake from dormant. */
  moistureWake: 0.32,
})
