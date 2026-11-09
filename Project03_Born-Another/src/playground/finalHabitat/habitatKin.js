/**
 * Exp07 kin: the other lives sharing the habitat. They follow the Exp04
 * population logic (populationSim: drift, separation, stage behaviour,
 * nurture, dissolve + re-birth) and this module maps a sim organism into the
 * habitat: where it floats, how high, how big, and how crystallized.
 *
 * The hero (the body at the clearing) stands at the centre of the medium;
 * organism 0 of the roster shares its seed and is left out, so the other
 * five keep the ring the sim spreads them on, around the hero.
 */
import { environmentFactors, popHash01, STAGE, scaleForAge } from '../finalForm/populationSim.js'

/** Sim medium → habitat ground plane. */
export const KIN_SPREAD = 1.95
export const KIN_MIN_RADIUS = 4.6
export const KIN_MAX_RADIUS = 20
/** Pull the ring back so the kin sit behind the hero, softened by fog. */
export const KIN_Z_OFFSET = -3.8
/** Kin are drawn smaller than the hero at the same AGE (hero stays the focus). */
export const KIN_SCALE = 0.62

/**
 * Sim tuning for the habitat: livelier currents and seeking than the Exp04
 * lab so the bodies visibly move around one another.
 */
export const KIN_SIM_OPTIONS = Object.freeze({
  maxSpeed: 0.8,
  flow: 0.16,
  seek: 0.24,
  territory: 0.08,
  rimDrift: 0.08,
  damping: 0.55,
})

/** Bud → dissolve duration range (seconds, neutral medium). */
export const KIN_LIFESPAN = Object.freeze([80, 260])
const LIFE_SPAN_AGE = 0.965 - 0.12

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}
function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/**
 * Crystallization of one body from the shared medium level and its AGE:
 * buds barely answer the cold, matures follow the medium, old bodies harden
 * into crystal on their own before they dissolve.
 */
export function kinCrystalLevel(globalLevel, age) {
  const a = clamp01(age)
  const g = clamp01(globalLevel)
  return clamp01(g * (0.25 + 0.75 * smoothstep(0.12, 0.8, a)) + 0.7 * smoothstep(0.58, 1, a))
}

/**
 * Each individual's rhythm (new for every generation): how long it lives, how
 * fast it breathes/bobs, how high it likes to float, how wide it wanders.
 */
export function kinTempo(archetypeSeed, generation = 0) {
  const h = (k) => popHash01(archetypeSeed, k, generation)
  const [lo, hi] = KIN_LIFESPAN
  return {
    lifespan: lo + h('life') * (hi - lo),
    pulse: 0.18 + h('pulse') * 0.3,
    height: h('height'),
    wander: 0.7 + h('wander') * 1.3,
    wanderRate: (0.06 + h('wrate') * 0.1) * (h('wdir') > 0.5 ? 1 : -1),
  }
}

/**
 * Advance one body's AGE by its own clock (mutates org). The medium still
 * matters: temperature = metabolism, moisture = young growth, and a nurtured
 * young body grows faster (sim `nurture`).
 */
export function ageKin(org, dt, environment) {
  const f = environmentFactors(environment)
  const tempo = kinTempo(org.archetypeSeed, org.generation)
  const young = org.stage === STAGE.BUD || org.stage === STAGE.YOUNG ? f.youngGrowth : 1
  const boost = 1 + (org.nurture || 0) * 2.2
  org.age = Math.min(1, org.age + (LIFE_SPAN_AGE / tempo.lifespan) * f.metabolism * young * boost * dt)
  return org
}

/** Float height by AGE (continuous): buds high and light, old bodies sink. */
export function liftForAge(age) {
  return 2.1 - 1.8 * smoothstep(0.2, 0.95, clamp01(age))
}

/** Visual fade right before re-birth (sim end-of-life = 0.965). */
export function kinDissolve(age) {
  const t = clamp01((age - 0.925) / 0.04)
  return 1 - t * t * (3 - 2 * t)
}

