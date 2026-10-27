/**
 * Exp05-only radial morphology types.
 * - World: seeded World radiusAt
 * - Segmented: Dickinsonia-inspired radial quilted oval (Exp05 study)
 * - Spiral: Exp04 spiral field + seed orientation
 * Explore-framed via ORGANISM_BIRTH_RADIUS. Life Engine / World V2 / Exp04 sources untouched.
 */
import * as THREE from 'three'
import { createWorldGeometry, disposeWorldGeometry } from '../../worldv2/worldGeometry.js'
import { ORGANISM_BIRTH_RADIUS } from '../../worldv2/life/worldLifeAdapter.js'
import { createMorphologyRadiusAt } from '../morphologyLab/morphologyPresets.js'

export const EXP05_MORPHOLOGY_TYPES = {
  WORLD: 'world',
  SEGMENTED: 'segmented',
  SPIRAL: 'spiral',
}

export const EXP05_MORPHOLOGY_TYPE_OPTIONS = [
  { id: EXP05_MORPHOLOGY_TYPES.WORLD, label: 'Original World' },
  { id: EXP05_MORPHOLOGY_TYPES.SEGMENTED, label: 'Segmented' },
  { id: EXP05_MORPHOLOGY_TYPES.SPIRAL, label: 'Spiral' },
]

export const EXP05_DEFAULT_MORPHOLOGY_TYPE = EXP05_MORPHOLOGY_TYPES.WORLD

const _rotated = new THREE.Vector3()

export function normalizeExp05MorphologyType(value) {
  const allowed = new Set(Object.values(EXP05_MORPHOLOGY_TYPES))
  return allowed.has(value) ? value : EXP05_DEFAULT_MORPHOLOGY_TYPE
}

function normalizeSeed(seed) {
  const n = Number(seed)
  if (!Number.isFinite(n)) return 1
  return Math.abs(Math.floor(n)) % 2147483647 || 1
}

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function toUnitComponents(direction) {
  const x0 = direction.x ?? direction[0] ?? 0
  const y0 = direction.y ?? direction[1] ?? 0
  const z0 = direction.z ?? direction[2] ?? 0
  const len = Math.hypot(x0, y0, z0) || 1
  return { x: x0 / len, y: y0 / len, z: z0 / len }
}

/** Stable yaw/pitch from seed so Spiral still varies across seeds. */
function seedAngles(seed) {
  const s = normalizeSeed(seed)
  const yaw = ((Math.imul(s ^ 0x9e3779b9, 2654435761) >>> 0) / 4294967296) * Math.PI * 2
  const pitch =
    (((Math.imul(s ^ 0x85ebca6b, 1597334677) >>> 0) / 4294967296) - 0.5) * 0.85
  return { yaw, pitch }
}

function rotateDirection(direction, yaw, pitch, target = _rotated) {
  const { x: x0, y: y0, z: z0 } = toUnitComponents(direction)
  let x = x0
  let y = y0
  let z = z0

  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const x1 = x * cy + z * sy
  const z1 = -x * sy + z * cy
  x = x1
  z = z1

  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const y2 = y * cp - z * sp
  const z2 = y * sp + z * cp

  return target.set(x, y2, z2)
}

/** Body-frame rotation: yaw → pitch → roll (radians). */
function rotateBodyFrame(direction, yaw, pitch, roll) {
  const { x: x0, y: y0, z: z0 } = toUnitComponents(direction)
  let x = x0
  let y = y0
  let z = z0

  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  let x1 = x * cy + z * sy
  let z1 = -x * sy + z * cy
  x = x1
  z = z1

  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  let y2 = y * cp - z * sp
  let z2 = y * sp + z * cp
  y = y2
  z = z2

  const cr = Math.cos(roll)
  const sr = Math.sin(roll)
  const x3 = x * cr - y * sr
  const y3 = x * sr + y * cr
  return { x: x3, y: y3, z }
}

/** Ellipsoid rest radius for a unit direction. */
function ellipsoidRadius(dx, dy, dz, rx, ry, rz) {
  const sx = dx / Math.max(1e-6, rx)
  const sy = dy / Math.max(1e-6, ry)
  const sz = dz / Math.max(1e-6, rz)
  const denom = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1
  return 1 / denom
}

function wrapExploreRadius(rawRadiusAt) {
  return (direction) => {
    const raw = rawRadiusAt(direction)
    if (!Number.isFinite(raw)) return raw
    return raw / ORGANISM_BIRTH_RADIUS
  }
}

function createWorldRawRadiusAt(seed) {
  const world = createWorldGeometry(normalizeSeed(seed))
  const radiusAt = world.radiusAt
  disposeWorldGeometry(world)
  return radiusAt
}

function createOrientedLabRadiusAt(morphologyId, seed) {
  const base = createMorphologyRadiusAt(morphologyId)
  const { yaw, pitch } = seedAngles(seed)
  return (direction) => {
    const rotated = rotateDirection(direction, yaw, pitch)
    return base(rotated)
  }
}

