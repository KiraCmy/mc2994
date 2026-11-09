/**
 * World Final opening experience (pure, no three.js / React):
 *  - descent: a slow sink from the lit water surface to the seabed, ending in
 *    the forward-looking exploration pose (skippable);
 *  - discovery: three lives placed in different parts of the terrain;
 *  - encounter: a delicate, slightly unpredictable response when approached;
 *  - focus: a comfortable observation pose that never clips the body.
 * Vectors are [x, y, z] arrays; the ground height function is passed in.
 */

import { habitatHeight } from './habitatField.js'

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}
function smooth(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}
function smoother(t) {
  const x = clamp01(t)
  return x * x * x * (x * (x * 6 - 15) + 10)
}
const lerp = (a, b, t) => a + (b - a) * t

/* ---------------------------------------------------------------- places */

/** Where the three lives live (world x, z). Close enough that their wander
 *  brings them into contact — they can press on one another. The hero sits
 *  just ahead of the landing gaze; the other two flank it. */
export const HERO_HOME = Object.freeze([0.2, -6])
export const KIN_ANCHORS = Object.freeze({ o1: Object.freeze([-4.2, -3.2]), o2: Object.freeze([4.6, -4.4]) })
/** How far a kin may wander from its anchor. Wide enough to meet the others. */
export const KIN_ROAM = 3.6
/** World Final keeps three lives in the habitat (hero + two kin). */
export const WORLD_KIN_COUNT = 3

/* --------------------------------------------------------------- descent */

export const DESCENT_SECONDS = 14
/** Height of the water surface above the clearing. */
export const SURFACE_HEIGHT = 52
/** Seconds after landing over which the haze thins to the normal water. */
export const HAZE_CLEAR_SECONDS = 26

/** Where the descent lands (x, z): well back from the clearing, so the lives
 *  are small shapes in the haze ahead and the viewer goes in to find them. */
export const ARRIVAL = Object.freeze([-2, 30])
/** How far ahead the orbit target sits after landing (looking around stays
 *  close to the eye instead of swinging around the far clearing). */
export const ARRIVAL_LOOK = 16

/** Exploration pose the descent hands over to: a little above the dunes,
 *  looking out toward the clearing with a gentle downward gaze. */
export function explorePose(groundY, groundAt = habitatHeight) {
  const [x, z] = ARRIVAL
  const local = groundAt ? groundAt(x, z) : groundY
  const y = Math.max(groundY + 4.6, local + 2.4)
  let dx = HERO_HOME[0] - x
  let dz = HERO_HOME[1] - z
  const len = Math.hypot(dx, dz) || 1
  dx /= len
  dz /= len
  return {
    position: [x, y, z],
    target: [x + dx * ARRIVAL_LOOK, y - ARRIVAL_LOOK * 0.07, z + dz * ARRIVAL_LOOK],
  }
}

function dirAngles(from, to) {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]
  const len = Math.hypot(dx, dy, dz) || 1
  return { yaw: Math.atan2(dx, -dz), pitch: Math.asin(dy / len), len }
}
function dirFrom(yaw, pitch) {
  return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]
}

/**
 * Camera pose at `t` seconds into the descent: looking up at the lit surface,
 * sinking slowly, the gaze tipping down to the seabed ahead, ending exactly on
 * the exploration pose. Returns { position, target, depth } with depth 1 at
 * the surface → 0 on arrival.
 */
export function descentPose(t, groundY) {
  const end = explorePose(groundY)
  const a = dirAngles(end.position, end.target)
  const s = clamp01(t / DESCENT_SECONDS)
  const sink = smoother(s)
  const position = [
    lerp(end.position[0] + 3, end.position[0], sink),
    lerp(groundY + SURFACE_HEIGHT - 13, end.position[1], sink),
    lerp(end.position[2] + 9, end.position[2], sink),
  ]
  const look = smooth(0.06, 0.74, s)
  /* Not staring straight up: a tilted look through the water toward the
     light, so the surface reads as soft glow, never as a pattern. */
  const pitch = lerp(0.62, a.pitch, look)
  const yaw = lerp(a.yaw + 0.5, a.yaw, smooth(0.05, 0.95, s))
  const d = dirFrom(yaw, pitch)
  return {
    position,
    target: [position[0] + d[0] * a.len, position[1] + d[1] * a.len, position[2] + d[2] * a.len],
    depth: 1 - sink,
  }
}

/** Haze multiplier on fog density: thick while sinking, thinning after landing. */
export function openingHaze(t) {
  if (!(t >= 0)) return 0
  if (t < DESCENT_SECONDS) return 1
  return 1 - smooth(0, HAZE_CLEAR_SECONDS, t - DESCENT_SECONDS)
}

/* ------------------------------------------------------------- encounter */

export const RESPONSE = Object.freeze({ attack: 0.9, hold: 0.5, release: 2.8 })