/** Target display scale (AGE growth × dissolve). */
export function kinScale(age) {
  return KIN_SCALE * scaleForAge(age) * kinDissolve(age)
}

/**
 * Habitat placement of a sim organism (medium centre = hero; `anchor`
 * optional). `t` (seconds) adds each body's own slow wander loop around its
 * sim seat and a slow rise and fall, so bodies move relative to each other.
 * Returns { x, z, lift } — lift is world units above the body's base hover.
 */
export function kinPlacement(org, anchor = null, t = 0) {
  const ax = anchor?.position?.[0] ?? 0
  const ay = anchor?.position?.[1] ?? 0
  const az = anchor?.position?.[2] ?? 0
  const tempo = kinTempo(org.archetypeSeed ?? org.seed ?? 1, org.generation ?? 0)
  const phase = org.phase ?? 0
  const wa = t * tempo.wanderRate + phase
  let x = (org.position[0] - ax) * KIN_SPREAD + Math.cos(wa) * tempo.wander
  let z = (org.position[2] - az) * KIN_SPREAD * 0.8 + KIN_Z_OFFSET + Math.sin(wa) * tempo.wander * 0.8
  let r = Math.hypot(x, z)
  if (r < KIN_MIN_RADIUS) {
    const a = r > 1e-4 ? Math.atan2(z, x) : (org.index ?? 1) * 2.399963
    x = Math.cos(a) * KIN_MIN_RADIUS
    z = Math.sin(a) * KIN_MIN_RADIUS
    r = KIN_MIN_RADIUS
  }
  if (r > KIN_MAX_RADIUS) {
    x *= KIN_MAX_RADIUS / r
    z *= KIN_MAX_RADIUS / r
  }
  const lift =
    liftForAge(org.age) +
    tempo.height * 1.6 +
    Math.max(-0.6, Math.min(0.9, (org.position[1] - ay) * 0.5)) +
    Math.sin(t * (0.08 + tempo.height * 0.07) + phase * 1.7) * 0.5
  return { x, z, lift: Math.max(0, lift) }
}


/**
 * Body tints: small shifts inside the Born Another palette (membrane depth,
 * warm core, sheen, petal tone). The hero keeps the first (rose).
 */
export const KIN_TINTS = Object.freeze([
  Object.freeze({ id: 'rose', attenuation: '#f1aecd', core: '#ffae92', sheen: '#ffd6ec', petal: '#e2aec0' }),
  Object.freeze({ id: 'lilac', attenuation: '#dcb3ea', core: '#f9b0ae', sheen: '#ecdcff', petal: '#d5bae4' }),
  Object.freeze({ id: 'peach', attenuation: '#f4bcb2', core: '#ffb286', sheen: '#ffe2d4', petal: '#e8bcb0' }),
  Object.freeze({ id: 'pearl', attenuation: '#d3c8ee', core: '#ffbcaa', sheen: '#e4ecff', petal: '#cdcbe9' }),
  Object.freeze({ id: 'mauve', attenuation: '#e5a8c6', core: '#f5a296', sheen: '#f6d2e8', petal: '#dca8c2' }),
])

/** Tint for one individual (kin never take the hero's rose). */
export function kinTint(archetypeSeed, generation = 0) {
  const n = KIN_TINTS.length - 1
  return KIN_TINTS[1 + Math.min(n - 1, Math.floor(popHash01(archetypeSeed, 'tint', generation) * n))]
}

/** Soft-body collision tuning (world units / seconds). */
export const KIN_PHYSICS = Object.freeze({
  /** Spring toward the sim / wander target, and its damping. */
  follow: 0.42,
  damping: 0.9,
  /** Repulsion starts this far out (× summed radii) — they ease off first. */
  softZone: 1.14,
  softStrength: 1.8,
  /** Never closer than this (× summed radii): the dent absorbs the rest. */
  hardLimit: 0.96,
  /** Bounce: fraction of approach speed returned. */
  restitution: 0.3,
  maxSpeed: 1.6,
  /** Dent easing: quick to press in, slow to recover (jelly). */
  pressIn: 0.3,
  recover: 0.05,
})

