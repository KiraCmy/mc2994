/**
 * Experiment 04 — Population: several Exp05 organisms floating in one
 * medium, each at its own life stage, influencing one another.
 *
 * Pure + deterministic (fixed DT, seeded). No three.js / React here — the
 * scene reads positions every frame and lives' AGE at a low rate.
 *
 * Behaviour (all soft forces, slow — "suspended in liquid"):
 *  - drift: a slowly evolving flow field + gentle vertical bob
 *  - separation: bodies never interpenetrate
 *  - stage behaviour:
 *      young  (AGE < 0.40) → seek the nearest mature body, settle in its lee
 *      mature (0.40–0.80)  → keep territorial distance from other matures
 *      old    (≥ 0.80)     → drift outward to the rim of the medium
 *  - nurture exchange: a mature body within reach streams particles to a
 *    young one; the young ages faster, the giver ages slightly faster (cost)
 *  - lifecycle: at the end of life a body dissolves and is re-born as a bud
 *    at the rim with a new seed generation ("born another")
 *  - environment (shared medium, 0..1, 0.5 / 0.5 / 0 neutral):
 *      temperature → metabolism (ageing speed)
 *      moisture    → young growth + nurture reach
 *      turbulence  → stronger currents, faster jostling
 */
import { EXP05_MORPHOLOGY_TYPES } from './exp05MorphologyTypes.js'

export const POPULATION_DT = 1 / 30
export const POPULATION_MAX = 7

export const POPULATION_ENV_DEFAULTS = Object.freeze({
  temperature: 0.5,
  moisture: 0.5,
  turbulence: 0,
})

/** Environment → behaviour multipliers (1 at neutral). */
export function environmentFactors(env = POPULATION_ENV_DEFAULTS) {
  const t = clamp01(env?.temperature ?? 0.5)
  const m = clamp01(env?.moisture ?? 0.5)
  const u = clamp01(env?.turbulence ?? 0)
  return {
    metabolism: 0.55 + 0.9 * t,
    youngGrowth: 0.5 + m,
    reach: 0.75 + 0.5 * m,
    flow: 1 + 2.2 * u,
    speed: 1 + 0.9 * u,
  }
}

/** Editable per-organism traits (panel / tests). */
export const ORGANISM_TRAIT_LIMITS = Object.freeze({
  lobe: [0.25, 2.25],
  sculpt: [0, 2],
  age: [0.05, 0.95],
})
export const POPULATION_DEFAULT_COUNT = 6

/** Ellipsoidal medium the organisms float in (world units). */
export const POPULATION_BOUNDS = Object.freeze([8.4, 3.6, 4.8])

export const STAGE = Object.freeze({
  BUD: 'bud',
  YOUNG: 'young',
  MATURE: 'mature',
  OLD: 'old',
})

export const POPULATION_DEFAULTS = Object.freeze({
  /** Base AGE gained per second (≈ 9 min bud → old without nurture). */
  ageRate: 0.00175,
  /** Max multiplier a fully nurtured young body ages at. */
  nurtureBoost: 3.2,
  /** Extra ageing a giver pays per unit of nurture given. */
  giverCost: 0.35,
  maxSpeed: 0.32,
  damping: 0.7,
  flow: 0.055,
  separation: 1.6,
  seek: 0.16,
  territory: 0.05,
  rimDrift: 0.045,
  contain: 0.18,
  /** Exchange reach in multiples of the two bodies' summed radii. */
  exchangeReach: 2.9,
  /** Contact (proximity deformation) reach in multiples of summed radii. */
  contactReach: 1.35,
  /** AGE at which a body dissolves and is re-born. */
  endOfLife: 0.965,
  rebirthAge: 0.12,
})

/**
 * Seven archetypes — same Exp05 visual system, varied silhouette + stage.
 * `lobe` = morphologyComplexity, `sculpt` = sculpturalStrength.
 */
