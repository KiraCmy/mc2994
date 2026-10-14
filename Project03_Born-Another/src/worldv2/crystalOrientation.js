/**
 * Surface-local crystal orientation helpers.
 * Exterior grows along +outwardNormal; interior along −outwardNormal (into cavity).
 */

export const CRYSTAL_MIN_OUTWARD_DOT = 0.72

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function normalize3(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

/**
 * Force `direction` to face the same hemisphere as `faceNormal`.
 * If the outward component is too weak, blend back toward the face normal
 * (deterministic, no random push).
 */
export function ensureFacingDirection(
  direction,
  faceNormal,
  minDot = CRYSTAL_MIN_OUTWARD_DOT,
) {
  const face = normalize3(faceNormal)
  let axis = normalize3(direction)
  let alignment = dot3(axis, face)
  if (alignment < 0) {
    axis = [-axis[0], -axis[1], -axis[2]]
    alignment = -alignment
  }
  if (alignment >= minDot) return axis
  const mix = clamp((minDot - alignment) / Math.max(1e-8, 1 - alignment), 0, 1)
  return normalize3([
    axis[0] + (face[0] - axis[0]) * mix,
    axis[1] + (face[1] - axis[1]) * mix,
    axis[2] + (face[2] - axis[2]) * mix,
  ])
}

/**
 * Paired exterior / interior axes from one Life Engine growth direction.
 * Exterior: into outer space. Interior: into the cavity.
 */
export function surfaceGrowthAxes(growthDirection, outwardNormal) {
  const outward = normalize3(outwardNormal)
  const exteriorAxis = ensureFacingDirection(growthDirection, outward)
  const interiorAxis = [-exteriorAxis[0], -exteriorAxis[1], -exteriorAxis[2]]
  return {
    outwardNormal: outward,
    inwardNormal: [-outward[0], -outward[1], -outward[2]],
    exteriorAxis,
    interiorAxis,
  }
}

/**
 * Root sits slightly under the membrane along the *facing normal*, not the
 * tilted growth axis. Visible length extends along the growth axis so the tip
 * clears the membrane as soon as length grows.
 */
export function crystalRootAndLength({
  surface,
  facingNormal,
  growthAxis,
  length,
  embed,
}) {
  const face = normalize3(facingNormal)
  const axis = normalize3(growthAxis)
  const seat = Math.min(Math.max(0, embed), Math.max(0.008, length * 0.45 + 0.01))
  const root = [
    surface[0] - face[0] * seat,
    surface[1] - face[1] * seat,
    surface[2] - face[2] * seat,
  ]
  const facing = Math.max(0, dot3(axis, face))
  const visualLength = Math.max(length, length + seat * facing)
  return { root, visualLength, seat, facing }
}

export function secondaryFacingDirection(
  branchDirection,
  parentAxis,
  faceNormal,
  minDot = 0.35,
) {
  // Prefer the parent's facing hemisphere, then keep a positive membrane component.
  const alongParent = ensureFacingDirection(branchDirection, parentAxis, 0.15)
  return ensureFacingDirection(alongParent, faceNormal, minDot)
}
