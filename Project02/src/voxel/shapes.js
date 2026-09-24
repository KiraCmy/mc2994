import { fbm2 } from '../noise/simplex2d.js'
import { fbm3 } from '../noise/simplex3d.js'

/**
 * Density shape primitives (Stage 3).
 * Convention: d > 0 solid, d < 0 air.
 *
 * @typedef {{
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
 * }} ShapeContext
 */

function noiseCtx(ctx = {}) {
  return {
    scale: ctx.scale ?? 1.2,
    octaves: ctx.octaves ?? 3,
    lac: ctx.lac ?? 2,
    gain: ctx.gain ?? 0.5,
    time: ctx.time ?? 0,
    heightAmp: ctx.heightAmp ?? 0.85,
    thresholdBias: ctx.thresholdBias ?? 0.15,
    islandY: ctx.islandY ?? 0.15,
    islandWidth: ctx.islandWidth ?? 0.55,
    planetRadius: ctx.planetRadius ?? 1.05,
  }
}

function sampleFbm2(p, c) {
  return fbm2(
    p.x * c.scale + c.time * 0.15,
    p.z * c.scale - c.time * 0.11,
    c.octaves,
    c.lac,
    c.gain,
  )
}

function sampleFbm3(p, c) {
  return fbm3(
    p.x * c.scale + c.time * 0.12,
    p.y * c.scale + c.time * 0.07,
    p.z * c.scale - c.time * 0.09,
    c.octaves,
    c.lac,
    c.gain,
  )
}

/** Heightfield: d = h(x,z) - y */
export function shapeGround(p, ctx = {}) {
  const c = noiseCtx(ctx)
  return sampleFbm2(p, c) * c.heightAmp - p.y
}

/** Volumetric fBm: d = fbm3(p) - thresholdBias */
export function shapeFbm3(p, ctx = {}) {
  const c = noiseCtx(ctx)
  return sampleFbm3(p, c) - c.thresholdBias
}

/** Ridged sheets/walls: d = 1 - |fbm3| − bias (bias keeps air from filling everything). */
export function shapeRidged(p, ctx = {}) {
  const c = noiseCtx(ctx)
  return 1 - Math.abs(sampleFbm3(p, c)) - (0.5 + c.thresholdBias)
}

/**
 * Floating islands: fBm minus vertical falloff around islandY.
 * falloff = |y - y0| / w  → solid near the band, empty outside.
 */
export function shapeFloatingIsland(p, ctx = {}) {
  const c = noiseCtx(ctx)
  const falloff = Math.abs(p.y - c.islandY) / Math.max(1e-4, c.islandWidth)
  return sampleFbm3(p, c) - falloff
}

/** Planet: radius + h(dir) - length(p) */
export function shapePlanet(p, ctx = {}) {
  const c = noiseCtx(ctx)
  const r = Math.hypot(p.x, p.y, p.z)
  if (r < 1e-6) return c.planetRadius
  const dir = { x: p.x / r, y: p.y / r, z: p.z / r }
  const h = sampleFbm2(dir, c) * c.heightAmp * 0.35
  return c.planetRadius + h - r
}

/** Registry for UI chips + density dispatcher. */
export const VOXEL_SHAPES = [
  { id: 'ground', label: 'GROUND', tag: '#ground', fn: shapeGround },
  { id: 'volume', label: 'FBM3', tag: '#fbm3', fn: shapeFbm3 },
  { id: 'ridged', label: 'RIDGED', tag: '#ridged', fn: shapeRidged },
  { id: 'island', label: 'ISLAND', tag: '#island', fn: shapeFloatingIsland },
  { id: 'planet', label: 'PLANET', tag: '#planet', fn: shapePlanet },
]

export function getVoxelShape(id) {
  return VOXEL_SHAPES.find((s) => s.id === id) ?? VOXEL_SHAPES[0]
}
