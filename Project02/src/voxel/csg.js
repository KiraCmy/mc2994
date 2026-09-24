/**
 * Hard CSG ops on SDF values (negative = inside).
 *
 * Mental unit test — two spheres:
 *   a = sdSphere(p, [-0.35, 0, 0], 0.55)
 *   b = sdSphere(p, [ 0.35, 0, 0], 0.55)
 *
 *   opUnion(a, b)     → peanut / merged blob (min)
 *   opSubtract(a, b)  → left sphere with a bite from the right (max(a, -b))
 *   opIntersect(a, b) → lens where both overlap (max)
 *
 * Density-world equivalents if you ever store >0 = solid:
 *   union → max, intersect → min, subtract b from a → min(a, -b)
 * Prefer keeping SDF here, then densityStored = -sdf at the grid write.
 */

/** Merge solids. */
export function opUnion(a, b) {
  return Math.min(a, b)
}

/** Keep only the overlap. */
export function opIntersect(a, b) {
  return Math.max(a, b)
}

/** Carve brush `b` out of solid `a`. */
export function opSubtract(a, b) {
  return Math.max(a, -b)
}

/** Hollow shell of thickness t around surface a=0. */
export function opShell(a, thickness) {
  return Math.abs(a) - thickness
}

/**
 * Smooth union (optional Stage 4 stretch).
 * Larger k → softer organic join.
 */
export function smin(a, b, k = 0.4) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

/** Flip SDF ↔ density while keeping the same zero surface. */
export function sdfToDensity(sdf) {
  return -sdf
}

export function densityToSdf(density) {
  return -density
}
