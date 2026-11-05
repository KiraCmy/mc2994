/**
 * World Final — pure seabed height field in three spatial scales.
 *
 *   Macro  (basinDepth · basinWidth · basinAsymmetry)
 *          Broad, off-centre, elongated bowl with a lobed rim of uneven
 *          height, a gentle tilt, and highlands rising past the rim.
 *   Meso   (ridgeHeight · ridgeSpacing)
 *          Smooth, elongated sediment ridges with rounded crests.
 *   Micro  (surfaceDetail)
 *          Fine irregularity, an order of magnitude below the meso scale.
 *
 * Everything is C1-smooth (no abs creases, no terraces) and deterministic.
 * Lifecycle zones use radiusNorm only; nothing here carves rings.
 */
import { normalizeWorldFinalConfig } from './config.js'
import { fbm2, valueNoise2 } from './noise.js'

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function smootherstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** Rounded crest: 1 on the zero line of n, falling smoothly either side. */
function softRidge(n, k) {
  return 1 - (Math.sqrt(n * n + k * k) - k)
}

/** Seed-stable angle in [0, 2π). */
function seedAngle(seed, channel) {
  return (valueNoise2(seed, 0.37, 0.61, channel) * 0.5 + 0.5) * Math.PI * 2
}

/**
 * Basin placement / shape derived from config (shared with camera presets).
 */
export function basinFrame(config) {
  const cfg = normalizeWorldFinalConfig(config)
  const R = cfg.basinRadius
  const a = cfg.basinAsymmetry
  const seed = cfg.seed

  const offsetAngle = seedAngle(seed, 101)
  const axisAngle = seedAngle(seed, 103)
  const tiltAngle = seedAngle(seed, 107)
  const offset = a * 0.16 * R

  return {
    cx: Math.cos(offsetAngle) * offset,
    cz: Math.sin(offsetAngle) * offset,
    axisCos: Math.cos(axisAngle),
    axisSin: Math.sin(axisAngle),
    /** Ellipse axis ratio (1 = round). */
    stretch: 1 + a * 0.5,
    tiltX: Math.cos(tiltAngle) * a * 0.24,
    tiltZ: Math.sin(tiltAngle) * a * 0.24,
    rimRadius: cfg.basinWidth * R,
    ridgeCos: Math.cos(seedAngle(seed, 109)),
    ridgeSin: Math.sin(seedAngle(seed, 109)),
  }
}

