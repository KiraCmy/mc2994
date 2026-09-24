import { opIntersect, opShell, opSubtract, opUnion, smin } from './csg.js'
import { sdBox, sdCylinder, sdSphere } from './primitives.js'
import { getVoxelShape } from './shapes.js'

/**
 * Sequential CSG stack data model (Stage 4).
 *
 * Example:
 * [
 *   { op: 'base', shape: 'ground' },
 *   { op: 'subtract', brush: 'sphere', center: [0, 0.2, 0], radius: 0.35 },
 *   { op: 'union', brush: 'box', center: [0.4, 0, 0], half: [0.15, 0.2, 0.15] },
 * ]
 *
 * Evaluation is in SDF space (negative = inside). Callers that store density
 * should convert once: density = -sdf (see evaluateStackAsDensity).
 *
 * Supported ops: base | union | subtract | intersect | shell | smoothUnion
 * Supported brushes: sphere | box | cylinder
 * Base `shape` ids come from VOXEL_SHAPES (ground, volume, ridged, island, planet).
 */

/** @typedef {{ x: number, y: number, z: number }} Vec3 */

/**
 * @typedef {{
 *   op: 'base',
 *   shape?: string,
 *   brush?: string,
 *   center?: [number, number, number],
 *   radius?: number,
 *   half?: [number, number, number],
 *   halfHeight?: number,
 * }} CsgBaseOp
 *
 * @typedef {{
 *   op: 'union' | 'subtract' | 'intersect' | 'smoothUnion',
 *   brush: 'sphere' | 'box' | 'cylinder',
 *   center?: [number, number, number],
 *   radius?: number,
 *   half?: [number, number, number],
 *   halfHeight?: number,
 *   k?: number,
 * }} CsgCombineOp
 *
 * @typedef {{ op: 'shell', thickness?: number }} CsgShellOp
 *
 * @typedef {CsgBaseOp | CsgCombineOp | CsgShellOp} CsgOp
 */

/** Evaluate a brush primitive as SDF at p. */
export function evalBrushSdf(p, op) {
  const center = op.center ?? [0, 0, 0]
  const brush = op.brush ?? 'sphere'

  if (brush === 'box') {
    const half = op.half ?? [0.2, 0.2, 0.2]
    return sdBox(p, center, half)
  }
  if (brush === 'cylinder') {
    return sdCylinder(p, center, op.radius ?? 0.25, op.halfHeight ?? 0.4)
  }
  return sdSphere(p, center, op.radius ?? 0.35)
}

/**
 * Base field as SDF.
 * Noise shapes in this project are authored as density (>0 solid), so flip sign.
 * Analytic brushes on a base op are already SDF.
 */
export function evalBaseSdf(p, op, shapeCtx = {}) {
  if (op.brush) {
    return evalBrushSdf(p, op)
  }
  const shape = getVoxelShape(op.shape ?? 'ground')
  const density = shape.fn(p, shapeCtx)
  return -density
}

/**
 * Fold the stack at a single point → SDF.
 * @param {CsgOp[]} stack
 * @param {Vec3} p
 * @param {object} [shapeCtx] — passed to VOXEL_SHAPES base fields
 */
export function evaluateStackSdf(stack, p, shapeCtx = {}) {
  if (!stack?.length) return 1 // empty → outside

  let d = 1
  let started = false

  for (const op of stack) {
    if (op.op === 'base') {
      d = evalBaseSdf(p, op, shapeCtx)
      started = true
      continue
    }

    if (!started) {
      // Allow a stack that starts with a brush as an implicit base.
      d = evalBrushSdf(p, op)
      started = true
      if (op.op === 'union' || op.op === 'subtract' || op.op === 'intersect' || op.op === 'smoothUnion') {
        // First combine without a prior base: treat brush alone as the solid.
        continue
      }
    }

    if (op.op === 'shell') {
      d = opShell(d, op.thickness ?? 0.08)
      continue
    }

    const brush = evalBrushSdf(p, op)

    switch (op.op) {
      case 'union':
        d = opUnion(d, brush)
        break
      case 'subtract':
        d = opSubtract(d, brush)
        break
      case 'intersect':
        d = opIntersect(d, brush)
        break
      case 'smoothUnion':
        d = smin(d, brush, op.k ?? 0.4)
        break
      default:
        break
    }
  }

  return d
}

/** Same stack, stored as density (>0 solid) for the existing voxel grid. */
export function evaluateStackAsDensity(stack, p, shapeCtx = {}) {
  return -evaluateStackSdf(stack, p, shapeCtx)
}

/** Preset stacks for Stage 4 UI (before a full editor).
 * Sized for the blocky InstancedMesh view (cell ~0.2): cavities must span multiple voxels.
 */
export const CSG_PRESETS = {
  none: [],
  // Side bite — cavity faces the default camera so you can see into the hollow without flipping under.
  sphereBite: [
    { op: 'base', brush: 'box', center: [0, 0, 0], half: [0.75, 0.5, 0.75] },
    { op: 'subtract', brush: 'sphere', center: [0.55, 0.1, 0.55], radius: 0.55 },
  ],
  twoBlobUnion: [
    { op: 'base', brush: 'sphere', center: [-0.4, 0, 0], radius: 0.55 },
    { op: 'union', brush: 'sphere', center: [0.4, 0, 0], radius: 0.55 },
  ],
  // Same two spheres as hard union, but soft join via smin(k).
  smoothUnion: [
    { op: 'base', brush: 'sphere', center: [-0.4, 0, 0], radius: 0.55 },
    { op: 'smoothUnion', brush: 'sphere', center: [0.4, 0, 0], radius: 0.55, k: 0.4 },
  ],
  shellBox: [
    { op: 'base', brush: 'box', center: [0, 0, 0], half: [0.7, 0.5, 0.7] },
    // Thickness ≥ ~1 voxel so the hollow interior reads in blocky mode
    { op: 'shell', thickness: 0.22 },
  ],
}

/** UI chips for Stage 4 — before a full stack editor. */
export const CSG_PRESET_OPTIONS = [
  { id: 'none', label: 'NONE' },
  { id: 'sphereBite', label: 'SPHERE BITE' },
  { id: 'twoBlobUnion', label: 'TWO BLOB UNION' },
  { id: 'smoothUnion', label: 'SMOOTH UNION' },
  { id: 'shellBox', label: 'SHELL BOX' },
]

/** Inject live slider values into stack ops (keeps preset templates immutable). */
export function applyCsgParams(stack, { smoothK = 0.4 } = {}) {
  if (!stack?.length) return stack
  return stack.map((op) =>
    op.op === 'smoothUnion' ? { ...op, k: smoothK } : op,
  )
}