/** 0 → 1 → 0 envelope of one response, `dt` seconds after it began. */
export function responseEnvelope(dt) {
  if (!(dt >= 0)) return 0
  const { attack, hold, release } = RESPONSE
  if (dt < attack) return smooth(0, attack, dt)
  if (dt < attack + hold) return 1
  return 1 - smooth(attack + hold, attack + hold + release, dt)
}
export const RESPONSE_SECONDS = RESPONSE.attack + RESPONSE.hold + RESPONSE.release

/** Which response, from a random number in [0, 1). */
export function pickResponse(r) {
  if (r < 0.32) return 'contract'
  if (r < 0.52) return 'expand'
  if (r < 0.82) return 'shimmer'
  return 'still'
}

/** Distance at which a body notices the viewer (grows with its size). */
export function noticeRadius(radius) {
  return 6.5 + 2.4 * radius
}

/** Cooldown after a response (seconds), from a random number in [0, 1). */
export function responseCooldown(r) {
  return 9 + r * 9
}

/* ----------------------------------------------------------------- focus */

export const FOCUS_SECONDS = 2.1

/** Observation distance for a body of world radius `radius`. */
export function focusDistance(radius) {
  return Math.min(12, Math.max(4.8, radius * 3.6 + 2))
}

/**
 * Comfortable observation pose: on the viewer's side of the body (so the
 * approach never passes through it), a little above, never below the sand.
 */
export function focusPose(centre, radius, cameraPos, groundAt) {
  let dx = cameraPos[0] - centre[0]
  let dz = cameraPos[2] - centre[2]
  const len = Math.hypot(dx, dz)
  if (len < 1e-3) {
    dx = 0
    dz = 1
  } else {
    dx /= len
    dz /= len
  }
  const dist = focusDistance(radius)
  const x = centre[0] + dx * dist
  const z = centre[2] + dz * dist
  const y = Math.max(centre[1] + dist * 0.22, (groundAt ? groundAt(x, z) : -Infinity) + 1.1)
  return { position: [x, y, z], target: [...centre], distance: dist }
}

/** Ease for camera transitions. */
export function easeInOut(t) {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/* ------------------------------------------------------------- lineage */

/** The species a life can be born as (morphology → mineral → fossil). */
export const SPECIES = Object.freeze(['spiral', 'segmented', 'trilobite'])
/** The first three lives (generation 0). */
export const INITIAL_SPECIES = Object.freeze({ hero: 'spiral', o1: 'segmented', o2: 'trilobite' })

function hash01(...keys) {
  let h = 2166136261 >>> 0
  for (const key of keys) {
    const s = String(key)
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619) >>> 0
    }
  }
  h ^= h >>> 15
  h = Math.imul(h, 2246822507) >>> 0
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

/** Species of a life: the first three as authored, later births by chance. */
export function speciesFor(id, generation = 0, seed = 0) {
  if (!generation && INITIAL_SPECIES[id]) return INITIAL_SPECIES[id]
  return SPECIES[Math.floor(hash01(id, generation, seed, 'species') * SPECIES.length) % SPECIES.length]
}

/** Where new lives may be born: around the clearing, within the first view. */
export const BIRTH_CENTRE = Object.freeze([0, -5])
export const BIRTH_RADIUS = Object.freeze([3.5, 12])
/** New lives keep this far from other lives and from fresh remains. */
export const BIRTH_SPACING = 4.2

/**
 * A birthplace for a new life: deterministic for (id, generation, seed),
 * away from `occupied` points ([x, z]) where possible.
 */
export function pickHome(id, generation, seed, occupied = []) {
  let best = null
  let bestGap = -1
  for (let k = 0; k < 24; k++) {
    const a = hash01(id, generation, seed, 'a', k) * Math.PI * 2
    const r = BIRTH_RADIUS[0] + hash01(id, generation, seed, 'r', k) * (BIRTH_RADIUS[1] - BIRTH_RADIUS[0])
    const x = BIRTH_CENTRE[0] + Math.cos(a) * r
    const z = BIRTH_CENTRE[1] + Math.sin(a) * r * 0.8
    let gap = Infinity
    for (const o of occupied) gap = Math.min(gap, Math.hypot(o[0] - x, o[1] - z))
    if (gap >= BIRTH_SPACING) return [x, z]
    if (gap > bestGap) {
      bestGap = gap
      best = [x, z]
    }
  }
  return best
}

/* -------------------------------------------------------------- remains */

/** How long an unwitnessed husk drifts before it settles to the seabed. */
export const UNWITNESSED_HUSK_SECONDS = 6
export const REMAINS_SETTLE_SECONDS = 4.2
/** Remains merge into the seabed over this long (form stays readable) … */
export const REMAINS_BURY_SECONDS = 150
/** … and only the most recent stay on the seabed. */
export const MAX_REMAINS = 6

/** Remains motion at `t` seconds: settle (0→1) and burial (0→1). */
export function remainsPhase(t) {
  const settle = easeInOut(t / REMAINS_SETTLE_SECONDS)
  const b = Math.min(1, Math.max(0, (t - REMAINS_SETTLE_SECONDS) / REMAINS_BURY_SECONDS))
  return { settle, bury: b * b * (3 - 2 * b) }
}
