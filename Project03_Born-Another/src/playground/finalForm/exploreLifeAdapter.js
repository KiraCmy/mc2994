/**
 * Life Engine → Explore visual adapter.
 * B1: AGE + Seed → Specimen / Scatter params / Particle seed.
 * B2: spatialGrowthSites → petal cluster plan (WHERE / WHEN).
 * Explore shaders & GrowthCluster geometry still decide HOW petals look.
 */
import { crystalMaturity } from '../../worldv2/life/lifeEngine.js'
import { INITIAL_PARTICLE } from '../../particle/particleParams.js'
import {
  INITIAL_SCATTER,
  scatterCountFromDensity,
} from '../../scatter/scatterParams.js'
import { particleCountFromLabDensity } from './exp05LabParams.js'
import {
  INITIAL_DECAY,
  INITIAL_DEVELOPMENT,
  INITIAL_INDIVIDUALITY,
  INITIAL_LAYERED,
  INITIAL_MATERIAL,
  INITIAL_SURFACE,
  INITIAL_TRACE,
} from '../../surfaceParams.js'

/** Exp05 organism identity — Explore visual seed family, independent of World page. */
export const EXP05_LIFE_SEED = INITIAL_INDIVIDUALITY.seed

/** Park AGE for observation (matches Stage A Original Explore). */
export const EXP05_OBSERVE_AGE = 0.45

