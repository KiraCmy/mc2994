/**
 * Exp05 Study 01 — multi-cluster layout for Crystal Agents.
 * Several bio-crystal clusters on one local membrane patch around the
 * single-cluster focus seat. Geometry planning only; no simulation.
 *
 * Piece ids stay unique across clusters because planCrystalCluster prefixes
 * every id with the site id (p-{site}-{i}, s-{site}-{i}, micro-{site}-{i}…).
 */
import { planCrystalCluster } from './crystalClusterGeometry.js'
import { EXP03_MORPHOLOGY_DEFAULTS } from './crystalMorphologyParams.js'
import { SINGLE_BIO_CLUSTER_PLAN_OPTS } from './singleBioCrystalPlan.js'
import {
  buildSingleMatureSite,
  EXP03_SINGLE_CLUSTER_ANCHOR,
} from './staticCrystalPlan.js'

export const MULTI_CLUSTER_MAX = 5
export const MULTI_CLUSTER_DEFAULT_COUNT = 5

/**
 * Tangent-plane offsets (≈ radians on the membrane, radius ≈ 1.4) around the
 * focus anchor. Index 0 is the hero cluster; satellites are smaller and sit
 * close enough to read as one colony; at full growth neighbouring formations
 * may brush edges (intended — groundwork for neighbour competition).
 * `microKeep` thins the root micro carpet on satellites (draw-call budget).
 */
export const MULTI_CLUSTER_LAYOUT = Object.freeze([
  { id: 0, offset: [0, 0], scale: 1.68, density: 0.95, microKeep: 1 },
  { id: 1, offset: [-0.22, 0.17], scale: 1.33, density: 0.6, microKeep: 0.5 },
  { id: 2, offset: [0.23, 0.11], scale: 1.26, density: 0.55, microKeep: 0.5 },
  { id: 3, offset: [0.11, -0.22], scale: 1.23, density: 0.5, microKeep: 0.45 },
  { id: 4, offset: [-0.18, -0.19], scale: 1.15, density: 0.45, microKeep: 0.4 },
])

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / len, v[1] / len, v[2] / len]
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

/** Right / up tangent basis at a membrane direction (y-up world). */
export function tangentBasis(direction) {
  const n = normalize3(direction)
  const helper = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const right = normalize3(cross3(helper, n))
  const up = normalize3(cross3(n, right))
  return { normal: n, right, up }
}

/** Direction on the membrane offset from `base` in its tangent plane. */
export function offsetDirection(base, [ox, oy]) {
  const { normal, right, up } = tangentBasis(base)
  return normalize3([
    normal[0] + right[0] * ox + up[0] * oy,
    normal[1] + right[1] * ox + up[1] * oy,
    normal[2] + right[2] * ox + up[2] * oy,
  ])
}

function clampCount(count) {
  const n = Math.round(Number(count))
  if (!Number.isFinite(n)) return MULTI_CLUSTER_DEFAULT_COUNT
  return Math.min(MULTI_CLUSTER_MAX, Math.max(1, n))
}

/**
 * Keep a deterministic, evenly spread subset of root micros.
 * Child micros attached to primaries are left untouched.
 */
function thinRootMicros(plan, keep) {
  if (keep >= 0.999) return plan
  let index = 0
  return plan.filter((piece) => {
    if (piece.role !== 'micro' || piece.parentId) return true
    const k = index
    index += 1
    /* Bresenham-style even pick: keep when floor crosses an integer. */
    return Math.floor((k + 1) * keep) > Math.floor(k * keep)
  })
}

/**
 * @param {number} seed
 * @param {{ count?: number, morphology?: object }} [opts]
 * @returns {Array<{
 *   id: string, index: number, site: object, plan: object[],
 *   direction: number[], scale: number,
 * }>}
 */
export function planMultiBioCrystalClusters(
  seed = 1,
  { count = MULTI_CLUSTER_DEFAULT_COUNT, morphology = EXP03_MORPHOLOGY_DEFAULTS } = {},
) {
  const n = clampCount(count)
  const base = EXP03_SINGLE_CLUSTER_ANCHOR.direction
  const clusters = []

  for (let i = 0; i < n; i += 1) {
    const layout = MULTI_CLUSTER_LAYOUT[i]
    const direction = offsetDirection(base, layout.offset)
    const site = buildSingleMatureSite(seed, {
      id: layout.id,
      direction,
      scale: layout.scale,
    })
    const plan = planCrystalCluster(site, {
      ...SINGLE_BIO_CLUSTER_PLAN_OPTS,
      clusterDensity: layout.density,
      seed,
      morphology: {
        ...SINGLE_BIO_CLUSTER_PLAN_OPTS.morphology,
        ...morphology,
        cohesion: 0.92,
        membraneEmbed: 0.055,
        secondaryPerPrimary: i === 0 ? 2.2 : 1.6,
        tertiaryChance: i === 0 ? 0.78 : 0.55,
        tertiaryBudget: i === 0 ? 8 : 4,
        primarySlenderness: 2.05,
        formationScale: 1.12,
      },
    })

    clusters.push({
      id: `c${layout.id}`,
      index: i,
      site,
      plan: thinRootMicros(plan, layout.microKeep),
      direction,
      scale: layout.scale,
    })
  }

  return clusters
}

/** All pieces across clusters, each tagged with its clusterId. */
export function flattenClusterPieces(clusters) {
  const out = []
  for (const cluster of clusters || []) {
    for (const piece of cluster.plan) {
      out.push({ ...piece, clusterId: cluster.id })
    }
  }
  return out
}