export const POPULATION_ROSTER = Object.freeze([
  { id: 'o0', seed: 884731, morphologyType: EXP05_MORPHOLOGY_TYPES.WORLD, age: 0.6, lobe: 1, sculpt: 0 },
  { id: 'o1', seed: 52711, morphologyType: EXP05_MORPHOLOGY_TYPES.SEGMENTED, age: 0.3, lobe: 1.15, sculpt: 0.2 },
  { id: 'o2', seed: 9043, morphologyType: EXP05_MORPHOLOGY_TYPES.SPIRAL, age: 0.7, lobe: 1.05, sculpt: 0.35 },
  { id: 'o3', seed: 31337, morphologyType: EXP05_MORPHOLOGY_TYPES.WORLD, age: 0.17, lobe: 0.85, sculpt: 0 },
  { id: 'o4', seed: 70219, morphologyType: EXP05_MORPHOLOGY_TYPES.SPIRAL, age: 0.87, lobe: 1.2, sculpt: 0.25 },
  { id: 'o5', seed: 15485, morphologyType: EXP05_MORPHOLOGY_TYPES.SEGMENTED, age: 0.47, lobe: 0.95, sculpt: 0.1 },
  { id: 'o6', seed: 66013, morphologyType: EXP05_MORPHOLOGY_TYPES.WORLD, age: 0.25, lobe: 1.1, sculpt: 0.3 },
])

/** Deterministic [0,1). */
export function popHash01(...keys) {
  let h = 2166136261 >>> 0
  for (const key of keys) {
    const s = String(key)
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619) >>> 0
    }
    h ^= h >>> 13
    h = Math.imul(h, 2246822507) >>> 0
  }
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

export function stageForAge(age) {
  const a = clamp01(age)
  if (a < 0.22) return STAGE.BUD
  if (a < 0.4) return STAGE.YOUNG
  if (a < 0.8) return STAGE.MATURE
  return STAGE.OLD
}

const isYoung = (s) => s === STAGE.BUD || s === STAGE.YOUNG

/**
 * Display scale by AGE: buds small, mature full, old slightly shrunken.
 * The Exp05 body radius at scale 1 is ≈ 1.4 world units.
 */
export function scaleForAge(age) {
  const a = clamp01(age)
  const grow = 0.42 + 0.58 * smoothstep(0.08, 0.6, a)
  const wane = 1 - 0.14 * smoothstep(0.8, 1, a)
  return grow * wane
}

export const BODY_RADIUS = 1.4

export function radiusForAge(age) {
  return BODY_RADIUS * scaleForAge(age)
}

/** Seed for a re-born generation (same archetype, new individual). */
export function generationSeed(baseSeed, generation) {
  if (!generation) return baseSeed
  return 1000 + Math.floor(popHash01(baseSeed, 'gen', generation) * 98000)
}

function spawnPoint(index, count, seed) {
  /* Spread on a loose ring inside the medium, deterministic jitter. */
  const [bx, by, bz] = POPULATION_BOUNDS
  const a = (index / Math.max(1, count)) * Math.PI * 2 + popHash01(seed, 'a') * 0.6
  const r = 0.55 + popHash01(seed, 'r') * 0.25
  return [
    Math.cos(a) * bx * r,
    (popHash01(seed, 'y') - 0.5) * by * 0.9,
    Math.sin(a) * bz * r,
  ]
}

function rimPoint(seed, generation) {
  const [bx, by, bz] = POPULATION_BOUNDS
  const a = popHash01(seed, 'rim', generation) * Math.PI * 2
  return [
    Math.cos(a) * bx * 0.85,
    (popHash01(seed, 'rimy', generation) - 0.5) * by * 0.8,
    Math.sin(a) * bz * 0.85,
  ]
}

/**
 * @param {{ count?: number, seed?: number, options?: object }} [opts]
 */
