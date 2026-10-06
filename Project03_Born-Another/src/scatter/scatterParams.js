/** Scatter growth morphologies — switch assets without reshuffling samples. */
export const SCATTER_GROWTH_TYPES = [
  { id: 'membrane', label: 'Membrane' },
  { id: 'plume', label: 'Plume' },
  { id: 'pod', label: 'Pod' },
]

/** Scatter mode defaults — localized growth clusters with room to pack denser. */
export const INITIAL_SCATTER = {
  /** Active scatter asset family. */
  growthType: 'membrane',
  /** Default dense enough that growths read across the whole surface. */
  density: 0.65,
  /** Base cluster scale; per-instance jitter multiplies on top. */
  size: 1,
  /** Bumped by Regenerate to reshuffle surface samples. */
  generation: 0,
  seed: 884731,
}

export const SCATTER_INSTANCE_RADIUS = 0.028

/** Map density 0–1 → cluster count. Tunable without touching sampling code. */
export function scatterCountFromDensity(density) {
  const t = Math.min(1, Math.max(0, density))
  // Default ≈127; max ≈360 so the surface can be packed more densely.
  return Math.round(20 + t * 340)
}
