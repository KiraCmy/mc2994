/**
 * Exp03 Study 01 — crystal morphology parameters (geometry only).
 * Kept separate from materials / rendering so later growth + Agents can bind here.
 */

export const EXP03_MORPHOLOGY_DEFAULTS = {
  /** Overall footprint scale relative to the mature site length. */
  formationScale: 1,
  /** How tightly primaries share one growth pocket (0 = spread, 1 = fused root). */
  cohesion: 0.82,
  /** Depth of primary root embed into the membrane surface. */
  membraneEmbed: 0.045,
  /** Primary count bias (actual count remains 2–3 from seed). */
  primaryBias: 0.55,
  /** Secondary branches per primary (clamped in planner). */
  secondaryPerPrimary: 1.6,
  /** Probability a secondary sprouts a tertiary. */
  tertiaryChance: 0.48,
  /** Max tertiaries across the formation. */
  tertiaryBudget: 5,
  /** Length / width target for primaries. */
  primarySlenderness: 2.05,
  /** Length / width target for secondary / tertiary. */
  branchSlenderness: 2.2,
  /** Lateral lean strength for side branches (0–1). */
  branchLean: 0.72,
  /** How far along the parent shaft children attach (mean). */
  attachMean: 0.4,
  /** Intergrowth lobe chance on primary mesh profiles. */
  intergrowthChance: 0.55,
}

export function normalizeExp03MorphologyParams(overrides = {}) {
  const d = EXP03_MORPHOLOGY_DEFAULTS
  const n = (v, fallback) => {
    const x = Number(v)
    return Number.isFinite(x) ? x : fallback
  }
  const clamp01 = (v) => Math.min(1, Math.max(0, v))
  return {
    formationScale: Math.max(0.5, n(overrides.formationScale, d.formationScale)),
    cohesion: clamp01(n(overrides.cohesion, d.cohesion)),
    membraneEmbed: Math.max(0.01, n(overrides.membraneEmbed, d.membraneEmbed)),
    primaryBias: clamp01(n(overrides.primaryBias, d.primaryBias)),
    secondaryPerPrimary: Math.max(
      1,
      Math.min(3, n(overrides.secondaryPerPrimary, d.secondaryPerPrimary)),
    ),
    tertiaryChance: clamp01(n(overrides.tertiaryChance, d.tertiaryChance)),
    tertiaryBudget: Math.max(
      2,
      Math.min(8, Math.round(n(overrides.tertiaryBudget, d.tertiaryBudget))),
    ),
    primarySlenderness: Math.max(
      1.6,
      Math.min(2.8, n(overrides.primarySlenderness, d.primarySlenderness)),
    ),
    branchSlenderness: Math.max(
      1.6,
      Math.min(3.0, n(overrides.branchSlenderness, d.branchSlenderness)),
    ),
    branchLean: clamp01(n(overrides.branchLean, d.branchLean)),
    attachMean: clamp01(n(overrides.attachMean, d.attachMean)),
    intergrowthChance: clamp01(
      n(overrides.intergrowthChance, d.intergrowthChance),
    ),
  }
}