export function createPopulation({
  count = POPULATION_DEFAULT_COUNT,
  seed = 1,
  options = {},
} = {}) {
  const n = Math.min(POPULATION_MAX, Math.max(1, Math.round(Number(count) || 1)))
  const organisms = POPULATION_ROSTER.slice(0, n).map((spec, index) => ({
    id: spec.id,
    index,
    archetypeSeed: spec.seed,
    seed: spec.seed,
    generation: 0,
    morphologyType: spec.morphologyType,
    lobe: spec.lobe,
    sculpt: spec.sculpt,
    age: spec.age,
    stage: stageForAge(spec.age),
    position: spawnPoint(index, n, spec.seed + seed),
    velocity: [0, 0, 0],
    /** Slow self-rotation (rad) and its rate. */
    spin: popHash01(spec.seed, 'spin0') * Math.PI * 2,
    spinRate: (popHash01(spec.seed, 'spin') - 0.5) * 0.12,
    phase: popHash01(spec.seed, 'phase') * Math.PI * 2,
    /** Nurture received this step (0..1) and given (0..∞). */
    nurture: 0,
    given: 0,
    /** Contact neighbours: [{ id, direction (world, unit), amount 0..1 }]. */
    contacts: [],
    /** Panel "freeze growth": AGE held, everything else still live. */
    frozen: false,
  }))
  settleOverlaps(organisms)
  return {
    time: 0,
    step: 0,
    seed: seed | 0,
    options: { ...POPULATION_DEFAULTS, ...options },
    /** Feature toggles (UI). */
    behaviours: true,
    exchange: true,
    lifecycle: true,
    environment: { ...POPULATION_ENV_DEFAULTS },
    organisms,
    /** Active nurture streams: [{ from, to, amount }]. */
    exchanges: [],
    /** Births this session (UI readout). */
    births: 0,
  }
}

/** Push spawn positions apart so no two bodies start interpenetrating. */
function settleOverlaps(organisms, iterations = 80) {
  for (let it = 0; it < iterations; it += 1) {
    let moved = false
    for (let i = 0; i < organisms.length; i += 1) {
      for (let j = i + 1; j < organisms.length; j += 1) {
        const a = organisms[i]
        const b = organisms[j]
        const d = sub(b.position, a.position)
        const dist = len(d) || 1e-6
        const need = (radiusForAge(a.age) + radiusForAge(b.age)) * 1.2
        if (dist >= need) continue
        const push = (need - dist) * 0.5
        for (let k = 0; k < 3; k += 1) {
          a.position[k] -= (d[k] / dist) * push
          b.position[k] += (d[k] / dist) * push
        }
        moved = true
      }
    }
    if (!moved) break
  }
}