/**
 * One physics step for the floating bodies (mutates `bodies`).
 * bodies: [{ id, x, y, z, vx, vy, vz, r, tx, ty, tz, floor }] — y is the body
 *   centre (world), t* the target centre, floor the lowest allowed centre y.
 * hero: { id, x, y, z, r } fixed obstacle (or null).
 * dents: Map key "a|b" → { amount } carried between frames.
 * Returns contacts: Map id → [{ dir: [x, y, z] (unit, towards the other), amount }].
 */
export function stepKinPhysics(bodies, hero, dents, dt, P = KIN_PHYSICS) {
  const h = Math.min(0.05, Math.max(0, dt))
  for (const b of bodies) {
    b.vx += ((b.tx - b.x) * P.follow - b.vx * P.damping) * h
    b.vy += ((b.ty - b.y) * P.follow - b.vy * P.damping) * h
    b.vz += ((b.tz - b.z) * P.follow - b.vz * P.damping) * h
  }
  const all = hero ? [...bodies, { ...hero, fixed: true, vx: 0, vy: 0, vz: 0 }] : bodies
  const touching = new Map()
  /* Soft repulsion before contact. */
  for (let i = 0; i < bodies.length; i += 1) {
    const a = bodies[i]
    for (let j = 0; j < all.length; j += 1) {
      const b = all[j]
      if (a === b || (!b.fixed && j < i)) continue
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
      const d = Math.hypot(dx, dy, dz) || 1e-6
      const sum = a.r + b.r
      const zone = sum * P.softZone
      if (d >= zone) continue
      const f = ((zone - d) / sum) * P.softStrength * h
      const nx = dx / d, ny = dy / d, nz = dz / d
      const share = b.fixed ? 1 : 0.5
      a.vx -= nx * f * share; a.vy -= ny * f * share; a.vz -= nz * f * share
      if (!b.fixed) { b.vx += nx * f * 0.5; b.vy += ny * f * 0.5; b.vz += nz * f * 0.5 }
      const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
      touching.set(key, { a, b, n: [nx, ny, nz], press: Math.min(1, (zone - d) / (sum * (P.softZone - P.hardLimit + 0.12))) })
    }
  }
  for (const b of bodies) {
    const sp = Math.hypot(b.vx, b.vy, b.vz)
    if (sp > P.maxSpeed) { b.vx *= P.maxSpeed / sp; b.vy *= P.maxSpeed / sp; b.vz *= P.maxSpeed / sp }
    b.x += b.vx * h
    b.y += b.vy * h
    b.z += b.vz * h
  }
  /* Hard limit + bounce (a few passes so chains settle). */
  for (let pass = 0; pass < 3; pass += 1) {
    for (let i = 0; i < bodies.length; i += 1) {
      const a = bodies[i]
      for (let j = 0; j < all.length; j += 1) {
        const b = all[j]
        if (a === b || (!b.fixed && j < i)) continue
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
        const d = Math.hypot(dx, dy, dz) || 1e-6
        const need = (a.r + b.r) * P.hardLimit
        if (d >= need) continue
        const nx = dx / d, ny = dy / d, nz = dz / d
        const pen = need - d
        const wa = b.fixed ? 1 : 0.5
        a.x -= nx * pen * wa; a.y -= ny * pen * wa; a.z -= nz * pen * wa
        if (!b.fixed) { b.x += nx * pen * 0.5; b.y += ny * pen * 0.5; b.z += nz * pen * 0.5 }
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz
        if (vn < 0) {
          const imp = (-(1 + P.restitution) * vn) / (b.fixed ? 1 : 2)
          a.vx -= nx * imp; a.vy -= ny * imp; a.vz -= nz * imp
          if (!b.fixed) { b.vx += nx * imp; b.vy += ny * imp; b.vz += nz * imp }
        }
      }
    }
  }
  for (const b of bodies) {
    if (b.y < b.floor) {
      b.y = b.floor
      if (b.vy < 0) b.vy *= -0.3
    }
  }
  /* Dents: ease toward the current press, recover slowly after parting. */
  const contacts = new Map()
  const push = (id, dir, amount) => {
    if (!contacts.has(id)) contacts.set(id, [])
    contacts.get(id).push({ dir, amount })
  }
  const keys = new Set([...dents.keys(), ...touching.keys()])
  for (const key of keys) {
    const t = touching.get(key)
    const dent = dents.get(key) ?? { amount: 0, n: [0, 0, 1], ids: key.split('|') }
    const target = t ? t.press : 0
    dent.amount += (target - dent.amount) * (target > dent.amount ? P.pressIn : P.recover)
    if (t) {
      dent.n = t.n
      dent.ids = [t.a.id, t.b.id]
    }
    if (dent.amount < 0.005 && !t) {
      dents.delete(key)
      continue
    }
    dents.set(key, dent)
    const [ia, ib] = dent.ids
    const [nx, ny, nz] = dent.n
    push(ia, [nx, ny, nz], dent.amount)
    push(ib, [-nx, -ny, -nz], dent.amount)
  }
  for (const list of contacts.values()) list.sort((p, q) => q.amount - p.amount)
  return contacts
}