function createSampler(cfg) {
  const frame = basinFrame(cfg)
  const seed = cfg.seed
  const R = cfg.basinRadius
  const depth = cfg.basinDepth
  const a = cfg.basinAsymmetry
  const spacing = cfg.ridgeSpacing
  const ridgeH = cfg.ridgeHeight
  const detail = cfg.surfaceDetail
  const sqrtStretch = Math.sqrt(frame.stretch)
  const lobeAmt = 0.08 + a * 0.16
  const rimVarAmt = 0.12 + a * 0.26

  /** Macro basin height and normalized basin radius at (x, z). */
  function macro(x, z) {
    const dx = x - frame.cx
    const dz = z - frame.cz
    const u = dx * frame.axisCos + dz * frame.axisSin
    const v = -dx * frame.axisSin + dz * frame.axisCos
    const q = Math.hypot(u / sqrtStretch, v * sqrtStretch)

    /* Angular variation sampled on the unit circle → seamless, non-circular. */
    const inv = q > 1e-6 ? 1 / q : 0
    const cu = u * inv
    const cv = v * inv
    const lobe = 1 + lobeAmt * valueNoise2(seed, cu * 1.4, cv * 1.4, 131)
    const rimVar = 1 + rimVarAmt * valueNoise2(seed, cu * 2.1 + 5.3, cv * 2.1 - 1.7, 151)

    const rn = q / (frame.rimRadius * lobe)
    const bowl = smootherstep(0, 1, rn)
    const highland = 0.24 * smoothstep(0.95, 1.65, rn)
    const tilt = depth * (frame.tiltX * x + frame.tiltZ * z) / R
    /* Very low-frequency swell so the floor and highlands are not uniform. */
    const swell =
      depth * 0.09 * fbm2(seed, x / (R * 0.85), z / (R * 0.85), { octaves: 2, channel: 171 })

    return { h: depth * (bowl + highland) * rimVar + tilt + swell, rn }
  }

  function meso(x, z, rn) {
    if (ridgeH <= 1e-6) return 0
    /* Warp keeps ridge lines sinuous rather than straight or gridded. */
    const ws = spacing * 2.2
    const wx = x + valueNoise2(seed, x / ws, z / ws, 211) * spacing * 0.45
    const wz = z + valueNoise2(seed, x / ws + 7.1, z / ws - 3.3, 223) * spacing * 0.45
    /* Long axis along the ridge direction: 3.2 : 1 elongation. */
    const along = wx * frame.ridgeCos + wz * frame.ridgeSin
    const across = -wx * frame.ridgeSin + wz * frame.ridgeCos
    const n = fbm2(seed, along / (spacing * 3.2), across / spacing, {
      octaves: 2,
      gain: 0.42,
      channel: 241,
    })
    const crest = softRidge(n * 1.7, 0.32) - 0.55
    /* Softer in the nursery floor, fullest on the basin slopes. */
    const mask =
      (0.45 + 0.55 * smoothstep(0.06, 0.5, rn)) * (1 - 0.45 * smoothstep(1.05, 1.5, rn))
    return ridgeH * 1.5 * crest * mask
  }

  function micro(x, z) {
    if (detail <= 1e-6) return 0
    return detail * fbm2(seed, x / 15, z / 15, { octaves: 3, gain: 0.5, lacunarity: 2.1, channel: 263 })
  }

  return {
    frame,
    sample(x, z) {
      const px = Number(x) || 0
      const pz = Number(z) || 0
      const m = macro(px, pz)
      return m.h + meso(px, pz, m.rn) + micro(px, pz)
    },
    /** Per-scale contributions (diagnostics / tests). */
    layers(x, z) {
      const m = macro(x, z)
      return { macro: m.h, meso: meso(x, z, m.rn), micro: micro(x, z), rn: m.rn }
    },
  }
}

const samplerCache = new WeakMap()

function samplerFor(config) {
  if (config && typeof config === 'object') {
    let s = samplerCache.get(config)
    if (!s) {
      s = createSampler(normalizeWorldFinalConfig(config))
      samplerCache.set(config, s)
    }
    return s
  }
  return createSampler(normalizeWorldFinalConfig(config))
}

/**
 * @param {number} x
 * @param {number} z
 * @param {object} [config]
 */
export function radiusNorm(x, z, config) {
  const cfg = normalizeWorldFinalConfig(config)
  return Math.hypot(Number(x) || 0, Number(z) || 0) / Math.max(1e-6, cfg.basinRadius)
}

/**
 * Terrain height Y at world XZ. Deterministic for fixed config.
 * Config objects are treated as immutable (sampler is cached per object).
 */
export function heightAt(x, z, config) {
  return samplerFor(config).sample(x, z)
}

/** Macro / meso / micro contributions at (x, z). */
export function heightLayers(x, z, config) {
  return samplerFor(config).layers(Number(x) || 0, Number(z) || 0)
}

/**
 * Mean height on a ring of radius fraction `rFrac` around the basin centre.
 */
export function meanHeightOnRing(rFrac, config, samples = 24) {
  const s = samplerFor(config)
  const cfg = normalizeWorldFinalConfig(config)
  const radius = cfg.basinRadius * Math.max(0, rFrac)
  let sum = 0
  for (let i = 0; i < samples; i += 1) {
    const t = (i / samples) * Math.PI * 2
    sum += s.sample(s.frame.cx + Math.cos(t) * radius, s.frame.cz + Math.sin(t) * radius)
  }
  return sum / samples
}
