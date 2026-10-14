import { lifeHash } from './life/lifeEngine.js'

const DISSOLVE_AGE_START = 0.82
const DISSOLVE_AGE_END = 0.98
const DISSOLVE_SELECT_THRESHOLD = 0.58
const PARTICLES_PER_CRYSTAL = 18

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function smootherstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / Math.max(1e-8, edge1 - edge0))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** Stable integer id for a baked crystal root (rest-space origin). */
export function bakedCrystalId(x, y, z) {
  const qx = Math.round(x * 1000)
  const qy = Math.round(y * 1000)
  const qz = Math.round(z * 1000)
  return (
    (Math.imul(qx, 73856093) ^
      Math.imul(qy, 19349663) ^
      Math.imul(qz, 83492791) ^
      0x51c3a700) >>>
    0
  )
}

/** Late-life dissolution field from AGE / decay only (no wall-clock time). */
export function dissolutionField(age, decay = 0) {
  const byAge = smootherstep(DISSOLVE_AGE_START, DISSOLVE_AGE_END, age)
  const byDecay =
    smootherstep(0.08, 0.7, decay) * smootherstep(0.78, 0.92, age)
  return clamp01(Math.max(byAge, byDecay))
}

/** Deterministic: which crystals particleize vs remain as mineral traces. */
export function crystalDissolves(seed, crystalId) {
  return lifeHash(seed, crystalId | 0, 401) < DISSOLVE_SELECT_THRESHOLD
}

/**
 * 0 = intact, 1 = fully particleized.
 * Staggered per crystal so disappearance reads as a quiet cascade.
 */
export function crystalDissolveProgress(seed, crystalId, age, decay) {
  if (!crystalDissolves(seed, crystalId)) return 0
  const field = dissolutionField(age, decay)
  if (field <= 0) return 0
  const delay = lifeHash(seed, crystalId | 0, 403) * 0.38
  return smootherstep(delay, Math.min(1, delay + 0.62), field)
}

export function crystalDissolveOpacity(progress) {
  return 1 - smootherstep(0.12, 0.72, progress)
}

export function crystalDissolveScale(progress) {
  return 1 - progress * 0.55
}

/**
 * Particleize dissolving crystals in place, then drift / settle as dust.
 * Pure function of seed + AGE/decay + emitter pose → scrub / replay safe.
 */
export function buildDissolveParticles(seed, age, decay, emitters) {
  const field = dissolutionField(age, decay)
  if (field <= 0 || !emitters?.length) {
    return {
      positions: new Float32Array(0),
      colors: new Float32Array(0),
      count: 0,
    }
  }

  const maxCount = emitters.length * PARTICLES_PER_CRYSTAL
  const positions = new Float32Array(maxCount * 3)
  const colors = new Float32Array(maxCount * 3)
  let count = 0

  for (const emitter of emitters) {
    const progress = emitter.progress
    if (progress <= 0.001) continue

    const root = emitter.root
    const axis = emitter.axis
    const length = Math.max(0.05, emitter.length)
    const width = Math.max(0.025, emitter.width ?? length * 0.28)

    const refY = Math.abs(axis[1]) > 0.86
    const rx = refY ? 1 : 0
    const ry = refY ? 0 : 1
    const rz = 0
    let tx = ry * axis[2] - rz * axis[1]
    let ty = rz * axis[0] - rx * axis[2]
    let tz = rx * axis[1] - ry * axis[0]
    const tLen = Math.hypot(tx, ty, tz) || 1
    tx /= tLen
    ty /= tLen
    tz /= tLen
    const bx = axis[1] * tz - axis[2] * ty
    const by = axis[2] * tx - axis[0] * tz
    const bz = axis[0] * ty - axis[1] * tx

    for (let index = 0; index < PARTICLES_PER_CRYSTAL; index += 1) {
      const along = 0.05 + lifeHash(seed, emitter.id, 410 + index) * 0.92
      const radial =
        (lifeHash(seed, emitter.id, 415 + index) - 0.5) * width * 1.05
      const side = (lifeHash(seed, emitter.id, 418 + index) - 0.5) * width * 0.85
      const born = lifeHash(seed, emitter.id, 420 + index) * 0.3
      const span = Math.max(0.3, 1 - born)
      const local = clamp01((progress - born) / span)
      if (local <= 0) continue

      const release = smootherstep(0.04, 0.8, local)
      const outward =
        (0.08 + lifeHash(seed, emitter.id, 450 + index) * 0.22) * release
      const drift =
        (lifeHash(seed, emitter.id, 430 + index) - 0.5) * 0.11 * release
      const swirl =
        (lifeHash(seed, emitter.id, 440 + index) - 0.5) * 0.09 * release
      const wobble =
        Math.sin(local * Math.PI * 1.7 + born * 5.1) * 0.02 * release

      const cling = 1 - release * 0.4
      const ox =
        root[0] +
        axis[0] * along * length +
        tx * radial * cling +
        bx * side * cling
      const oy =
        root[1] +
        axis[1] * along * length +
        ty * radial * cling +
        by * side * cling
      const oz =
        root[2] +
        axis[2] * along * length +
        tz * radial * cling +
        bz * side * cling

      const write = count * 3
      positions[write] =
        ox + axis[0] * outward + tx * (drift + wobble) + bx * swirl
      positions[write + 1] =
        oy + axis[1] * outward + ty * (drift + wobble) + by * swirl
      positions[write + 2] =
        oz + axis[2] * outward + tz * (drift + wobble) + bz * swirl

      // Bright mid-break bloom, then soft settled dust that remains at death.
      const warm = lifeHash(seed, emitter.id, 460 + index)
      const bloom = Math.sin(local * Math.PI) * 0.95
      const settle = smootherstep(0.35, 1, local) * 0.5
      const presence = Math.max(bloom, settle)
      colors[write] = (0.9 + warm * 0.1) * presence
      colors[write + 1] = (0.94 + warm * 0.05) * presence
      colors[write + 2] = (0.84 + (1 - warm) * 0.14) * presence
      count += 1
    }
  }

  return {
    positions: new Float32Array(positions.buffer, 0, count * 3),
    colors: new Float32Array(colors.buffer, 0, count * 3),
    count,
  }
}
