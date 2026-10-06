/** Particle mode defaults — near-surface static cloud (step 1). */
export const INITIAL_PARTICLE = {
  /** How many points to sample around the deformed body. */
  count: 2800,
  /** Deterministic sample jitter seed (independent of surface identity). */
  seed: 44017,
}

export const PARTICLE_COUNT_MIN = 200
export const PARTICLE_COUNT_MAX = 16000