function flowAt(p, t, seedOffset) {
  /* Cheap divergence-ish field: rotated sinusoids, slowly evolving. */
  const s = seedOffset
  return [
    Math.sin(p[1] * 0.45 + t * 0.07 + s) + Math.cos(p[2] * 0.38 - t * 0.05),
    Math.sin(p[2] * 0.41 + t * 0.06 + s * 1.7) * 0.45,
    Math.sin(p[0] * 0.33 - t * 0.08 + s * 0.6) + Math.cos(p[1] * 0.5 + t * 0.04),
  ]
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function len(v) {
  return Math.hypot(v[0], v[1], v[2])
}

/**
 * One fixed step. Returns a new population object (organisms copied).
 */
function stepOnce(pop) {
  const o = pop.options
  const env = environmentFactors(pop.environment)
  const dt = POPULATION_DT
  const t = pop.time + dt
  const list = pop.organisms.map((org) => ({
    ...org,
    position: [...org.position],
    velocity: [...org.velocity],
    nurture: 0,
    given: 0,
    contacts: [],
  }))
  const radius = list.map((org) => radiusForAge(org.age))
  const exchanges = []

  /* —— Forces —— */
  const acc = list.map(() => [0, 0, 0])
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i]
    const f = flowAt(a.position, t * (0.6 + 0.4 * env.flow), a.index * 1.31)
    const flow = o.flow * env.flow
    acc[i][0] += f[0] * flow
    acc[i][1] += f[1] * flow
    acc[i][2] += f[2] * flow

    /* Containment: soft ellipsoid wall. */
    const [bx, by, bz] = POPULATION_BOUNDS
    const e = Math.hypot(a.position[0] / bx, a.position[1] / by, a.position[2] / bz)
    if (e > 0.82) {
      const k = (e - 0.82) * o.contain * 6
      acc[i][0] -= (a.position[0] / bx) * k
      acc[i][1] -= (a.position[1] / by) * k
      acc[i][2] -= (a.position[2] / bz) * k
    }

    /* Old bodies drift toward the rim. */
    if (pop.behaviours && a.stage === STAGE.OLD && e < 0.8) {
      const d = len(a.position) || 1
      acc[i][0] += (a.position[0] / d) * o.rimDrift
      acc[i][1] += (a.position[1] / d) * o.rimDrift * 0.4
      acc[i][2] += (a.position[2] / d) * o.rimDrift
    }
  }

  for (let i = 0; i < list.length; i += 1) {
    const a = list[i]
    let nearestMature = -1
    let nearestDist = Infinity
    for (let j = 0; j < list.length; j += 1) {
      if (i === j) continue
      const b = list[j]
      const d = sub(b.position, a.position)
      const dist = len(d) || 1e-6
      const dir = [d[0] / dist, d[1] / dist, d[2] / dist]
      const sumR = radius[i] + radius[j]

      /* Separation — always on, strong inside 1.15 × summed radii. */
      const gap = dist - sumR * 1.15
      if (gap < 0) {
        const k = o.separation * Math.min(2, -gap / sumR + 0.2)
        acc[i][0] -= dir[0] * k
        acc[i][1] -= dir[1] * k
        acc[i][2] -= dir[2] * k
      }

      /* Contact (proximity deformation) — symmetric, both sides record it. */
      const contactR = sumR * o.contactReach
      if (dist < contactR) {
        const amount = Math.min(1, (contactR - dist) / (contactR - sumR * 0.9))
        a.contacts.push({ id: b.id, direction: dir, amount: Number(amount.toFixed(3)) })
      }

      if (!pop.behaviours) continue
      if (b.stage === STAGE.MATURE && dist < nearestDist) {
        nearestDist = dist
        nearestMature = j
      }
      /* Territory between matures. */
      if (a.stage === STAGE.MATURE && b.stage === STAGE.MATURE) {
        const reach = sumR * 2.6
        if (dist < reach) {
          const k = o.territory * (1 - dist / reach)
          acc[i][0] -= dir[0] * k
          acc[i][1] -= dir[1] * k
          acc[i][2] -= dir[2] * k
        }
      }
    }

    /* Young seek the nearest mature and settle just outside contact. */
    if (pop.behaviours && isYoung(a.stage) && nearestMature >= 0) {
      const b = list[nearestMature]
      const d = sub(b.position, a.position)
      const dist = len(d) || 1e-6
      const settle = (radius[i] + radius[nearestMature]) * 1.3
      const k = o.seek * Math.max(-1, Math.min(1, (dist - settle) / settle))
      acc[i][0] += (d[0] / dist) * k
      acc[i][1] += (d[1] / dist) * k
      acc[i][2] += (d[2] / dist) * k
    }
  }

  /* —— Nurture exchange (mature → young within reach) —— */
  if (pop.exchange) {
    for (let i = 0; i < list.length; i += 1) {
      const giver = list[i]
      if (giver.stage !== STAGE.MATURE) continue
      for (let j = 0; j < list.length; j += 1) {
        const taker = list[j]
        if (i === j || !isYoung(taker.stage)) continue
        const dist = len(sub(taker.position, giver.position))
        const reach = (radius[i] + radius[j]) * o.exchangeReach * env.reach
        if (dist >= reach) continue
        /* Strongest at mid-life giver, fades with distance. */
        const vigour = 1 - Math.abs(giver.age - 0.6) / 0.4
        const amount = Math.max(0, (1 - dist / reach) * Math.max(0.25, vigour))
        if (amount < 0.02) continue
        taker.nurture = Math.min(1, taker.nurture + amount)
        giver.given += amount
        exchanges.push({ from: giver.id, to: taker.id, amount: Number(amount.toFixed(3)) })
      }
    }
  }

  /* —— Integrate motion + ageing + lifecycle —— */
  let births = pop.births
  for (let i = 0; i < list.length; i += 1) {
    const org = list[i]
    const v = org.velocity
    const damp = Math.exp(-o.damping * dt)
    v[0] = (v[0] + acc[i][0] * dt) * damp
    v[1] = (v[1] + acc[i][1] * dt) * damp
    v[2] = (v[2] + acc[i][2] * dt) * damp
    const speed = len(v)
    const maxSpeed = o.maxSpeed * env.speed
    if (speed > maxSpeed) {
      v[0] *= maxSpeed / speed
      v[1] *= maxSpeed / speed
      v[2] *= maxSpeed / speed
    }
    org.position[0] += v[0] * dt
    org.position[1] += v[1] * dt
    org.position[2] += v[2] * dt
    org.spin += org.spinRate * dt

    const boost = 1 + org.nurture * (o.nurtureBoost - 1) + org.given * o.giverCost
    const youngFactor = isYoung(org.stage) ? env.youngGrowth : 1
    if (!org.frozen) {
      org.age = Math.min(
        1,
        org.age + o.ageRate * env.metabolism * youngFactor * boost * dt,
      )
    }

    if (pop.lifecycle && org.age >= o.endOfLife) {
      org.generation += 1
      org.seed = generationSeed(org.archetypeSeed, org.generation)
      org.age = o.rebirthAge
      org.position = rimPoint(org.archetypeSeed, org.generation)
      org.velocity = [0, 0, 0]
      births += 1
    }
    org.stage = stageForAge(org.age)
  }

  return {
    ...pop,
    time: t,
    step: pop.step + 1,
    organisms: list,
    exchanges,
    births,
  }
}

