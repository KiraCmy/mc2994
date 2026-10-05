/** Scatter mode defaults — keep lean; expand later (orientation, noise, assets). */
export const INITIAL_SCATTER = {
  density: 0.45,
  /** Bumped by Regenerate to reshuffle surface samples. */
  generation: 0,
  seed: 884731,
}

export const SCATTER_INSTANCE_RADIUS = 0.028

/** Map density 0–1 → instance count. Tunable without touching sampling code. */
export function scatterCountFromDensity(density) {
  const t = Math.min(1, Math.max(0, density))
  return Math.round(40 + t * 460)
}
