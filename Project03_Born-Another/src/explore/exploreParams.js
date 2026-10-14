/**
 * Explore mode — integration space for camera-scale testing.
 * No separate procedural system; reuses host / Scatter / Particle state.
 */
export const INITIAL_EXPLORE = {}

/** Orbit distance: whole-organism OBSERVE → close SURFACE (object units). */
export const EXPLORE_MIN_DISTANCE = 1.55
export const EXPLORE_MAX_DISTANCE = 18

/** Default orbit band when not in Explore. */
export const DEFAULT_MIN_DISTANCE = 4.2
export const DEFAULT_MAX_DISTANCE = 8.5