/**
 * World Final placement: a kin lives around its own anchor in the terrain.
 * The sim still moves it (relative to where it started, `home`), clamped to
 * `roam`, plus its own wander loop and float height — so the three lives
 * stay in different parts of the world but never stand still.
 */
export function kinPlacementAround(org, anchor, home, t = 0, roam = 5) {
  const tempo = kinTempo(org.archetypeSeed ?? org.seed ?? 1, org.generation ?? 0)
  const phase = org.phase ?? 0
  let ox = (org.position[0] - (home?.[0] ?? org.position[0])) * 1.2
  let oz = (org.position[2] - (home?.[2] ?? org.position[2])) * 1.2
  const ol = Math.hypot(ox, oz)
  if (ol > roam) {
    ox *= roam / ol
    oz *= roam / ol
  }
  const wa = t * tempo.wanderRate + phase
  const x = anchor[0] + ox + Math.cos(wa) * tempo.wander
  const z = anchor[1] + oz + Math.sin(wa) * tempo.wander * 0.8
  const lift =
    liftForAge(org.age) +
    tempo.height * 1.6 +
    Math.sin(t * (0.08 + tempo.height * 0.07) + phase * 1.7) * 0.5
  return { x, z, lift: Math.max(0, lift) }
}

/** Display scale without the end-of-life dissolve (a held, focused life). */
export function kinScaleHeld(age) {
  return KIN_SCALE * scaleForAge(age)
}

/** AGE at which a focused kin is held so its end can be witnessed. */
export const KIN_HOLD_AGE = 0.955

/**
 * How much of its species' silhouette a body shows (morphology amplitude):
 * young lives look alike — nearly round, soft — and their segmentation or
 * coil emerges as they mature. Quantized so the surface re-seats rarely.
 */
export function formEmergence(age) {
  const t = Math.min(1, Math.max(0, (Number(age) - 0.45) / (0.9 - 0.45)))
  const e = 0.22 + 0.78 * t * t * (3 - 2 * t)
  return Math.round(e * 20) / 20
}

/** World Final: the two kin are met young and mid-life (sizes differ). */
export const WORLD_KIN_AGES = Object.freeze({ o1: 0.24, o2: 0.5 })

/**
 * World Final: one size law for every life (hero and kin alike), so species
 * read as kin of one another — young a little smaller, mature a little larger,
 * never more than about a quarter apart.
 */
export function worldBodyScale(age) {
  const t = Math.min(1, Math.max(0, (Number(age) - 0.08) / (0.65 - 0.08)))
  return 0.92 * (0.78 + 0.22 * t * t * (3 - 2 * t))
}
