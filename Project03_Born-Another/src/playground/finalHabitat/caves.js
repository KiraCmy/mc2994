/**
 * World Final — the underworld (pure, no three.js).
 *
 * One hole in the sand opens onto a cavern under the dunes. The cavern is
 * two more height fields between the sand and nothing: a floor of drifted
 * sand and a ceiling that is the dunes' underside, soft and uneven, sagging
 * into pillars where it meets the floor and closing into walls at the edge.
 * Nothing figurative: just the other side of the water's ground.
 *
 * This module holds the shape (shared by the meshes), the camera's two-layer
 * collision, how deep below the viewer is (for the mood), and the niches
 * where kept remains rest.
 */
import { fbm2 } from '../../worldFinal/noise.js'
import {
  HABITAT_SEED,
  habitatRng,
  habitatSurfaceHeight,
  holeDistance,
  underworldFloor,
  UNDERWORLD,
} from './habitatField.js'

export { UNDERWORLD, underworldFloor }

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** Slab of sand kept between the cavern ceiling and the surface. */
const ROOF = 1.4

export function centreDistance(x, z) {
  return Math.hypot(x - UNDERWORLD.centre.x, z - UNDERWORLD.centre.z)
}

/** Headroom above the floor (0 = closed: a wall or a pillar). */
export function clearance(x, z, seed = HABITAT_SEED) {
  const dc = centreDistance(x, z)
  if (dc >= UNDERWORLD.radius) return 0
  const dh = holeDistance(x, z)
  const vault = 6 + 3.5 * fbm2(seed + 311, x * 0.055, z * 0.055, { octaves: 3 })
  /* Pillars: where the ceiling sags all the way down. */
  const p = fbm2(seed + 317, x * 0.1, z * 0.1, { octaves: 2 })
  const pillar = smoothstep(0.34, 0.5, p) * smoothstep(UNDERWORLD.hole.r + 4, UNDERWORLD.hole.r + 10, dh)
  /* Drips: the ceiling hangs lower in soft lobes. */
  const drip = Math.pow(Math.max(0, fbm2(seed + 323, x * 0.22, z * 0.22, { octaves: 2 })), 2) * 3
  let c = Math.max(0, vault * (1 - pillar) - drip)
  /* Wide open under the hole, closing into walls at the edge. */
  c = Math.max(c, 7.5 * (1 - smoothstep(UNDERWORLD.hole.r, UNDERWORLD.hole.r + 6, dh)))
  return c * (1 - smoothstep(UNDERWORLD.radius * 0.7, UNDERWORLD.radius, dc))
}

/** Cavern ceiling height (always under the sand, never under the floor). */
export function underworldCeiling(x, z, seed = HABITAT_SEED) {
  const floor = underworldFloor(x, z, seed)
  const top = habitatSurfaceHeight(x, z, seed) - ROOF
  return Math.max(floor, Math.min(floor + clearance(x, z, seed), top))
}

/**
 * When the viewer is under the sand inside the cavern: its floor and ceiling
 * there. Null on the surface (or in the hole, where the sky is open).
 */
export function underworldSpan(x, y, z, seed = HABITAT_SEED) {
  if (centreDistance(x, z) >= UNDERWORLD.radius) return null
  if (holeDistance(x, z) < UNDERWORLD.hole.r) return null
  if (y > habitatSurfaceHeight(x, z, seed) - ROOF * 0.5) return null
  return { floor: underworldFloor(x, z, seed), ceiling: underworldCeiling(x, z, seed) }
}

/** 0 on the surface … 1 deep in the cavern, far from the light of the hole. */
export function underworldDepth([x, y, z], seed = HABITAT_SEED) {
  const dh = holeDistance(x, z)
  if (dh < UNDERWORLD.hole.r + 1) {
    const rim = habitatSurfaceHeight(x, z, seed)
    return Math.max(0, Math.min(0.5, ((rim - y) / UNDERWORLD.depth) * 0.6))
  }
  if (!underworldSpan(x, y, z, seed)) return 0
  return 0.5 + 0.5 * smoothstep(4, 26, dh)
}

/**
 * Niches for kept remains: the newest near the hole, older ones deeper in,
 * each with room around it. Returns up to `count` positions [x, y, z].
 */
export function remainNiches(count, seed = HABITAT_SEED) {
  const r = habitatRng(seed + 991)
  const out = []
  const { hole } = UNDERWORLD
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let k = 0, tries = 0; out.length < count && tries < count * 60; tries++, k++) {
    const dist = hole.r + 3 + Math.sqrt(k) * 3.2
    const ang = k * golden + r() * 0.4
    const x = hole.x + Math.cos(ang) * dist
    const z = hole.z + Math.sin(ang) * dist
    if (centreDistance(x, z) > UNDERWORLD.radius * 0.82) continue
    if (clearance(x, z, seed) < 3.4) continue
    if (out.some(([px, , pz]) => Math.hypot(px - x, pz - z) < 3)) continue
    out.push([x, underworldFloor(x, z, seed) + 1.5 + r() * 0.6, z])
  }
  return out
}

/* ---------------- viewing poses (dev: ?cave=hole / ?cave=inside) ---------------- */

export function cavePose(id) {
  const { hole, centre } = UNDERWORLD
  const toward = Math.atan2(centre.z - hole.z, centre.x - hole.x)
  if (id === 'inside') {
    const x = hole.x + Math.cos(toward) * (hole.r + 3)
    const z = hole.z + Math.sin(toward) * (hole.r + 3)
    const tx = hole.x + Math.cos(toward) * (hole.r + 14)
    const tz = hole.z + Math.sin(toward) * (hole.r + 14)
    return { position: [x, underworldFloor(x, z) + 1.6, z], target: [tx, underworldFloor(tx, tz) + 1.4, tz] }
  }
  /* At the rim, looking down into the opening. */
  const x = hole.x - Math.cos(toward) * (hole.r + 9)
  const z = hole.z - Math.sin(toward) * (hole.r + 9)
  return { position: [x, habitatSurfaceHeight(x, z) + 3.5, z], target: [hole.x, underworldFloor(hole.x, hole.z) + 4, hole.z] }
}
