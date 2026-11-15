/**
 * Exp07 Final Habitat — pure ground field + placement helpers (no three.js).
 *
 * World-scale like World Final (basin radius 400): a radius-340 field read in
 * three depths from the organism's clearing at the origin —
 *   near (0–8)     soft satin dunes, the clearing the body rests in
 *   mid  (8–60)    rolling dune fields and crests under translucent veils
 *   far  (60–340)  rounded ridges and the rising basin rim, silhouettes in fog
 * Reuses the World Final value-noise / fBm (C1-smooth, deterministic).
 */
import { fbm2 } from '../../worldFinal/noise.js'

export const HABITAT_SEED = 4127
/** Ground radius (world units). */
export const HABITAT_RADIUS = 340
/** Veil sheets cover the near + mid field. */
export const HABITAT_VEIL_RADIUS = 150

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Rounded crest: 1 on the zero line of n, falling smoothly either side. */
function softRidge(n, k) {
  return 1 - (Math.sqrt(n * n + k * k) - k)
}

/**
 * Large-scale ground (no small dune ripples). Veils drape relative to this so
 * they bridge troughs and lie on crests.
 */
export function habitatHeightBase(x, z, seed = HABITAT_SEED) {
  const r = Math.hypot(x, z)
  const open = smoothstep(1.7, 4.8, r)

  /* near */
  const mounds = fbm2(seed, x * 0.21, z * 0.21, { octaves: 4 }) * 0.6
  const back = smoothstep(3.5, 16, -z) * 2.6
  const sides = smoothstep(5, 17, Math.abs(x)) * 1.9
  const ridgeNoise = fbm2(seed + 13, x * 0.085, z * 0.085, { octaves: 3 })
  const ridges = Math.max(0, ridgeNoise + 0.15) * 3.4 * smoothstep(6, 20, r)
  const foreground =
    smoothstep(2.2, 6.5, z) * 0.42 * (0.55 + 0.45 * fbm2(seed + 3, x * 0.48, z * 0.48))
  const clearingFloor = 0.05 * fbm2(seed + 21, x * 0.7, z * 0.7)

  /* mid: rolling dune fields */
  const mid = fbm2(seed + 71, x * 0.035, z * 0.035, { octaves: 4 }) * 3.2 * smoothstep(8, 40, r)
  const midWarp = fbm2(seed + 73, x * 0.02, z * 0.02, { octaves: 2 }) * 3
  const midDunes = (Math.sin(x * 0.09 + z * 0.05 + midWarp) * 0.5 + 0.5) ** 2 * 2.2 * smoothstep(10, 50, r)

  /* far: rounded ridges and the basin rim */
  const farRidges =
    softRidge(fbm2(seed + 81, x * 0.008, z * 0.008, { octaves: 4 }), 0.12) * 26 * smoothstep(50, 220, r)
  const rim = 38 * smoothstep(120, HABITAT_RADIUS, r) ** 1.6

  return (
    (mounds + ridges) * open +
    back +
    sides +
    foreground +
    clearingFloor +
    mid +
    midDunes +
    farRidges +
    rim -
    0.12
  )
}

/** Small-scale satin ripples on top of the base field. */
function habitatHeightFine(x, z, seed = HABITAT_SEED) {
  const r = Math.hypot(x, z)
  const open = smoothstep(1.7, 4.8, r)
  const lumps = fbm2(seed + 7, x * 0.9, z * 0.9, { octaves: 3 }) * 0.035
  const grain = fbm2(seed + 9, x * 3.1, z * 3.1, { octaves: 2 }) * 0.006
  /* Wind-combed dune swells: long, soft crests that catch the light. */
  const warp = fbm2(seed + 51, x * 0.12, z * 0.12, { octaves: 2 }) * 2.4
  const dunes = (Math.sin(x * 0.55 + z * 0.32 + warp) * 0.5 + 0.5) ** 2 * 0.28
  const fade = 1 - smoothstep(30, 90, r)
  return (dunes * open + lumps * (0.35 + 0.65 * open)) * fade + grain
}

/** Ground height at (x, z). Camera looks toward −z; the clearing sits at 0,0. */
/**
 * The underworld: one hole in the sand opening onto a cavern under the dunes
 * (floor and ceiling are two more height fields; see caves.js). The hole is
 * cut out of the ground mesh; inside it the "ground" is the cavern floor.
 */
export const UNDERWORLD = Object.freeze({
  hole: Object.freeze({ x: -46, z: 26, r: 5.5, rim: 15 }),
  centre: Object.freeze({ x: -57, z: 35 }),
  radius: 34,
  depth: 13,
})

const levels = new Map()
function underworldLevels(seed) {
  if (!levels.has(seed)) {
    const { hole, depth } = UNDERWORLD
    const rim = habitatHeightBase(hole.x, hole.z, seed)
    levels.set(seed, { rim, floor: rim - depth })
  }
  return levels.get(seed)
}

/** Distance from the hole's centre. */
export function holeDistance(x, z) {
  return Math.hypot(x - UNDERWORLD.hole.x, z - UNDERWORLD.hole.z)
}

