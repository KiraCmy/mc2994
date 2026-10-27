/**
 * Exp05-only optional sculptural deformation layer.
 *
 * Applied AFTER the existing radial morphology + Life/env radial deform path.
 * Low-frequency seed-driven tangential displacement for asymmetrical silhouette
 * tension — not high-frequency noise, not stacked lobes.
 *
 * Strength 0 → identity (current appearance preserved).
 */
import { lifeHash } from '../../worldv2/life/lifeEngine.js'

const _out = [0, 0, 0]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0))
}

function clamp01(value) {
  return clamp(value, 0, 1)
}

export function normalizeExp05SculpturalStrength(value) {
  if (!Number.isFinite(Number(value))) return 0
  return clamp(value, 0, 2)
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function lattice(seed, ix, iy, iz, channel) {
  const mixed =
    (Math.imul(ix | 0, 73856093) ^
      Math.imul(iy | 0, 19349663) ^
      Math.imul(iz | 0, 83492791) ^
      (channel | 0) ^
      (seed | 0)) >>>
    0
  return lifeHash(seed, mixed, 910 + (channel | 0)) * 2 - 1
}

function valueNoise3(seed, x, y, z, channel = 0) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const z0 = Math.floor(z)
  const fx = fade(x - x0)
  const fy = fade(y - y0)
  const fz = fade(z - z0)

  const n000 = lattice(seed, x0, y0, z0, channel)
  const n100 = lattice(seed, x0 + 1, y0, z0, channel)
  const n010 = lattice(seed, x0, y0 + 1, z0, channel)
  const n110 = lattice(seed, x0 + 1, y0 + 1, z0, channel)
  const n001 = lattice(seed, x0, y0, z0 + 1, channel)
  const n101 = lattice(seed, x0 + 1, y0, z0 + 1, channel)
  const n011 = lattice(seed, x0, y0 + 1, z0 + 1, channel)
  const n111 = lattice(seed, x0 + 1, y0 + 1, z0 + 1, channel)

  const x00 = lerp(n000, n100, fx)
  const x10 = lerp(n010, n110, fx)
  const x01 = lerp(n001, n101, fx)
  const x11 = lerp(n011, n111, fx)
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz)
}

function fbm3(seed, x, y, z, channel, octaves = 3) {
  let amp = 0.55
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i += 1) {
    sum +=
      amp *
      valueNoise3(seed, x * freq, y * freq, z * freq, channel + i * 17)
    norm += amp
    amp *= 0.5
    freq *= 2.03
  }
  return sum / Math.max(1e-8, norm)
}

function unitFrom(x, y, z) {
  const len = Math.hypot(x, y, z) || 1
  return [x / len, y / len, z / len]
}

function orthonormalFrame(nx, ny, nz) {
  const reference =
    Math.abs(ny) > 0.86 ? [1, 0, 0] : [0, 1, 0]
  let tx = reference[1] * nz - reference[2] * ny
  let ty = reference[2] * nx - reference[0] * nz
  let tz = reference[0] * ny - reference[1] * nx
  const tLen = Math.hypot(tx, ty, tz) || 1
  tx /= tLen
  ty /= tLen
  tz /= tLen
  const bx = ny * tz - nz * ty
  const by = nz * tx - nx * tz
  const bz = nx * ty - ny * tx
  const bLen = Math.hypot(bx, by, bz) || 1
  return {
    tangent: [tx, ty, tz],
    bitangent: [bx / bLen, by / bLen, bz / bLen],
  }
}

function seededUnit(seed, salt) {
  const u = lifeHash(seed, salt, 401)
  const v = lifeHash(seed, salt + 17, 402)
  const z = u * 2 - 1
  const a = v * Math.PI * 2
  const r = Math.sqrt(Math.max(0, 1 - z * z))
  return [r * Math.cos(a), r * Math.sin(a), z]
}

/**
 * Build a stable sculptural sampler for one Life seed.
 * @returns {{ sampleOffset: (x,y,z,strength) => [dx,dy,dz] }}
 */
