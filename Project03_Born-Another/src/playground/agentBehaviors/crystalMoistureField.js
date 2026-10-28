/**
 * Exp05 Study 01 — local moisture field on the membrane patch.
 *
 * The inspector slider sets a *global* moisture level. The membrane is not
 * uniform: a seeded "wet pocket" raises moisture near it and the patch dries
 * toward its edge. Each crystal cluster samples the field at its own seat, so
 * one global value produces different local conditions per cluster.
 *
 * contrast = 0 → every cluster sees exactly the global value (previous model).
 */
import { agentHash01 } from './crystalAgentSim.js'
import { offsetDirection } from './multiBioCrystalPlan.js'
import { EXP03_SINGLE_CLUSTER_ANCHOR } from './staticCrystalPlan.js'

export const MOISTURE_FIELD_DEFAULTS = Object.freeze({
  /** Max ± offset added to the global moisture (0 = uniform). */
  contrast: 0.25,
  /** Angular radius (rad) over which the wet pocket fades to the dry rim. */
  spread: 0.4,
})

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / len, v[1] / len, v[2] / len]
}

/**
 * @param {{ seed?: number, contrast?: number, spread?: number }} [opts]
 */
export function createMoistureField({
  seed = 1,
  contrast = MOISTURE_FIELD_DEFAULTS.contrast,
  spread = MOISTURE_FIELD_DEFAULTS.spread,
} = {}) {
  /* Wet pocket sits somewhere inside the cluster patch, seeded. */
  const angle = agentHash01(seed, 'wet-pocket', 1) * Math.PI * 2
  const radius = 0.12 + agentHash01(seed, 'wet-pocket', 2) * 0.22
  const wetDirection = offsetDirection(EXP03_SINGLE_CLUSTER_ANCHOR.direction, [
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  ])
  return {
    seed: seed | 0,
    contrast: Math.min(0.5, Math.max(0, Number(contrast) || 0)),
    spread: Math.max(0.05, Number(spread) || MOISTURE_FIELD_DEFAULTS.spread),
    wetDirection,
  }
}

/** Signed offset in [-contrast, +contrast] at a membrane direction. */
export function sampleMoistureOffset(field, direction) {
  if (!field || !(field.contrast > 0) || !direction) return 0
  const d = normalize3(direction)
  const w = field.wetDirection
  const dot = Math.min(1, Math.max(-1, d[0] * w[0] + d[1] * w[1] + d[2] * w[2]))
  const angle = Math.acos(dot)
  /* +1 at the pocket centre → −1 at/after `spread`. */
  const wetness = 1 - 2 * smoothstep(0, field.spread, angle)
  return field.contrast * wetness
}

/** Local moisture 0..1 at a direction for a given global level. */
export function sampleLocalMoisture(field, direction, globalMoisture) {
  return clamp01(clamp01(globalMoisture) + sampleMoistureOffset(field, direction))
}

/** clusterId → offset map consumed by the agent sim. */
export function moistureOffsetsForClusters(field, clusters) {
  /** @type {Record<string, number>} */
  const out = {}
  for (const cluster of clusters || []) {
    out[cluster.id] = sampleMoistureOffset(field, cluster.direction)
  }
  return out
}
