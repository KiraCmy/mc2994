/**
 * Exp03 Study 01 — Crystal Morphology Lab study modes.
 * Static geometry comparison only; no growth / Agent logic.
 */

export const EXP03_MORPHOLOGY_MODES = {
  FACETED_BRANCHING: 'faceted-branching',
  CRYSTALLINE_PETALS: 'crystalline-petals',
  MINERAL_NETWORK: 'mineral-network',
}

export const EXP03_MORPHOLOGY_MODE_OPTIONS = [
  {
    id: EXP03_MORPHOLOGY_MODES.FACETED_BRANCHING,
    label: 'A',
    title: 'Faceted Branching',
    blurb:
      'Irregular faceted branches emerging from a shared growth structure.',
  },
  {
    id: EXP03_MORPHOLOGY_MODES.CRYSTALLINE_PETALS,
    label: 'B',
    title: 'Crystalline Petals',
    blurb:
      'Layered, translucent, asymmetrical mineralized sheets with clear facets.',
  },
  {
    id: EXP03_MORPHOLOGY_MODES.MINERAL_NETWORK,
    label: 'C',
    title: 'Mineral Network',
    blurb:
      'Connected crystalline structures spreading across the membrane with local protrusions.',
  },
]

export function normalizeExp03MorphologyMode(value) {
  const allowed = new Set(Object.values(EXP03_MORPHOLOGY_MODES))
  return allowed.has(value)
    ? value
    : EXP03_MORPHOLOGY_MODES.FACETED_BRANCHING
}

/** Shared growth seat for all Morphology Lab studies (front-center membrane). */
export const EXP03_MORPHOLOGY_LAB_ANCHOR = {
  id: 0,
  direction: [0.06, 0.18, 0.982],
  /** Comparable overall footprint across A / B / C. */
  scale: 1,
}

/** Target world-space extent of the growth region (~object units). */
export const EXP03_MORPHOLOGY_LAB_EXTENT = 0.28
