/**
 * Exp03 Study 01 — static crystal cluster plans (visual prototype).
 * Independent of Growth Time / dissolve. Later bindable to Growth Site Agents.
 */
import { exp03Hash01 } from './crystalClusterGeometry.js'

/** Multi-cluster anchors (reserved for later distribution studies). */
export const EXP03_STATIC_CLUSTER_ANCHORS = [
  { id: 0, direction: [0.42, 0.78, 0.46], scale: 1.12 },
  { id: 1, direction: [-0.55, 0.62, 0.56], scale: 0.98 },
  { id: 2, direction: [0.18, 0.48, 0.86], scale: 1.05 },
  { id: 3, direction: [-0.22, 0.72, -0.66], scale: 0.92 },
  { id: 4, direction: [0.72, 0.38, -0.28], scale: 0.88 },
  { id: 5, direction: [-0.68, 0.45, -0.48], scale: 0.95 },
]

/**
 * Step 2 — single front-center prototype seat (camera looks down +Z).
 * Slightly above geometric center so the cluster reads clearly on the face.
 */
export const EXP03_SINGLE_CLUSTER_ANCHOR = {
  id: 0,
  direction: [0.06, 0.18, 0.982],
  /* Larger footprint so the formation fills the reference close-up frame. */
  scale: 1.55,
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / len, v[1] / len, v[2] / len]
}

function tiltDirection(base, seed, siteId, amount = 0.18) {
  const u = exp03Hash01(seed, siteId, 3)
  const v = exp03Hash01(seed, siteId, 7)
  const n = normalize3(base)
  const helper = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const rx = n[1] * helper[2] - n[2] * helper[1]
  const ry = n[2] * helper[0] - n[0] * helper[2]
  const rz = n[0] * helper[1] - n[1] * helper[0]
  const rlen = Math.hypot(rx, ry, rz) || 1
  const right = [rx / rlen, ry / rlen, rz / rlen]
  const fx = n[1] * right[2] - n[2] * right[1]
  const fy = n[2] * right[0] - n[0] * right[2]
  const fz = n[0] * right[1] - n[1] * right[0]
  const angle = u * Math.PI * 2
  const tilt = amount * (0.55 + v * 0.45)
  return normalize3([
    n[0] + (right[0] * Math.cos(angle) + fx * Math.sin(angle)) * tilt,
    n[1] + (right[1] * Math.cos(angle) + fy * Math.sin(angle)) * tilt,
    n[2] + (right[2] * Math.cos(angle) + fz * Math.sin(angle)) * tilt,
  ])
}

function buildMatureSite(seed, anchor) {
  const direction = normalize3(anchor.direction)
  /* Keep growthDirection near outward — rosette fan is planned in geometry. */
  const growthDirection = tiltDirection(direction, seed, anchor.id, 0.08)
  const scale = Number(anchor.scale) || 1
  /* Mineral formation footprint — substantial primaries, not needles. */
  const maxLength = 0.32 * scale
  const length = maxLength
  const radius = 0.1 * (0.95 + scale * 0.12)
  const branchCount = 5 + Math.floor(exp03Hash01(seed, anchor.id, 11) * 3)
  const branches = []
  for (let i = 0; i < branchCount; i += 1) {
    const u = exp03Hash01(seed, anchor.id, i + 20)
    const branchDir = tiltDirection(
      growthDirection,
      seed,
      anchor.id * 17 + i,
      0.52,
    )
    branches.push({
      id: anchor.id * 10 + i + 1,
      parentId: anchor.id,
      length: maxLength * (0.32 + u * 0.48),
      maxLength: maxLength * 0.75,
      radius: radius * (0.42 + u * 0.28),
      growthDirection: branchDir,
      direction: branchDir,
      attachDistance: 0.18 + u * 0.5,
      roll: u * Math.PI * 2,
    })
  }
  return {
    id: anchor.id,
    direction,
    growthDirection,
    roll: exp03Hash01(seed, anchor.id, 5) * Math.PI * 2,
    scale,
    crystal: {
      id: anchor.id,
      length,
      maxLength,
      radius,
      growthDirection,
      direction: growthDirection,
      branches,
      roll: exp03Hash01(seed, anchor.id, 9) * Math.PI,
    },
  }
}

/**
 * Fully developed Life-shaped site records for the static visual planner.
 */
export function buildStaticMatureSites(
  seed = 1,
  anchors = EXP03_STATIC_CLUSTER_ANCHORS,
) {
  return anchors.map((anchor) => buildMatureSite(seed, anchor))
}

/** Step 2 — one mature site for the single bio-crystalline prototype. */
export function buildSingleMatureSite(
  seed = 1,
  anchor = EXP03_SINGLE_CLUSTER_ANCHOR,
) {
  return buildMatureSite(seed, anchor)
}