export function createExp05SculpturalSampler(seed = 1) {
  const s = Math.abs(Math.floor(Number(seed) || 1)) % 2147483647 || 1
  const axisA = seededUnit(s, 11)
  const axisB = seededUnit(s, 29)
  const axisC = seededUnit(s, 47)
  const twistSense = lifeHash(s, 61, 411) > 0.5 ? 1 : -1
  const foldBias = lerp(0.55, 1.15, lifeHash(s, 73, 412))
  const extendBias = lerp(0.65, 1.25, lifeHash(s, 89, 413))
  const freq = lerp(0.55, 0.95, lifeHash(s, 97, 414))

  /**
   * @returns {[number, number, number]}
   */
  function sampleOffset(x, y, z, strength = 0) {
    const amount = normalizeExp05SculpturalStrength(strength)
    if (amount <= 1e-6) {
      _out[0] = 0
      _out[1] = 0
      _out[2] = 0
      return _out
    }

    const radius = Math.hypot(x, y, z) || 1
    const [nx, ny, nz] = unitFrom(x, y, z)
    const { tangent, bitangent } = orthonormalFrame(nx, ny, nz)

    const px = nx * freq
    const py = ny * freq
    const pz = nz * freq

    /* Large-scale asymmetric fields (2–3 octaves, low frequency). */
    const foldField = fbm3(s, px * 1.1, py * 1.1, pz * 1.1, 0, 3)
    const extendField = fbm3(s ^ 0x9e37, px * 0.85 + 1.4, py * 0.85, pz * 0.85 - 0.7, 1, 2)
    const shearField = fbm3(s ^ 0x85eb, px * 1.35 - 0.6, py * 1.35 + 0.9, pz * 1.35, 2, 2)

    const dA = nx * axisA[0] + ny * axisA[1] + nz * axisA[2]
    const dB = nx * axisB[0] + ny * axisB[1] + nz * axisB[2]
    const dC = nx * axisC[0] + ny * axisC[1] + nz * axisC[2]

    /* Directional extension — push along tangent toward seeded lobes. */
    const extend =
      extendBias *
      (extendField * 0.55 + dA * Math.abs(dA) * 0.45) *
      (0.55 + 0.45 * clamp01(dA * 0.5 + 0.5))

    /* Asymmetric folds / compression bands. */
    const fold =
      foldBias *
      (foldField * 0.7 + Math.sin(dB * Math.PI * 1.4) * 0.3) *
      (0.4 + 0.6 * clamp01(1 - Math.abs(dA)))

    /* Subtle twist around primary axis (tangential swirl). */
    const twist =
      twistSense *
      (dC * 0.35 + shearField * 0.65) *
      (0.35 + 0.65 * clamp01(Math.abs(dA)))

    /* Localized compression — small inward radial only (keeps continuity). */
    const compress =
      -0.22 *
      clamp01(0.55 - foldField) *
      clamp01(1 - Math.abs(dB)) *
      amount

    const tAmt = (extend * 0.55 + fold * 0.35 + twist * 0.25) * amount
    const bAmt = (fold * 0.55 - extend * 0.2 + twist * 0.4) * amount

    /* Soft magnitude cap vs local radius — avoid self-intersection. */
    const maxDisp = radius * (0.18 + 0.28 * amount)
    let dx =
      tangent[0] * tAmt * maxDisp +
      bitangent[0] * bAmt * maxDisp +
      nx * compress * radius * 0.12
    let dy =
      tangent[1] * tAmt * maxDisp +
      bitangent[1] * bAmt * maxDisp +
      ny * compress * radius * 0.12
    let dz =
      tangent[2] * tAmt * maxDisp +
      bitangent[2] * bAmt * maxDisp +
      nz * compress * radius * 0.12

    const mag = Math.hypot(dx, dy, dz)
    const cap = radius * (0.32 + 0.22 * amount)
    if (mag > cap && mag > 1e-8) {
      const scale = cap / mag
      dx *= scale
      dy *= scale
      dz *= scale
    }

    _out[0] = dx
    _out[1] = dy
    _out[2] = dz
    return _out
  }

  return { sampleOffset }
}

/**
 * Apply sculptural offset in place / return new point.
 * @returns {[number, number, number]}
 */
export function applyExp05SculpturalOffset(
  x,
  y,
  z,
  sampler,
  strength = 0,
) {
  if (!sampler || normalizeExp05SculpturalStrength(strength) <= 1e-6) {
    return [x, y, z]
  }
  const offset = sampler.sampleOffset(x, y, z, strength)
  return [x + offset[0], y + offset[1], z + offset[2]]
}
