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
export const KIN_SPREAD = 1.45
export const KIN_MIN_RADIUS = 3.4
export const KIN_MAX_RADIUS = 16
/** Kin are drawn a little smaller than the hero at the same AGE. */
export const KIN_SCALE = 0.82

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
  return clamp01(g * (0.3 + 0.8 * smoothstep(0.15, 0.75, a)) + 0.45 * smoothstep(0.78, 0.96, a))
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
    pulse: 0.3 + h('pulse') * 0.6,
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
  let z = (org.position[2] - az) * KIN_SPREAD * 0.8 - 1 + Math.sin(wa) * tempo.wander * 0.8
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
 * Keep bodies from passing through each other after wander + lift are added
 * (the sim separates them in its own space; the habitat offsets can undo it).
 * Mutates `items` ({ x, z, lift, scale }); the hero is a fixed sphere at the
 * clearing. Centre height ≈ lift + 2·scale (base hover), radius ≈ 1.6·scale.
 */
export function relaxKin(items, { heroRadius = 1.7, heroY = 2.1, iterations = 4 } = {}) {
  const centre = (it) => [it.x, it.lift + 2 * it.scale, it.z]
  for (let iter = 0; iter < iterations; iter += 1) {
    for (let i = 0; i < items.length; i += 1) {
      const a = items[i]
      const ra = 1.6 * a.scale
      /* hero */
      {
        const [x, y, z] = centre(a)
        const dy = y - heroY
        const d = Math.hypot(x, dy, z) || 1e-6
        const need = ra + heroRadius
        if (d < need) {
          const push = need - d
          a.x += (x / d) * push
          a.z += (z / d) * push
          a.lift = Math.max(0, a.lift + (dy / d) * push)
        }
      }
      for (let j = i + 1; j < items.length; j += 1) {
        const b = items[j]
        const [ax, ay, az] = centre(a)
        const [bx, by, bz] = centre(b)
        const dx = bx - ax, dy = by - ay, dz = bz - az
        const d = Math.hypot(dx, dy, dz) || 1e-6
        const need = ra + 1.6 * b.scale
        if (d >= need) continue
        const push = (need - d) * 0.5
        a.x -= (dx / d) * push
        a.z -= (dz / d) * push
        a.lift = Math.max(0, a.lift - (dy / d) * push)
        b.x += (dx / d) * push
        b.z += (dz / d) * push
        b.lift = Math.max(0, b.lift + (dy / d) * push)
      }
    }
  }
  return items
}
