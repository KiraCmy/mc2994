/**
 * World Final — where the organism sits and how the water moves it (M3A).
 * Pure functions: no React, no GPU.
 *
 * The anchor is fixed in the basin (ahead of the Explore view, over the
 * valley floor) and clears the highest seabed point under the organism's
 * footprint. Floating motion is the shared current's eddy displacement at
 * the anchor, scaled down and softly bounded: the mean drift is left out,
 * so the organism sways with the water but never drifts away.
 */
import { BODY_RADIUS } from '../../playground/finalForm/populationSim.js'
import { normalizeWorldFinalConfig } from '../config.js'
import { sampleCurrentDisplacement, sampleCurrentVelocity } from '../currentField.js'
import { heightAt } from '../heightField.js'

/** Population's flagship body (o0): World morphology, lobe 1, no sculpting. */
export const ORGANISM_SEED = 884731
/** Mature, crystals nucleated and growing. */
export const ORGANISM_DEFAULT_AGE = 0.55

/** Membrane lobes and petals stand off the nominal body radius. */
const EXTENT = 1.35
/** Anchor offset from the Explore camera, along / across its view. */
const AHEAD = 75
const SIDE = 7
/** Centre sits this many body radii below the Explore view ray. */
const BELOW_VIEW_RAY = 0.35
/** At most this many body radii of extra lift above the resting clearance. */
const MAX_LIFT = 1
const FOOTPRINT_SAMPLES = 32

/** Maximum eddy sway at float strength 1 (world units). */
export const FLOAT_LIMIT = 1.5
const FLOAT_GAIN = 0.16
const BOB = 0.35
const TILT_GAIN = 0.35
const TILT_LIMIT = 0.1

/** Bounding radius of the organism at full size (world units). */
export function organismExtent(config) {
  return BODY_RADIUS * normalizeWorldFinalConfig(config).organismScale * EXTENT
}

/** Gap between the seabed and the organism's lower bound at rest. */
export function organismHover(config) {
  return Math.max(2.5, organismExtent(config) * 0.35)
}

/**
 * Anchor for the organism, derived from the Explore pose so it reads as a
 * midground subject from there. `explore` is { position, target }.
 */
export function organismAnchor(config, explore) {
  const cfg = normalizeWorldFinalConfig(config)
  let fx = explore.target.x - explore.position.x
  let fz = explore.target.z - explore.position.z
  const len = Math.hypot(fx, fz) || 1
  fx /= len
  fz /= len
  const x = explore.position.x + fx * AHEAD - fz * SIDE
  const z = explore.position.z + fz * AHEAD + fx * SIDE

  const radius = organismExtent(cfg)
  let ground = heightAt(x, z, cfg)
  for (const ring of [0.5, 1]) {
    for (let i = 0; i < FOOTPRINT_SAMPLES; i += 1) {
      const t = (i / FOOTPRINT_SAMPLES) * Math.PI * 2
      const r = radius * ring
      ground = Math.max(ground, heightAt(x + Math.cos(t) * r, z + Math.sin(t) * r, cfg))
    }
  }
  const hover = organismHover(cfg)
  /* Float up toward the Explore eye line (never lower than the clearance)
     so the organism reads against the water, not buried in the foreground. */
  const toTarget = Math.hypot(
    explore.target.x - explore.position.x,
    explore.target.z - explore.position.z,
  ) || 1
  const rayY =
    explore.position.y + ((explore.target.y - explore.position.y) / toTarget) * AHEAD
  const rest = ground + radius + hover
  const y = Math.min(rest + radius * MAX_LIFT, Math.max(rest, rayY - radius * BELOW_VIEW_RAY))
  return { x, y, z, radius, ground, hover }
}

const _d = [0, 0, 0]
const _v = [0, 0, 0]

/**
 * Floating offset + tilt at time t (seconds) for the anchored organism.
 * Sway follows the eddy displacement (slow: eddy periods are 30–100 s);
 * tilt leans gently with the local eddy velocity. strength 0 = still.
 */
export function organismFloat(field, state, anchor, t, strength, out) {
  const result = out ?? { offset: [0, 0, 0], tilt: [0, 0] }
  const s = Math.max(0, strength)
  sampleCurrentDisplacement(field, state, anchor.x, anchor.y, anchor.z, _d)
  let dx = _d[0] * FLOAT_GAIN
  let dy = _d[1] * FLOAT_GAIN
  let dz = _d[2] * FLOAT_GAIN
  const mag = Math.hypot(dx, dy, dz)
  if (mag > 1e-9) {
    const k = (FLOAT_LIMIT * Math.tanh(mag / FLOAT_LIMIT)) / mag
    dx *= k
    dy *= k
    dz *= k
  }
  const bob = BOB * (0.65 * Math.sin(t * 0.29 + 0.7) + 0.35 * Math.sin(t * 0.13 + 2.1))
  result.offset[0] = dx * s
  result.offset[1] = (dy + bob) * s
  result.offset[2] = dz * s

  sampleCurrentVelocity(field, state, anchor.x, anchor.y, anchor.z, _v)
  const ex = _v[0] - state.mean[0]
  const ez = _v[2] - state.mean[2]
  result.tilt[0] = clamp(ez * TILT_GAIN, TILT_LIMIT) * s
  result.tilt[1] = clamp(-ex * TILT_GAIN, TILT_LIMIT) * s
  return result
}

function clamp(v, limit) {
  return Math.max(-limit, Math.min(limit, v))
}