/** Advance by wall-clock seconds (fixed DT; catch-up capped). */
export function stepPopulation(pop, elapsedSeconds = POPULATION_DT, maxSteps = 4) {
  if (!pop) return pop
  let next = pop
  const steps = Math.min(maxSteps, Math.floor((Number(elapsedSeconds) || 0) / POPULATION_DT + 1e-6))
  for (let i = 0; i < steps; i += 1) next = stepOnce(next)
  return next
}

/** Run an exact number of fixed steps (tests / fast-forward). */
export function runPopulationSteps(pop, steps) {
  let next = pop
  const n = Math.max(0, Math.floor(Number(steps) || 0))
  for (let i = 0; i < n; i += 1) next = stepOnce(next)
  return next
}

export function setPopulationFlags(pop, { behaviours, exchange, lifecycle } = {}) {
  if (!pop) return pop
  return {
    ...pop,
    behaviours: behaviours ?? pop.behaviours,
    exchange: exchange ?? pop.exchange,
    lifecycle: lifecycle ?? pop.lifecycle,
  }
}

export function setPopulationEnvironment(pop, patch = {}) {
  if (!pop) return pop
  const next = { ...(pop.environment || POPULATION_ENV_DEFAULTS) }
  for (const key of ['temperature', 'moisture', 'turbulence']) {
    if (patch[key] != null && Number.isFinite(Number(patch[key]))) {
      next[key] = clamp01(patch[key])
    }
  }
  return { ...pop, environment: next }
}

function clampRange(value, [min, max]) {
  return Math.min(max, Math.max(min, Number(value)))
}

/**
 * Edit one organism (panel): morphologyType, lobe, sculpt, age, frozen,
 * reseed (true → new individual of the same archetype).
 */
export function setOrganismTraits(pop, id, patch = {}) {
  if (!pop) return pop
  const L = ORGANISM_TRAIT_LIMITS
  const organisms = pop.organisms.map((org) => {
    if (org.id !== id) return org
    const next = { ...org }
    if (patch.morphologyType && Object.values(EXP05_MORPHOLOGY_TYPES).includes(patch.morphologyType)) {
      next.morphologyType = patch.morphologyType
    }
    if (Number.isFinite(Number(patch.lobe))) next.lobe = clampRange(patch.lobe, L.lobe)
    if (Number.isFinite(Number(patch.sculpt))) next.sculpt = clampRange(patch.sculpt, L.sculpt)
    if (Number.isFinite(Number(patch.age))) {
      next.age = clampRange(patch.age, L.age)
      next.stage = stageForAge(next.age)
    }
    if (patch.frozen != null) next.frozen = Boolean(patch.frozen)
    if (patch.reseed) {
      next.reseeds = (org.reseeds || 0) + 1
      next.seed = generationSeed(org.archetypeSeed, 1000 + next.reseeds + org.generation * 37)
    }
    return next
  })
  return { ...pop, organisms }
}