/**
 * Exp05 Segmented — Dickinsonia-inspired radial quilted oval.
 *
 * Flattened elongated ellipsoid + transverse ribs along a longitudinal axis.
 * Seed warps spacing / amplitude / curvature / bilateral balance without
 * erasing the serial pattern. Star-convex only (Option A morphology study).
 */
function createDickinsoniaQuiltRadiusAt(seed) {
  const random = mulberry32(normalizeSeed(seed) ^ 0xd1c4e501)

  /* Mild orientation — keep flatten near world Y so the oval reads clearly. */
  const yaw = (random() - 0.5) * 0.7
  const pitch = (random() - 0.5) * 0.2
  const roll = (random() - 0.5) * 0.16

  /* Body extents in organism rest units (Explore-wrapped later). */
  const length = lerp(2.42, 2.82, random())
  const width = lerp(1.38, 1.72, random())
  const thickness = lerp(0.48, 0.72, random())

  const ribCount = 10 + Math.floor(random() * 7) // 10–16 fine ribs
  const ribAmpRelief = lerp(0.085, 0.145, random())
  const ribAmpMargin = lerp(0.06, 0.12, random())
  const ribSharp = lerp(1.25, 1.95, random())

  const warpA = lerp(0.045, 0.11, random())
  const warpB = lerp(0.02, 0.065, random())
  const warpFreqA = lerp(1.1, 2.2, random())
  const warpFreqB = lerp(2.6, 4.4, random())
  const phase = random() * Math.PI * 2

  const ampWarp = lerp(0.18, 0.38, random())
  const ampPhase = random() * Math.PI * 2
  const sideBias = lerp(-0.09, 0.09, random())
  const curve = lerp(-0.14, 0.14, random())
  const tipTaper = lerp(0.1, 0.2, random())
  const midlineGroove = lerp(0.018, 0.042, random())
  const dorsalMix = lerp(0.4, 0.72, random())
  const endRound = lerp(0.08, 0.16, random())

  return (direction) => {
    const body = rotateBodyFrame(direction, yaw, pitch, roll)
    const along = body.z
    const across = body.x + curve * along * along
    const up = body.y

    const base = ellipsoidRadius(across, up, along, width, thickness, length)

    const sWarp =
      along +
      warpA * Math.sin(along * Math.PI * warpFreqA + phase) +
      warpB * Math.sin(along * Math.PI * warpFreqB + phase * 1.73)

    const ribAngle = sWarp * ribCount * Math.PI + phase * 0.35
    const raw = Math.cos(ribAngle)
    /* Sharper ridges, softer valleys — quilted relief without hard creases. */
    const quilt =
      Math.sign(raw || 1) *
      Math.pow(Math.abs(raw), 1 / Math.max(1.05, ribSharp))

    const lateral = Math.abs(across)
    const widthEnv = Math.max(
      0,
      1 - Math.pow(Math.min(1, lateral * 1.55), 2.35),
    )
    const tipEnv = Math.max(
      0,
      1 - Math.pow(Math.abs(along), 2.55) * (0.55 + tipTaper),
    )
    const ampMod = 1 + ampWarp * Math.sin(along * Math.PI * 1.2 + ampPhase)
    const side =
      1 +
      sideBias *
        Math.sign(across || 1) *
        Math.min(1, lateral * 2.8)

    const dorsal =
      (1 - dorsalMix) * 0.55 +
      dorsalMix * (0.42 + 0.58 * Math.max(0, up))

    const planeR = Math.hypot(across, along)
    const rimWeight = Math.min(1, planeR * 1.05)

    const rib =
      quilt *
      ampMod *
      side *
      tipEnv *
      (ribAmpRelief * dorsal * (0.35 + 0.65 * widthEnv) +
        ribAmpMargin * rimWeight * widthEnv)

    const groove =
      -midlineGroove *
      Math.exp(-across * across * 22) *
      tipEnv *
      (0.55 + 0.45 * Math.max(0, up))

    const micro =
      0.014 *
      Math.sin(across * 10.7 + along * 6.8 + phase) *
      Math.cos(along * 5.2 - across * 3.4 + phase * 0.6) *
      tipEnv

    const taper =
      1 -
      tipTaper * Math.pow(Math.abs(along), 2.8) * 0.42 -
      endRound * Math.pow(Math.abs(along), 4) * 0.2

    return Math.max(0.32, base * (1 + rib + groove + micro) * taper)
  }
}

/**
 * Explore-framed radiusAt for Exp05 morphology type.
 */
export function createExp05MorphologyRadiusAt(
  seed,
  morphologyType = EXP05_DEFAULT_MORPHOLOGY_TYPE,
) {
  const type = normalizeExp05MorphologyType(morphologyType)
  const normalized = normalizeSeed(seed)

  if (type === EXP05_MORPHOLOGY_TYPES.SEGMENTED) {
    return wrapExploreRadius(createDickinsoniaQuiltRadiusAt(normalized))
  }
  if (type === EXP05_MORPHOLOGY_TYPES.SPIRAL) {
    return wrapExploreRadius(
      createOrientedLabRadiusAt(EXP05_MORPHOLOGY_TYPES.SPIRAL, normalized),
    )
  }

  return wrapExploreRadius(createWorldRawRadiusAt(normalized))
}
