/** Particle mode defaults — near-surface volumetric field. */
export const INITIAL_PARTICLE = {
  /** How many points to sample around the deformed body. */
  count: 20000,
  /** Deterministic sample jitter seed (independent of surface identity). */
  seed: 44017,
  /**
   * Max normal offset for the farthest particles (object units).
   * Most grit stays near zero; a thin outer shell uses the full range.
   */
  fieldThickness: 0.14,
  /**
   * How structured the near-surface flow is (0 = few broad streams,
   * 1 = more bends and local circulation).
   */
  fieldComplexity: 0.45,
  /** Motion trail length (0 = off, 1 = PARTICLE_TRAIL_SPAN_MAX seconds of history). */
  trailLength: 0,
  /** 0 = uniform grains, 1 = mostly fine grains with a rare few larger. */
  sizeVariation: 0.65,
  /** 0 = uniform brightness, 1 = mostly faint with a few bright. */
  brightnessVariation: 0.55,
  /** Strength of the faint per-particle tint from the organism's colours. */
  colorInfluence: 0.35,
  /** Depth of each particle's slow, unsynchronised breathing. */
  pulseStrength: 0.4,
}

export const PARTICLE_COUNT_MIN = 500
export const PARTICLE_COUNT_MAX = 120000

export const PARTICLE_FIELD_THICKNESS_MIN = 0.02
export const PARTICLE_FIELD_THICKNESS_MAX = 0.45

export const PARTICLE_FIELD_COMPLEXITY_MIN = 0
export const PARTICLE_FIELD_COMPLEXITY_MAX = 1

export const PARTICLE_TRAIL_LENGTH_MIN = 0
export const PARTICLE_TRAIL_LENGTH_MAX = 1
/** Seconds of recorded movement at Trail Length = 1. */
export const PARTICLE_TRAIL_SPAN_MAX = 1.6
