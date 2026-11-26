/**
 * World Final opening experience (pure, no three.js / React):
 *  - descent: a slow sink from the lit water surface to the seabed, ending in
 *    the forward-looking exploration pose (skippable);
 *  - discovery: the clearing's three lives, and two more off the landing path;
 *  - encounter: a delicate, slightly unpredictable response when approached;
 *  - focus: a comfortable observation pose that never clips the body.
 * Vectors are [x, y, z] arrays; the ground height function is passed in.
 */

import { habitatHeight } from './habitatField.js'
import { blocksSight } from './habitatKin.js'

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

/** Where the lives live (world x, z). The clearing three sit close enough
 *  that their wander brings them into contact. Two more live off the landing
 *  path, one to each side, and do not share that wander (see KIN_LOGIC). */
export const HERO_HOME = Object.freeze([0.2, -6])
export const KIN_ANCHORS = Object.freeze({
  o1: Object.freeze([-4.2, -3.2]),
  o2: Object.freeze([4.6, -4.4]),
  /* Left of the approach, on a low dune. */
  o3: Object.freeze([-8, 14]),
  /* Right of the approach, in open water. */
  o4: Object.freeze([11, 18]),
})
/** How far a roaming kin may wander from its anchor. */
export const KIN_ROAM = 3.6
/**
 * How each kin occupies its place.
 *  roam   — drifts around the anchor and can meet the others (the clearing).
 *  rooted — stays on the anchor, a breath above the sand, and hardens.
 *  column — circles the anchor in the water and stays soft.
 */
export const KIN_LOGIC = Object.freeze({ o1: 'roam', o2: 'roam', o3: 'rooted', o4: 'column' })
export function kinLogic(id) {
  return KIN_LOGIC[id] ?? 'roam'
}
/** World Final roster: the hero slot plus the kin (clearing pair and two others). */
export const WORLD_KIN_COUNT = 5

/* --------------------------------------------------------------- descent */

export const DESCENT_SECONDS = 22
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

/** Exploration pose the descent hands over to: low over the dunes, looking
 *  across the clearing and a little up, so the lower part of the sun sits
 *  in the top of the frame. */
