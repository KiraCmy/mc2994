import { evaluateStackAsDensity } from './csgStack.js'
import { getVoxelShape } from './shapes.js'

/**
 * Shared density entry point for fill + later meshing.
 * Convention: d > 0 solid, d < 0 air, d = 0 surface.
 *
 * If `csgStack` is non-empty, the stack is evaluated in SDF space then flipped
 * to density. Otherwise the active VOXEL_SHAPES mode is sampled directly.
 *
 * @typedef {{
 *   mode?: string,
 *   csgStack?: import('./csgStack.js').CsgOp[],
 *   scale?: number,
 *   octaves?: number,
 *   lac?: number,
 *   gain?: number,
 *   time?: number,
 *   heightAmp?: number,
 *   thresholdBias?: number,
 *   islandY?: number,
 *   islandWidth?: number,
 *   planetRadius?: number,
 *   sphereRadius?: number,
 *   sphereCenter?: [number, number, number],
 * }} DensitySettings
 */

/**
 * Evaluate density at a world-space point.
 * @param {{ x: number, y: number, z: number }} p
 * @param {DensitySettings} [settings]
 */
export function evaluateDensity(p, settings = {}) {
  const mode = settings.mode ?? 'ground'
  const stack = settings.csgStack

  if (stack?.length) {
    const effective = withBaseShape(stack, mode)
    return evaluateStackAsDensity(effective, p, settings)
  }

  // Stage 1 debug solid — not in VOXEL_SHAPES.
  if (mode === 'sphere') {
    return densitySphere(p, settings)
  }

  return getVoxelShape(mode).fn(p, settings)
}

/**
 * Ensure the stack starts with a base field from the current shape chip.
 * If the stack already has a `base` op, leave it alone (presets may use a box/sphere base).
 */
export function withBaseShape(stack, mode) {
  if (stack.some((op) => op.op === 'base')) return stack
  return [{ op: 'base', shape: mode }, ...stack]
}

/** Analytic sphere kept for Stage 1 parity / debugging. */
export function densitySphere(p, settings = {}) {
  const radius = settings.sphereRadius ?? 1.1
  const [cx, cy, cz] = settings.sphereCenter ?? [0, 0, 0]
  return radius - Math.hypot(p.x - cx, p.y - cy, p.z - cz)
}
