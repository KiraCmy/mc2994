/**
 * Exp03 Study 01 — shared plan for SingleBioCrystalCluster + Crystal Agent sim.
 * Geometry planning only; no simulation or rendering.
 */
import { planCrystalCluster } from './crystalClusterGeometry.js'
import { EXP03_MORPHOLOGY_DEFAULTS } from './crystalMorphologyParams.js'
import { buildSingleMatureSite } from './staticCrystalPlan.js'

export const SINGLE_BIO_CLUSTER_PLAN_OPTS = Object.freeze({
  clusterDensity: 0.95,
  branching: 0.85,
  lengthVariation: 0.5,
  dissolve: 0,
  crystalOnly: true,
  morphology: Object.freeze({
    ...EXP03_MORPHOLOGY_DEFAULTS,
    cohesion: 0.92,
    membraneEmbed: 0.055,
    secondaryPerPrimary: 2.2,
    tertiaryChance: 0.78,
    tertiaryBudget: 8,
    primarySlenderness: 2.05,
    formationScale: 1.12,
  }),
})

/**
 * @param {number} seed
 * @param {object} [morphology]
 */
export function planSingleBioCrystalPieces(
  seed = 1,
  morphology = EXP03_MORPHOLOGY_DEFAULTS,
) {
  const site = buildSingleMatureSite(seed)
  const plan = planCrystalCluster(site, {
    ...SINGLE_BIO_CLUSTER_PLAN_OPTS,
    seed,
    morphology: {
      ...SINGLE_BIO_CLUSTER_PLAN_OPTS.morphology,
      ...morphology,
      cohesion: 0.92,
      membraneEmbed: 0.055,
      secondaryPerPrimary: 2.2,
      tertiaryChance: 0.78,
      tertiaryBudget: 8,
      primarySlenderness: 2.05,
      formationScale: 1.12,
    },
  })
  return { site, plan }
}