export function explorePose(groundY, groundAt = habitatHeight) {
  const [x, z] = ARRIVAL
  const local = groundAt ? groundAt(x, z) : groundY
  const y = Math.max(groundY + 3.2, local + 1.7)
  const heroYaw = Math.atan2(HERO_HOME[0] - x, -(HERO_HOME[1] - z))
  /* Sun sits up and to the right of the clearing (LIGHT_DIR). Yaw most of
     the way toward it without losing the lives ahead. */
  const sunYaw = Math.atan2(0.62, 0.62)
  /* Landing view: the lives ahead near the centre, the sun's glow up in the
     top-right corner, the near dunes filling the bottom of the frame. */
  const yaw = heroYaw + Math.max(-0.14, Math.min(0.14, sunYaw - heroYaw))
  const pitch = 0.07
  const d = dirFrom(yaw, pitch)
  return {
    position: [x, y, z],
    target: [x + d[0] * ARRIVAL_LOOK, y + d[1] * ARRIVAL_LOOK, z + d[2] * ARRIVAL_LOOK],
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
  /* One continuous sink. The gaze starts a little upward and tips down with
     the fall, so the light overhead is just what the descent passes through. */
  const sink = smoother(clamp01(t / DESCENT_SECONDS))
  const position = [
    lerp(end.position[0] + 2.2, end.position[0], sink),
    lerp(groundY + SURFACE_HEIGHT - 12, end.position[1], sink),
    lerp(end.position[2] + 5, end.position[2], sink),
  ]
  const pitch = lerp(0.46, a.pitch, sink)
  const yaw = lerp(a.yaw + 0.28, a.yaw, sink)
  const d = dirFrom(yaw, pitch)
  return {
    position,
    target: [position[0] + d[0] * a.len, position[1] + d[1] * a.len, position[2] + d[2] * a.len],
    depth: 1 - sink,
  }
}

/* --------------------------------------------------------------- entrance */

/** Cinematic dark-to-world passage, on the same clock as the descent. */
export const ENTRANCE_SECONDS = 18

/** Quiet lines. Each eases in, holds, then eases out before the next.
 *  The last one is gone while the world is still mostly covered. */
export const ENTRANCE_LINES = Object.freeze([
  /* The first line arrives soon after the page opens (not after a long
     dark wait); the three keep their rhythm. */
  Object.freeze({ text: 'to encounter', in: [0.8, 2.2], out: [3.4, 4.8] }),
  Object.freeze({ text: 'to know', in: [5.3, 6.6], out: [7.4, 8.7] }),
  Object.freeze({ text: 'to remember', in: [9.1, 10.3], out: [10.8, 12.0] }),
])

function windowOpacity(t, inn, out) {
  if (t <= inn[0] || t >= out[1]) return 0
  if (t < inn[1]) return smooth(inn[0], inn[1], t)
  if (t <= out[0]) return 1
  return 1 - smooth(out[0], out[1], t)
}

/**
 * Cover at `t` seconds.
 *  night — the black sheet. 1 is pure dark; it lifts to reveal the teal wash.
 *  veil  — the wash itself. 1 hides the world; 0 leaves the habitat untouched.
 * Phrases each fade in and out. At most one is visible, and the last is gone
 * while the world is still mostly covered.
 */
export function entranceCue(t) {
  const x = Math.max(0, Number(t) || 0)
  const night = x >= 8.4 ? 0 : 1 - smooth(1.3, 8.4, x)
  const veil = x >= ENTRANCE_SECONDS ? 0 : 1 - smooth(9.2, ENTRANCE_SECONDS, x)
  return {
    night,
    veil,
    phrases: ENTRANCE_LINES.map((line) => windowOpacity(x, line.in, line.out)),
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

/** Observation distance for a body of world radius `radius` (about a fifth
 *  farther than it was: the life sits in its water, not filling the view). */
export function focusDistance(radius) {
  return Math.min(14.4, Math.max(5.8, radius * 4.3 + 2.4))
}

/** Camera height above the body's centre, as a share of the distance:
 *  nearly level (≈3.5° down), so the far water and its forms stay in view. */
export const FOCUS_LIFT = 0.06
/** Clearance kept above the sand under the camera. */
const FOCUS_CLEAR = 1.1
/** Angles (degrees) tried around the body when the sand is in the way,
 *  nearest to the viewer's own side first. */
const FOCUS_SWEEP = [0, 15, -15, 30, -30, 45, -45, 60, -60, 75, -75, 90, -90, 110, -110]

/**
 * Comfortable observation pose: on the viewer's side of the body (so the
 * approach never passes through it), almost level with it, never below the
 * sand. Where a dune would push the camera up into looking down at the
 * ground, or another life (`blockers`: [{x, y, z, r}]) would stand in front
 * of the observed one, it steps around the body to the nearest spot that is
 * level and clear (else the least bad one).
 */
export function focusPose(centre, radius, cameraPos, groundAt, blockers = []) {
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
  const want = centre[1] + dist * FOCUS_LIFT
  const at = (deg) => {
    const a = (deg * Math.PI) / 180
    const ax = dx * Math.cos(a) - dz * Math.sin(a)
    const az = dx * Math.sin(a) + dz * Math.cos(a)
    const x = centre[0] + ax * dist
    const z = centre[2] + az * dist
    const floor = groundAt ? groundAt(x, z) + FOCUS_CLEAR : -Infinity
    const y = Math.max(want, floor)
    const blocked = blockers.filter((b) => blocksSight(b, [x, y, z], centre, radius)).length
    const lift = Math.max(0, floor - want)
    /* A life in front costs more than any dune. */
    return { x, z, y, lift, blocked, cost: lift + blocked * 10 }
  }
  let best = at(0)
  if (best.lift > 0.05 || best.blocked) {
    for (const deg of FOCUS_SWEEP.slice(1)) {
      const p = at(deg)
      if (p.cost < best.cost - 1e-3) best = p
      if (best.lift <= 0.05 && !best.blocked) break
    }
  }
  return { position: [best.x, best.y, best.z], target: [...centre], distance: dist }
}

/** Ease for camera transitions. */
export function easeInOut(t) {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/* ------------------------------------------------------------- lineage */

/** The species a life can be born as (morphology → mineral → fossil). */
export const SPECIES = Object.freeze(['spiral', 'segmented', 'trilobite'])
/** Generation 0. The two off the path repeat a family, and live it differently. */
export const INITIAL_SPECIES = Object.freeze({
  hero: 'spiral',
  o1: 'segmented',
  o2: 'trilobite',
  o3: 'trilobite',
  o4: 'spiral',
})

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