/**
 * The opening's outline by angle: `inner` is the throat (where the wall has
 * dropped through to the cavern), `lip` where the sand rolls over into it.
 */
export function holeShape(angle) {
  const r = UNDERWORLD.hole.r
  const n = 0.55 * Math.sin(3 * angle + 1.3) + 0.3 * Math.sin(5 * angle + 0.4) + 0.15 * Math.sin(8 * angle + 2.1)
  const m = 0.5 * Math.sin(2 * angle + 0.7) + 0.5 * Math.sin(7 * angle + 2.9)
  const inner = r * (1 + 0.15 * n)
  return { inner, lip: inner + 2.3 + 0.7 * m }
}

/** Ground mesh is cut inside `cut`; the throat mesh reaches out to `outer`. */
export const THROAT = Object.freeze({ cut: UNDERWORLD.hole.r + 4.2, outer: UNDERWORLD.hole.r + 6 })

export function inHole(x, z) {
  return holeDistance(x, z) < UNDERWORLD.hole.r
}

/** Cavern floor height (gentle drifts of sand). */
export function underworldFloor(x, z, seed = HABITAT_SEED) {
  return underworldLevels(seed).floor + fbm2(seed + 301, x * 0.07, z * 0.07, { octaves: 3 }) * 1.1
}

/**
 * The sand surface, without the hole: dunes, easing to a level rim that
 * slumps gently toward the opening.
 */
export function habitatSurfaceHeight(x, z, seed = HABITAT_SEED) {
  const fine = habitatHeightFine(x, z, seed)
  let h = habitatHeightBase(x, z, seed) + fine
  const { hole } = UNDERWORLD
  const d = holeDistance(x, z)
  if (d < hole.rim + 4) {
    const { rim } = underworldLevels(seed)
    const k = 1 - smoothstep(hole.rim * 0.55, hole.rim + 4, d)
    h += (rim + fine * 0.4 - h) * k
    /* The sand funnels toward the opening, drawn in along spiral grooves. */
    const g = 1 - smoothstep(hole.r, hole.rim + 2, d)
    h -= 3.2 * g * g
    const a = Math.atan2(z - hole.z, x - hole.x)
    const crest = Math.pow(0.5 + 0.5 * Math.sin(a * 7 - Math.log(Math.max(d, 1)) * 7.5), 2.5)
    h += 0.3 * (crest - 0.3) * smoothstep(hole.r + 1, hole.r + 5, d) * (1 - smoothstep(hole.rim - 3, hole.rim + 5, d))
  }
  return h
}

/** Ground height under the sky: the sand, or — in the hole — the cavern floor. */
export function habitatHeight(x, z, seed = HABITAT_SEED) {
  if (inHole(x, z)) return underworldFloor(x, z, seed)
  return habitatSurfaceHeight(x, z, seed)
}

/** Translucent veil coverage 0..1 for layer 0 / 1 (sheets grow with distance). */
export function habitatVeil(x, z, seed = HABITAT_SEED, layer = 0) {
  const r = Math.hypot(x, z)
  const k = 1 / (1 + r * 0.03)
  const f = (layer ? 0.22 : 0.32) * k
  const n = fbm2(seed + 61 + layer * 11, x * f, z * f, { octaves: 3 })
  const streak = Math.sin(x * 0.55 * k + z * 0.32 * k + fbm2(seed + 51, x * 0.12 * k, z * 0.12 * k, { octaves: 2 }) * 2.4)
  return clamp01(
    smoothstep(layer ? 0.05 : -0.1, 0.45, n) *
      (0.55 + 0.45 * streak) *
      smoothstep(1.4, 3, r) *
      (1 - smoothstep(HABITAT_VEIL_RADIUS * 0.6, HABITAT_VEIL_RADIUS * 0.95, r)) *
      smoothstep(THROAT.outer, THROAT.outer + 4, holeDistance(x, z)),
  )
}

/** Veil sheet height: lies on crests, bridges troughs above the base field. */
export function habitatVeilHeight(x, z, seed = HABITAT_SEED, layer = 0) {
  const r = Math.hypot(x, z)
  const swell = 0.5 + 0.5 * fbm2(seed + 91 + layer * 7, x * 0.25, z * 0.25, { octaves: 2 })
  const lift = ((layer ? 0.16 : 0.06) + swell * (layer ? 0.32 : 0.18)) * (1 + r * 0.025)
  return Math.max(habitatSurfaceHeight(x, z, seed) + 0.02 + layer * 0.02, habitatHeightBase(x, z, seed) + lift)
}

/** Normal by central differences (for placing growths upright-ish). */
export function habitatNormal(x, z, seed = HABITAT_SEED, eps = 0.05) {
  const hx = habitatHeight(x + eps, z, seed) - habitatHeight(x - eps, z, seed)
  const hz = habitatHeight(x, z + eps, seed) - habitatHeight(x, z - eps, seed)
  const nx = -hx / (2 * eps)
  const nz = -hz / (2 * eps)
  const len = Math.hypot(nx, 1, nz)
  return [nx / len, 1 / len, nz / len]
}