/** Angular half-width (radians) of petal clusters around each growth site. */
export const PETAL_SITE_CONE = 0.34

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / Math.max(1e-8, edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function normalizeSeed(seed) {
  const n = Number(seed)
  if (!Number.isFinite(n)) return EXP05_LIFE_SEED
  return Math.abs(Math.floor(n)) % 2147483647 || EXP05_LIFE_SEED
}

function mulberry32(seed) {
  let t = seed >>> 0
  return function next() {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function normalizeDirection(direction) {
  const x = Number(direction?.[0]) || 0
  const y = Number(direction?.[1]) || 0
  const z = Number(direction?.[2]) || 0
  const len = Math.hypot(x, y, z) || 1
  return [x / len, y / len, z / len]
}

function orthonormalFrame(direction) {
  const normal = normalizeDirection(direction)
  const reference = Math.abs(normal[1]) > 0.86 ? [1, 0, 0] : [0, 1, 0]
  const tangent = normalizeDirection([
    reference[1] * normal[2] - reference[2] * normal[1],
    reference[2] * normal[0] - reference[0] * normal[2],
    reference[0] * normal[1] - reference[1] * normal[0],
  ])
  const bitangent = normalizeDirection([
    normal[1] * tangent[2] - normal[2] * tangent[1],
    normal[2] * tangent[0] - normal[0] * tangent[2],
    normal[0] * tangent[1] - normal[1] * tangent[0],
  ])
  return { normal, tangent, bitangent }
}

/**
 * Deterministic particle sample seed derived from Life seed.
 */
export function particleSeedFromLifeSeed(lifeSeed) {
  return (normalizeSeed(lifeSeed) ^ 0x44017) >>> 0
}

/**
 * Sample unit-sphere directions in a cone around a growth-site normal.
 * Explore Scatter still places rest poses on the sphere; Life only chooses the region.
 */
export function samplePetalsAroundSite({
  direction,
  count,
  seed,
  siteId,
  coneAngle = PETAL_SITE_CONE,
  radius = 1,
}) {
  const n = Math.max(0, Math.floor(count))
  const rand = mulberry32((normalizeSeed(seed) ^ Math.imul(siteId + 1, 2654435761)) >>> 0)
  const { normal, tangent, bitangent } = orthonormalFrame(direction)
  const samples = new Array(n)

  for (let i = 0; i < n; i += 1) {
    const azimuth = rand() * Math.PI * 2
    const polar = Math.sqrt(rand()) * coneAngle
    const sp = Math.sin(polar)
    const cp = Math.cos(polar)
    const ca = Math.cos(azimuth)
    const sa = Math.sin(azimuth)
    let x = normal[0] * cp + (tangent[0] * ca + bitangent[0] * sa) * sp
    let y = normal[1] * cp + (tangent[1] * ca + bitangent[1] * sa) * sp
    let z = normal[2] * cp + (tangent[2] * ca + bitangent[2] * sa) * sp
    const inv = 1 / (Math.hypot(x, y, z) || 1)
    x *= inv
    y *= inv
    z *= inv
    samples[i] = {
      position: [x * radius, y * radius, z * radius],
      normal: [x, y, z],
      siteId,
      localIndex: i,
    }
  }
  return samples
}

/**
 * Map Life spatialGrowthSites → petal instances for ExploreLifeScatter.
 * WHERE/WHEN from Life; HOW (geometry/shaders) remains Explore.
 *
 * @param {object} life
 * @param {{ density?: number, size?: number }} [options]
 */
export function mapLifeGrowthSitesToPetalPlan(life, options = {}) {
  const density =
    options.density ?? INITIAL_SCATTER.density
  const baseSize = options.size ?? INITIAL_SCATTER.size
  const seed = normalizeSeed(life?.seed ?? EXP05_LIFE_SEED)
  const step = Math.max(0, Number(life?.step) || 0)
  const totalSteps = Math.max(1, Number(life?.totalSteps) || 1)
  const sites = life?.outputs?.surface?.spatialGrowthSites ?? []

  if (sites.length === 0) {
    return {
      instances: [],
      siteCount: 0,
      petalCount: 0,
      seed,
    }
  }

  const exploreTotal = scatterCountFromDensity(density)
  const basePerSite = Math.max(
    10,
    Math.round(exploreTotal / Math.max(1, sites.length)),
  )

  const instances = []
  let globalIndex = 0

  for (let s = 0; s < sites.length; s += 1) {
    const site = sites[s]
    const siteId = Number.isFinite(site?.id) ? site.id : s
    const maturity = clamp01(crystalMaturity(site?.crystal))
    const bornStep = Number.isFinite(site?.bornStep) ? site.bornStep : 0
    const siteAge = clamp01((step - bornStep) / totalSteps)
    /* Independent reveal: local age since nucleation + crystal maturity. */
    const reveal =
      smoothstep(0, 0.04, siteAge) * smoothstep(0.02, 0.28, maturity)
    if (reveal < 0.04) continue

    const siteIdentityScale = 0.72 + (Number(site?.scale) || 1) * 0.28
    const maturityScale = 0.28 + maturity * 1.05
    const siteScale = baseSize * siteIdentityScale * maturityScale * reveal

    const count = Math.max(
      0,
      Math.round(basePerSite * (0.22 + 0.78 * maturity) * reveal),
    )
    if (count <= 0) continue

    const samples = samplePetalsAroundSite({
      direction: site.direction ?? site.growthDirection,
      count,
      seed,
      siteId,
      coneAngle: PETAL_SITE_CONE,
    })

    const rand = mulberry32((seed ^ Math.imul(siteId + 17, 1597334677)) >>> 0)
    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i]
      const jitter = 0.55 + rand() * 0.95
      instances.push({
        /* Unit direction — World surface evaluator resolves deformed seat. */
        direction: sample.normal,
        position: sample.position,
        normal: sample.normal,
        index: globalIndex,
        siteId,
        maturity,
        reveal,
        scale: siteScale * jitter,
      })
      globalIndex += 1
    }
  }

  return {
    instances,
    siteCount: sites.length,
    petalCount: instances.length,
    seed,
  }
}

/**
 * Map one Life Engine snapshot → Explore Specimen / Particle props + petal plan.
 * Optional `lab` (Exp05 Final Form Lab) overrides petal/particle visuals only —
 * does not reset Life AGE / Seed / growth sites.
 *
 * @param {object} life — createLifeState / stepLife snapshot
 * @param {object} [lab] — from normalizeExp05LabParams
 */
export function mapLifeToExploreVisual(life, lab = null) {
  const age = clamp01(life?.age)
  const seed = normalizeSeed(life?.seed ?? EXP05_LIFE_SEED)
  const isDead = Boolean(life?.dead) || age >= 1
  const petalDensity = lab?.petalDensity ?? INITIAL_SCATTER.density
  const petalScale = lab?.petalScale ?? INITIAL_SCATTER.size
  const particleMotion = clamp01(
    lab?.particleMotion ?? INITIAL_PARTICLE.pulseStrength,
  )
  const particleCount =
    lab && Number.isFinite(lab.particleDensity)
      ? particleCountFromLabDensity(lab.particleDensity)
      : INITIAL_PARTICLE.count

  const petalPlan = mapLifeGrowthSitesToPetalPlan(life, {
    density: petalDensity,
    size: petalScale,
  })

  return {
    age,
    seed,
    isDead,
    surface: { ...INITIAL_SURFACE },
    individuality: {
      ...INITIAL_INDIVIDUALITY,
      seed,
    },
    development: {
      ...INITIAL_DEVELOPMENT,
      age,
    },
    decay: {
      ...INITIAL_DECAY,
      age,
    },
    trace: { ...INITIAL_TRACE },
    material: { ...INITIAL_MATERIAL },
    layered: { ...INITIAL_LAYERED },
    scatter: {
      ...INITIAL_SCATTER,
      seed,
      density: petalDensity,
      size: petalScale,
    },
    particle: {
      ...INITIAL_PARTICLE,
      seed: particleSeedFromLifeSeed(seed),
      count: particleCount,
      pulseStrength: particleMotion,
      fieldComplexity: particleMotion,
    },
    petalPlan,
    preserved: null,
  }
}