/**
 * Ground colour (sRGB 0..1) — lavender nacre: lilac hollows, champagne crowns,
 * a pearl halo around the organism.
 */
export function habitatColor(x, z, h, slope, seed = HABITAT_SEED) {
  /* Darker satin sand so the veils carry the light (reference). */
  const hollow = [0.4, 0.4, 0.48]
  const lilac = [0.56, 0.54, 0.65]
  const champagne = [0.74, 0.7, 0.72]
  const pearl = [0.82, 0.82, 0.88]
  const n = 0.5 + 0.5 * fbm2(seed + 31, x * 0.55, z * 0.55)
  const n2 = 0.5 + 0.5 * fbm2(seed + 37, x * 1.7, z * 1.7, { octaves: 3 })
  const crown = smoothstep(0.05, 0.55, h - 0.25 * fbm2(seed + 41, x * 0.2, z * 0.2)) * (1 - slope)
  const halo = 1 - smoothstep(1.2, 3.6, Math.hypot(x, z))
  const out = [0, 0, 0]
  for (let k = 0; k < 3; k++) {
    let c = hollow[k] * (1 - n) + lilac[k] * n
    c = c * (1 - crown * 0.5 * n2) + champagne[k] * crown * 0.5 * n2
    c = c * (1 - halo * 0.25) + pearl[k] * halo * 0.25
    out[k] = clamp01(c * (0.6 + 0.32 * n2))
  }
  return out
}

/** Deterministic PRNG shared by all habitat layouts. */
export function habitatRng(seed) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Background crystal outcrops (world xz, cluster radius, height scale). */
export const OUTCROPS = Object.freeze([
  { x: -5.6, z: -4.2, count: 16, spread: 0.9, scale: 1.25 },
  { x: -3.4, z: -8.5, count: 14, spread: 1.1, scale: 1.6 },
  { x: 6.2, z: -3.4, count: 20, spread: 1.0, scale: 1.7 },
  { x: 8.8, z: -7.6, count: 16, spread: 1.2, scale: 2.1 },
  { x: 4.0, z: -11.5, count: 12, spread: 1.4, scale: 2.4 },
  { x: -9.5, z: -6.0, count: 12, spread: 1.3, scale: 1.8 },
  { x: -4.4, z: 1.2, count: 7, spread: 0.45, scale: 0.55 },
  { x: 3.5, z: 1.9, count: 8, spread: 0.5, scale: 0.5 },
  /* mid + far clusters for depth */
  { x: -18, z: -26, count: 14, spread: 4, scale: 5 },
  { x: 24, z: -34, count: 16, spread: 5, scale: 7 },
  { x: -40, z: -62, count: 12, spread: 7, scale: 12 },
  { x: 56, z: -76, count: 12, spread: 8, scale: 14 },
  { x: 8, z: -96, count: 10, spread: 9, scale: 16 },
])

/** Translucent frond clumps (foreground left, right edge). */
export const FROND_CLUMPS = Object.freeze([
  { x: -2.25, z: 2.3, count: 7, scale: 1.05 },
  { x: -2.9, z: 0.7, count: 6, scale: 1.0 },
  { x: -1.6, z: 3.4, count: 4, scale: 0.7 },
  { x: 2.7, z: 2.3, count: 4, scale: 0.75 },
  { x: 3.4, z: 0.4, count: 5, scale: 0.9 },
  { x: -4.6, z: -1.6, count: 5, scale: 1.3 },
])

/** Golden filament tufts around the clearing. */
export const TUFTS = Object.freeze([
  { x: 2.3, z: 1.1, scale: 1.0 },
  { x: 3.1, z: 0.2, scale: 1.2 },
  { x: 3.8, z: 1.7, scale: 0.9 },
  { x: 1.6, z: 2.3, scale: 0.7 },
  { x: -1.9, z: 1.5, scale: 0.8 },
  { x: -2.8, z: 0.6, scale: 1.0 },
  { x: -1.2, z: 2.6, scale: 0.6 },
  { x: 4.9, z: -0.8, scale: 1.3 },
  { x: -4.1, z: -1.1, scale: 1.1 },
  { x: 0.4, z: 2.9, scale: 0.55 },
  { x: 5.6, z: 1.0, scale: 1.0 },
  { x: -5.2, z: 2.6, scale: 0.9 },
  { x: 1.8, z: -1.6, scale: 0.6 },
  { x: -1.4, z: -1.5, scale: 0.6 },
])

/** Small pearl spores (kin of the organism) resting near the clearing. */
export const SPORES = Object.freeze([
  { x: 2.6, z: 1.6, r: 0.22 },
  { x: 2.25, z: 2.05, r: 0.12 },
  { x: 2.95, z: 2.2, r: 0.09 },
  { x: 1.9, z: 1.45, r: 0.07 },
  { x: -2.6, z: 1.9, r: 0.1 },
  { x: -2.25, z: 2.3, r: 0.06 },
])
