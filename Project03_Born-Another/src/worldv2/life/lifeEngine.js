import {
  ensureFacingDirection,
  secondaryFacingDirection,
} from '../crystalOrientation.js'

export const LIFE_ENGINE_VERSION = 6
export const LIFE_FIXED_TIMESTEP = 1 / 30
/** Full life in real seconds. AGE stays normalized 0→1 over this span. */
export const LIFE_DURATION_SECONDS = 90
export const LIFE_TOTAL_STEPS = Math.round(
  LIFE_DURATION_SECONDS / LIFE_FIXED_TIMESTEP,
)
export const LIFE_FIELD_REGION_COUNT = 48
export const LIFE_MAX_GROWTH_SITES = 10
export const CRYSTAL_INITIAL_LENGTH = 0.002
export const CRYSTAL_INITIAL_RADIUS = 0.001
export const CRYSTAL_MAX_BRANCH_DEPTH = 1
export const CRYSTAL_BRANCH_MATURITY = 0.38
export const CRYSTAL_BRANCH_MINERAL = 0.42
export const CRYSTAL_BRANCH_MIN_COUNT = 2
export const CRYSTAL_BRANCH_MAX_COUNT = 4

/** Neutral Moisture: growth-rate multiplier = 1 (legacy crystal behavior). */
export const ENV_MOISTURE_NEUTRAL = 0.5
/**
 * Maps Moisture ∈ [0, 1] → crystal length/radius growth multiplier.
 * 0.2 → 0.64, 0.5 → 1.0, 0.8 → 1.36 (bounded experimental band).
 */
export const ENV_MOISTURE_GROWTH_SPAN = 1.2
/** Calm default: no environmental membrane turbulence. */
export const ENV_TURBULENCE_DEFAULT = 0

const FIELD_NEIGHBOR_COUNT = 5
const FIELD_NUCLEATION_THRESHOLD = 0.34
const AUTONOMOUS_SITE_LIMIT = 7

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

/** Crystal growth-rate factor from Moisture. Neutral 0.5 → 1. */
export function moistureGrowthMultiplier(moisture = ENV_MOISTURE_NEUTRAL) {
  return 1 + (clamp01(moisture) - ENV_MOISTURE_NEUTRAL) * ENV_MOISTURE_GROWTH_SPAN
}

/**
 * Moisture reading while parked at `step` (last entry with entry.step ≤ step).
 * Used for UI / state.environment.
 */
export function moistureAtStep(environmentHistory, step) {
  const query = Math.max(0, Math.floor(Number(step) || 0))
  const history = Array.isArray(environmentHistory) ? environmentHistory : []
  let moisture = ENV_MOISTURE_NEUTRAL
  for (const entry of history) {
    const at = Math.floor(Number(entry?.step) || 0)
    if (at > query) break
    if (Number.isFinite(entry?.moisture)) moisture = clamp01(entry.moisture)
  }
  return moisture
}

/**
 * Moisture applied while advancing into `step` (entries with entry.step < step).
 * Matches stimulus timing: a change recorded at step N affects step N+1 onward,
 * so live scrubbing and replayLife stay bit-identical.
 */
export function moistureForGrowthStep(environmentHistory, step) {
  const query = Math.max(0, Math.floor(Number(step) || 0))
  const history = Array.isArray(environmentHistory) ? environmentHistory : []
  let moisture = ENV_MOISTURE_NEUTRAL
  for (const entry of history) {
    const at = Math.floor(Number(entry?.step) || 0)
    if (at >= query) break
    if (Number.isFinite(entry?.moisture)) moisture = clamp01(entry.moisture)
  }
  return moisture
}

/**
 * Turbulence intensity while parked at `step` (last entry with entry.step ≤ step).
 * Membrane response reads the current environment value each apply.
 */
export function turbulenceAtStep(environmentHistory, step) {
  const query = Math.max(0, Math.floor(Number(step) || 0))
  const history = Array.isArray(environmentHistory) ? environmentHistory : []
  let turbulence = ENV_TURBULENCE_DEFAULT
  for (const entry of history) {
    const at = Math.floor(Number(entry?.step) || 0)
    if (at > query) break
    if (Number.isFinite(entry?.turbulence)) turbulence = clamp01(entry.turbulence)
  }
  return turbulence
}

function normalizeEnvironmentHistory(history, totalSteps) {
  const fallback = [
    {
      step: 0,
      moisture: ENV_MOISTURE_NEUTRAL,
      turbulence: ENV_TURBULENCE_DEFAULT,
    },
  ]
  if (!Array.isArray(history) || history.length === 0) return fallback
  const normalized = history
    .map((entry) => ({
      step: Math.min(
        totalSteps,
        Math.max(0, Math.floor(Number(entry?.step) || 0)),
      ),
      moisture: clamp01(
        Number.isFinite(entry?.moisture)
          ? entry.moisture
          : ENV_MOISTURE_NEUTRAL,
      ),
      turbulence: clamp01(
        Number.isFinite(entry?.turbulence)
          ? entry.turbulence
          : ENV_TURBULENCE_DEFAULT,
      ),
    }))
    .sort(
      (a, b) =>
        a.step - b.step ||
        a.moisture - b.moisture ||
        a.turbulence - b.turbulence,
    )
  if (normalized[0]?.step !== 0) {
    return [
      {
        step: 0,
        moisture: ENV_MOISTURE_NEUTRAL,
        turbulence: ENV_TURBULENCE_DEFAULT,
      },
      ...normalized,
    ]
  }
  return normalized
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / Math.max(1e-8, edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function smootherstep(value) {
  const t = clamp01(value)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function normalizeSeed(seed) {
  const value = Math.floor(Number(seed))
  return Number.isFinite(value) ? value >>> 0 : 1
}

function normalizeDirection(direction) {
  const x = Number(direction?.[0]) || 0
  const y = Number(direction?.[1]) || 0
  const z = Number(direction?.[2]) || 0
  const length = Math.hypot(x, y, z) || 1
  // Canonical quantization makes serialization → replay bit-stable.
  const precision = 1e9
  return [x / length, y / length, z / length].map(
    (component) => Math.round(component * precision) / precision,
  )
}

/** Stable random-access hash: simulation results never depend on call order. */
export function lifeHash(seed, step, channel = 0) {
  let value =
    (Math.imul(normalizeSeed(seed) ^ 0x9e3779b9, 747796405) +
      Math.imul((step | 0) + 1, 1597334677) +
      Math.imul((channel | 0) + 1, 3812015801)) >>>
    0
  value = Math.imul(value ^ (value >>> 15), 2246822519) >>> 0
  value = Math.imul(value ^ (value >>> 13), 3266489917) >>> 0
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

function normalizeVector([x, y, z]) {
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}

function rotateFieldDirection(direction, yaw, pitch) {
  const [x, y, z] = direction
  const yawX = x * Math.cos(yaw) + z * Math.sin(yaw)
  const yawZ = -x * Math.sin(yaw) + z * Math.cos(yaw)
  return normalizeVector([
    yawX,
    y * Math.cos(pitch) - yawZ * Math.sin(pitch),
    y * Math.sin(pitch) + yawZ * Math.cos(pitch),
  ])
}

function crystalMaxLength(seed, region) {
  return 0.3 + lifeHash(seed, region, 103) * 0.26
}

function crystalMaxRadius(seed, region) {
  return 0.038 + lifeHash(seed, region, 101) * 0.048
}

function crystalRateMultiplier(seed, region) {
  return 0.55 + lifeHash(seed, region, 97) * 0.9
}

function copyDirection(direction) {
  return [...(direction ?? [0, 1, 0])]
}

function copyCrystalRecord(crystal) {
  if (!crystal) return null
  const direction = copyDirection(
    crystal.direction ?? crystal.growthDirection,
  )
  return {
    ...crystal,
    growthDirection: copyDirection(crystal.growthDirection ?? direction),
    direction,
    branches: Array.isArray(crystal.branches)
      ? crystal.branches.map(copyCrystalRecord)
      : [],
  }
}

function copyPrimaryCrystal(crystal) {
  return copyCrystalRecord(crystal)
}

export function createPrimaryCrystal(state, site, step) {
  const growthDirection = [...site.growthDirection]
  return {
    id: site.id,
    parentId: null,
    parentSiteId: site.id,
    depth: 0,
    bornStep: step,
    growthDirection,
    direction: [...growthDirection],
    length: CRYSTAL_INITIAL_LENGTH,
    growthRate: 0,
    maxLength: crystalMaxLength(state.seed, site.region),
    radius: CRYSTAL_INITIAL_RADIUS,
    branches: [],
  }
}

export function primaryCrystalGrowthRate(
  mineral,
  suitability,
  remaining,
  multiplier,
) {
  // Slower than v3 so a 90s life can spend AGE 0.15–0.40 on primary growth
  // before branching, instead of maturing in a few seconds of wall time.
  return (
    (0.0035 +
      clamp01(mineral) * 0.014 +
      Math.max(0, suitability - 0.7) * 0.006) *
    multiplier *
    Math.max(0, remaining)
  )
}

export function crystalRadiusGrowthRate(
  mineral,
  suitability,
  remainingRadius,
  maturity,
  multiplier,
) {
  // Thickness keeps rising through maturation even when length has nearly peaked.
  const thicken =
    0.0022 +
    clamp01(mineral) * 0.0085 +
    Math.max(0, suitability - 0.7) * 0.003 +
    clamp01(maturity) * 0.0045
  return thicken * multiplier * Math.max(0.08, remainingRadius)
}

function stepPrimaryCrystal(state, site, accumulation, step) {
  const crystal = site.crystal ?? createPrimaryCrystal(state, site, step)
  const mineral = accumulation[site.region]
  const suitability = state.spatial.regions[site.region].suitability
  const remaining =
    1 - crystal.length / Math.max(1e-8, crystal.maxLength)
  const maxRadius = crystalMaxRadius(state.seed, site.region)
  const remainingRadius = 1 - crystal.radius / Math.max(1e-8, maxRadius)
  const moisture = moistureForGrowthStep(state.environmentHistory, step)
  const multiplier =
    crystalRateMultiplier(state.seed, site.region) *
    moistureGrowthMultiplier(moisture)
  const growthRate = primaryCrystalGrowthRate(
    mineral,
    suitability,
    remaining,
    multiplier,
  )
  const maturity = crystalMaturity(crystal)
  const dt = state.fixedTimestep
  const radiusRate = crystalRadiusGrowthRate(
    mineral,
    suitability,
    remainingRadius,
    maturity,
    multiplier,
  )
  return {
    ...crystal,
    parentId: null,
    depth: 0,
    direction: [...crystal.growthDirection],
    growthRate,
    length: Math.min(crystal.maxLength, crystal.length + growthRate * dt),
    radius: Math.min(maxRadius, crystal.radius + radiusRate * dt),
  }
}

function orthonormalFrame(direction) {
  const normal = normalizeVector(direction)
  const reference = Math.abs(normal[1]) > 0.86 ? [1, 0, 0] : [0, 1, 0]
  const tangent = normalizeVector([
    reference[1] * normal[2] - reference[2] * normal[1],
    reference[2] * normal[0] - reference[0] * normal[2],
    reference[0] * normal[1] - reference[1] * normal[0],
  ])
  const bitangent = normalizeVector([
    normal[1] * tangent[2] - normal[2] * tangent[1],
    normal[2] * tangent[0] - normal[0] * tangent[2],
    normal[0] * tangent[1] - normal[1] * tangent[0],
  ])
  return { normal, tangent, bitangent }
}

export function crystalMaturity(crystal) {
  return (
    (Number(crystal?.length) || 0) / Math.max(1e-8, Number(crystal?.maxLength) || 1)
  )
}

/**
 * Integer branch-count shift from Moisture. Neutral 0.5 → 0 (legacy count).
 * ~0.2 → −1, ~0.8 → +1; extremes up to ±2. Clamped later with max depth rules.
 */
export function moistureBranchCountDelta(moisture = ENV_MOISTURE_NEUTRAL) {
  const m = clamp01(moisture)
  if (Math.abs(m - ENV_MOISTURE_NEUTRAL) < 1e-12) return 0
  return Math.round((m - ENV_MOISTURE_NEUTRAL) * (10 / 3))
}

/** Maturity gate; identical to CRYSTAL_BRANCH_MATURITY at Moisture 0.5. */
export function moistureBranchMaturityGate(moisture = ENV_MOISTURE_NEUTRAL) {
  const m = clamp01(moisture)
  if (Math.abs(m - ENV_MOISTURE_NEUTRAL) < 1e-12) return CRYSTAL_BRANCH_MATURITY
  // Dry raises the bar; wet lowers it (bounded).
  return Math.min(
    0.5,
    Math.max(0.28, CRYSTAL_BRANCH_MATURITY - (m - ENV_MOISTURE_NEUTRAL) * 0.267),
  )
}

/** Mineral gate; identical to CRYSTAL_BRANCH_MINERAL at Moisture 0.5. */
export function moistureBranchMineralGate(moisture = ENV_MOISTURE_NEUTRAL) {
  const m = clamp01(moisture)
  if (Math.abs(m - ENV_MOISTURE_NEUTRAL) < 1e-12) return CRYSTAL_BRANCH_MINERAL
  return Math.min(
    0.55,
    Math.max(0.3, CRYSTAL_BRANCH_MINERAL - (m - ENV_MOISTURE_NEUTRAL) * 0.2),
  )
}

export function secondaryBranchCount(
  seed,
  region,
  moisture = ENV_MOISTURE_NEUTRAL,
) {
  const base =
    CRYSTAL_BRANCH_MIN_COUNT +
    Math.floor(
      lifeHash(seed, region, 201) *
        (CRYSTAL_BRANCH_MAX_COUNT - CRYSTAL_BRANCH_MIN_COUNT + 1),
    )
  const delta = moistureBranchCountDelta(moisture)
  if (delta === 0) return base
  return Math.max(0, Math.min(CRYSTAL_BRANCH_MAX_COUNT, base + delta))
}

/**
 * L-system production rule P1 (depth 0 only):
 *   P → P { S_i }  when maturity / mineral gates pass
 * Rewrite fires once. Secondaries never rewrite (max depth 1).
 * Moisture only shifts gates away from neutral; AGE floor and decay stay fixed.
 */
export function canProduceSecondaryBranches(
  crystal,
  mineral,
  decay = 0,
  age = 0,
  moisture = ENV_MOISTURE_NEUTRAL,
) {
  if (!crystal) return false
  if ((crystal.depth ?? 0) >= CRYSTAL_MAX_BRANCH_DEPTH) return false
  if ((crystal.branches?.length ?? 0) > 0) return false
  if (decay > 0.45) return false
  // Prefer the branching phase, but local mineral + maturity still gate the rewrite.
  if (age > 0 && age < 0.4) return false
  return (
    crystalMaturity(crystal) >= moistureBranchMaturityGate(moisture) &&
    clamp01(mineral) >= moistureBranchMineralGate(moisture)
  )
}

export function secondaryCrystalGrowthRate(
  mineral,
  suitability,
  remaining,
  multiplier,
) {
  return primaryCrystalGrowthRate(
    mineral,
    suitability,
    remaining,
    multiplier,
  ) * 0.82
}

function createSecondaryCrystal(state, site, primary, mineral, step, index, count) {
  const parentAxis = primary.growthDirection
  const outward = site.direction
  const { normal, tangent, bitangent } = orthonormalFrame(parentAxis)
  const azimuth =
    ((index + lifeHash(state.seed, site.region, 211 + index)) / count) *
    Math.PI *
    2
  const mineralBias = clamp01(mineral)
  // Tighter splay as mineral rises — a cluster, not a tree fork.
  const tilt =
    0.34 + (1 - mineralBias) * 0.08 + lifeHash(state.seed, site.region, 221 + index) * 0.12
  const radial = [
    tangent[0] * Math.cos(azimuth) + bitangent[0] * Math.sin(azimuth),
    tangent[1] * Math.cos(azimuth) + bitangent[1] * Math.sin(azimuth),
    tangent[2] * Math.cos(azimuth) + bitangent[2] * Math.sin(azimuth),
  ]
  const rawDirection = normalizeDirection([
    normal[0] * Math.cos(tilt) + radial[0] * Math.sin(tilt),
    normal[1] * Math.cos(tilt) + radial[1] * Math.sin(tilt),
    normal[2] * Math.cos(tilt) + radial[2] * Math.sin(tilt),
  ])
  // Stay attached to the parent facing and never point into the membrane.
  const direction = normalizeDirection(
    secondaryFacingDirection(rawDirection, parentAxis, outward),
  )
  const lengthScale =
    0.34 + lifeHash(state.seed, site.region, 231 + index) * 0.2
  const attachT =
    0.32 + lifeHash(state.seed, site.region, 241 + index) * 0.4
  const attachDistance =
    Math.round(primary.length * attachT * 1e9) / 1e9
  const radiusScale =
    0.42 + lifeHash(state.seed, site.region, 261 + index) * 0.18

  return {
    id: site.id * 10 + index + 1,
    parentId: primary.id,
    parentSiteId: site.id,
    depth: 1,
    bornStep: step,
    direction,
    growthDirection: [...direction],
    length: CRYSTAL_INITIAL_LENGTH,
    growthRate: 0,
    maxLength: primary.maxLength * lengthScale,
    radius: CRYSTAL_INITIAL_RADIUS,
    attachDistance,
    roll: lifeHash(state.seed, site.region, 251 + index) * Math.PI * 2,
    maxRadius: crystalMaxRadius(state.seed, site.region) * radiusScale,
    branches: [],
  }
}

export function createSecondaryCrystals(state, site, primary, mineral, step) {
  const moisture = moistureForGrowthStep(state.environmentHistory, step)
  const count = secondaryBranchCount(state.seed, site.region, moisture)
  if (count <= 0) return []
  return Array.from({ length: count }, (_, index) =>
    createSecondaryCrystal(
      state,
      site,
      primary,
      mineral,
      step,
      index,
      count,
    ),
  )
}

function stepSecondaryCrystal(state, site, branch, accumulation, step) {
  const mineral = accumulation[site.region]
  const suitability = state.spatial.regions[site.region].suitability
  const remaining = 1 - branch.length / Math.max(1e-8, branch.maxLength)
  const maxRadius =
    branch.maxRadius ?? crystalMaxRadius(state.seed, site.region) * 0.5
  const remainingRadius = 1 - branch.radius / Math.max(1e-8, maxRadius)
  const moisture = moistureForGrowthStep(state.environmentHistory, step)
  const multiplier =
    crystalRateMultiplier(state.seed, site.region + 17) *
    moistureGrowthMultiplier(moisture)
  const growthRate = secondaryCrystalGrowthRate(
    mineral,
    suitability,
    remaining,
    multiplier,
  )
  const dt = state.fixedTimestep
  const radiusRate = crystalRadiusGrowthRate(
    mineral,
    suitability,
    remainingRadius,
    crystalMaturity(branch),
    multiplier * 0.9,
  )
  return {
    ...branch,
    parentId: branch.parentId ?? site.crystal?.id ?? site.id,
    depth: 1,
    direction: [...(branch.direction ?? branch.growthDirection)],
    growthDirection: [...(branch.growthDirection ?? branch.direction)],
    growthRate,
    length: Math.min(branch.maxLength, branch.length + growthRate * dt),
    radius: Math.min(maxRadius, branch.radius + radiusRate * dt),
    branches: [],
  }
}

function stepSiteCrystal(state, site, accumulation, step) {
  const grown = stepPrimaryCrystal(state, site, accumulation, step)
  const mineral = accumulation[site.region]
  const existing = site.crystal?.branches ?? []
  const moisture = moistureForGrowthStep(state.environmentHistory, step)
  const branches =
    existing.length > 0
      ? existing.map((branch) =>
          stepSecondaryCrystal(state, site, branch, accumulation, step),
        )
      : canProduceSecondaryBranches(
            grown,
            mineral,
            state.variables.decay,
            step / state.totalSteps,
            moisture,
          )
        ? createSecondaryCrystals(state, site, grown, mineral, step)
        : []
  return {
    ...grown,
    branches,
  }
}

function growthDirection(normal, seed, region) {
  const reference =
    Math.abs(normal[1]) > 0.86 ? [1, 0, 0] : [0, 1, 0]
  const tangent = normalizeVector([
    reference[1] * normal[2] - reference[2] * normal[1],
    reference[2] * normal[0] - reference[0] * normal[2],
    reference[0] * normal[1] - reference[1] * normal[0],
  ])
  const bitangent = normalizeVector([
    normal[1] * tangent[2] - normal[2] * tangent[1],
    normal[2] * tangent[0] - normal[0] * tangent[2],
    normal[0] * tangent[1] - normal[1] * tangent[0],
  ])
  const angle = lifeHash(seed, region, 73) * Math.PI * 2
  const tilt = 0.08 + lifeHash(seed, region, 79) * 0.2
  const raw = normalizeVector([
    normal[0] +
      (tangent[0] * Math.cos(angle) + bitangent[0] * Math.sin(angle)) *
        tilt,
    normal[1] +
      (tangent[1] * Math.cos(angle) + bitangent[1] * Math.sin(angle)) *
        tilt,
    normal[2] +
      (tangent[2] * Math.cos(angle) + bitangent[2] * Math.sin(angle)) *
        tilt,
  ])
  return ensureFacingDirection(raw, normal)
}

function createSpatialField(seed) {
  const yaw = lifeHash(seed, 0, 53) * Math.PI * 2
  const pitch = (lifeHash(seed, 0, 59) - 0.5) * 0.72
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const regions = Array.from({ length: LIFE_FIELD_REGION_COUNT }, (_, index) => {
    const y = 1 - ((index + 0.5) / LIFE_FIELD_REGION_COUNT) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const angle = index * goldenAngle
    const direction = rotateFieldDirection(
      [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
      yaw,
      pitch,
    )
    return {
      direction,
      suitability: 0.72 + lifeHash(seed, index, 61) * 0.56,
      neighbors: [],
    }
  })

  for (let index = 0; index < regions.length; index += 1) {
    const direction = regions[index].direction
    regions[index].neighbors = regions
      .map((region, candidate) => ({
        candidate,
        dot:
          direction[0] * region.direction[0] +
          direction[1] * region.direction[1] +
          direction[2] * region.direction[2],
      }))
      .filter(({ candidate }) => candidate !== index)
      .sort((a, b) => b.dot - a.dot || a.candidate - b.candidate)
      .slice(0, FIELD_NEIGHBOR_COUNT)
      .map(({ candidate }) => candidate)
  }

  return {
    regions,
    accumulation: regions.map(
      (_, index) => 0.018 + lifeHash(seed, index, 67) * 0.045,
    ),
    sites: [],
  }
}

function nearestFieldRegion(spatial, direction) {
  const normalized = normalizeDirection(direction)
  let nearest = 0
  let nearestDot = -Infinity
  for (let index = 0; index < spatial.regions.length; index += 1) {
    const candidate = spatial.regions[index].direction
    const dot =
      normalized[0] * candidate[0] +
      normalized[1] * candidate[1] +
      normalized[2] * candidate[2]
    if (dot > nearestDot) {
      nearest = index
      nearestDot = dot
    }
  }
  return nearest
}

export function findLifeFieldRegion(state, direction) {
  if (!state?.spatial) return null
  const region = nearestFieldRegion(state.spatial, direction)
  return {
    region,
    direction: [...state.spatial.regions[region].direction],
  }
}

function normalizeHistory(history, totalSteps) {
  if (!Array.isArray(history)) return []
  return history
    .map((entry, index) => ({
      id: Number.isFinite(entry?.id) ? Math.floor(entry.id) : index,
      step: Math.min(
        totalSteps,
        Math.max(0, Math.floor(Number(entry?.step) || 0)),
      ),
      direction: normalizeDirection(entry?.direction),
      region: Number.isFinite(entry?.region)
        ? Math.floor(entry.region)
        : null,
      strength: clamp01(entry?.strength ?? 1),
    }))
    .sort((a, b) => a.step - b.step || a.id - b.id)
}

function stimulusResponse(entry, step) {
  if (step <= entry.step) return 0
  const elapsed = (step - entry.step) * LIFE_FIXED_TIMESTEP
  return smootherstep(elapsed / 4.2)
}

function activeStimulusMemory(history, step) {
  let total = 0
  for (const entry of history) {
    total += stimulusResponse(entry, step) * entry.strength
  }
  return Math.min(1, total * 0.24)
}

function stimulusAtRegion(history, step, direction) {
  let influence = 0
  for (const entry of history) {
    const response = stimulusResponse(entry, step)
    const dot =
      direction[0] * entry.direction[0] +
      direction[1] * entry.direction[1] +
      direction[2] * entry.direction[2]
    const distance = 1 - Math.max(-1, Math.min(1, dot))
    const falloff = Math.exp(-(distance * distance) / 0.012)
    influence += response * entry.strength * falloff
  }
  return Math.min(1.5, influence)
}

function stepSpatialField(state, step, growth) {
  const previous = state.spatial
  const accumulation = previous.accumulation.map((value, index) => {
    const region = previous.regions[index]
    let neighborPeak = value
    for (const neighbor of region.neighbors) {
      neighborPeak = Math.max(neighborPeak, previous.accumulation[neighbor])
    }
    const propagation = Math.max(0, neighborPeak - value) * 0.18
    // Slightly faster early mineral so primaries can appear in AGE ~0.15–0.25.
    const autonomous = (0.0075 + growth * 0.02) * region.suitability
    const stimulus =
      stimulusAtRegion(state.history, step, region.direction) * 0.052
    return Math.min(
      1,
      value + (autonomous + propagation + stimulus) * state.fixedTimestep,
    )
  })

  const occupied = new Set(previous.sites.map((site) => site.region))
  const available = LIFE_MAX_GROWTH_SITES - previous.sites.length
  const autonomousSites = previous.sites.filter(
    (site) => site.cause !== 'stimulus',
  ).length
  const candidates = accumulation
    .map((value, region) => {
      const stimulus = stimulusAtRegion(
        state.history,
        step,
        previous.regions[region].direction,
      )
      return {
        region,
        value,
        stimulus,
        stimulated: stimulus >= 0.08,
      }
    })
    .filter(
      ({ region, value, stimulated }) =>
        value >= FIELD_NUCLEATION_THRESHOLD &&
        !occupied.has(region) &&
        (stimulated || autonomousSites < AUTONOMOUS_SITE_LIMIT),
    )
    .sort(
      (a, b) =>
        Number(b.stimulated) - Number(a.stimulated) ||
        b.stimulus - a.stimulus ||
        b.value - a.value ||
        a.region - b.region,
    )
    .slice(0, Math.min(1, Math.max(0, available)))

  const nucleated = candidates.map(({ region, stimulated }, offset) => {
    const normal = previous.regions[region].direction
    const site = {
      id: previous.sites.length + offset,
      region,
      bornStep: step,
      cause: stimulated ? 'stimulus' : 'autonomous',
      direction: [...normal],
      growthDirection: growthDirection(normal, state.seed, region),
      roll: lifeHash(state.seed, region, 83) * Math.PI * 2,
      scale: 0.72 + lifeHash(state.seed, region, 89) * 0.56,
    }
    return {
      ...site,
      crystal: createPrimaryCrystal(state, site, step),
    }
  })

  const sites = [...previous.sites, ...nucleated].map((site) => ({
    ...site,
    crystal: stepSiteCrystal(state, site, accumulation, step),
  }))

  return { ...previous, accumulation, sites }
}

function deriveOutputs(state) {
  const { age, variables, history, spatial, step } = state
  const vitality =
    smoothstep(0, 0.1, age) * (1 - smoothstep(0.72, 1, age))
  const localDeformations = history.map((entry) => {
    const response = stimulusResponse(entry, step)
    return {
      id: entry.id,
      direction: entry.direction,
      response,
      radius: 0.24 + lifeHash(state.seed, entry.id, 41) * 0.12,
      deformation:
        response *
        entry.strength *
        (0.09 + variables.growth * 0.16) *
        (1 - variables.decay * 0.3),
      mineralBoost: response * entry.strength * 0.32,
    }
  })

  const sources = localDeformations.map((entry) => ({
    id: entry.id,
    direction: entry.direction,
    influence: entry.response,
  }))

  return {
    /**
     * Stable adapters for the procedural techniques developed in the Studies.
     * Phase 1 consumes only `form` and `surface`; the others define later seams.
     */
    form: {
      scale: 0.82 + variables.growth * 0.22 - variables.decay * 0.08,
      vitality,
      integrity: 1 - variables.decay * 0.78,
      localDeformations,
    },
    surface: {
      distributionSeed: state.seed ^ 0x51c3a7,
      mineralGrowth: variables.mineral,
      mineralSites: localDeformations.map((entry) => ({
        direction: entry.direction,
        boost: entry.mineralBoost,
      })),
      spatialGrowthSites: spatial.sites.map((site) => ({
        ...site,
        direction: [...site.direction],
        growthDirection: [...site.growthDirection],
        crystal: copyPrimaryCrystal(site.crystal),
      })),
    },
    path: {
      propagation: variables.growth * (1 - variables.decay),
      sources,
    },
    particle: {
      flowStrength: vitality * (0.35 + variables.growth * 0.65),
      turbulence: 0.18 + variables.memory * 0.32,
      sources,
    },
    branching: {
      reveal: variables.growth,
      decay: variables.decay,
      attractors: sources,
    },
    material: {
      maturation: variables.growth,
      mineralization: variables.mineral,
      decay: variables.decay,
      integrity: 1 - variables.decay * 0.78,
    },
  }
}

function withDerivedState(state) {
  return { ...state, outputs: deriveOutputs(state) }
}

export function createLifeState({
  seed = 7319,
  history = [],
  environmentHistory = [],
  durationSeconds = LIFE_DURATION_SECONDS,
} = {}) {
  const duration = Math.max(
    LIFE_FIXED_TIMESTEP,
    Number(durationSeconds) || LIFE_DURATION_SECONDS,
  )
  const totalSteps = Math.max(1, Math.round(duration / LIFE_FIXED_TIMESTEP))
  const normalizedSeed = normalizeSeed(seed)
  const spatial = createSpatialField(normalizedSeed)
  const normalizedHistory = normalizeHistory(history, totalSteps).map(
    (entry) => {
      // Number.isFinite: null >= 0 is true in JS and would keep region=null.
      const region =
        Number.isFinite(entry.region) &&
        entry.region >= 0 &&
        entry.region < spatial.regions.length
          ? entry.region
          : nearestFieldRegion(spatial, entry.direction)
      return {
        ...entry,
        region,
        direction: [...spatial.regions[region].direction],
      }
    },
  )
  const envHistory = normalizeEnvironmentHistory(
    environmentHistory,
    totalSteps,
  )
  const moisture = moistureAtStep(envHistory, 0)
  const turbulence = turbulenceAtStep(envHistory, 0)
  return withDerivedState({
    version: LIFE_ENGINE_VERSION,
    seed: normalizedSeed,
    durationSeconds: duration,
    totalSteps,
    fixedTimestep: LIFE_FIXED_TIMESTEP,
    step: 0,
    time: 0,
    age: 0,
    dead: false,
    variables: {
      growth: 0,
      mineral: 0,
      decay: 0,
      memory: 0,
    },
    history: normalizedHistory,
    environment: { moisture, turbulence },
    environmentHistory: envHistory,
    spatial,
  })
}

export function stepLife(state) {
  if (!state || state.dead || state.step >= state.totalSteps) return state

  const nextStep = Math.min(state.totalSteps, state.step + 1)
  const age = nextStep / state.totalSteps
  const dt = state.fixedTimestep
  const memoryTarget = activeStimulusMemory(state.history, nextStep)
  const autonomousVariation = lifeHash(state.seed, nextStep, 7) - 0.5

  // Organism-level envelopes follow the developmental phases:
  // birth → primary → branching → maturation → late decay.
  const growthWindow = 1 - smoothstep(0.82, 0.95, age)
  const growthRate =
    (0.028 + autonomousVariation * 0.008 + memoryTarget * 0.016) *
    growthWindow *
    (1 - state.variables.growth)
  const growth = clamp01(state.variables.growth + growthRate * dt)

  const mineralRate =
    (0.01 + growth * 0.018 + memoryTarget * 0.014) *
    (1 - state.variables.mineral * 0.72)
  const mineral = clamp01(state.variables.mineral + mineralRate * dt)

  const decayWindow = smoothstep(0.88, 0.97, age)
  const decayRate =
    (0.07 + lifeHash(state.seed, nextStep, 19) * 0.02) *
    decayWindow *
    (1 - state.variables.decay)
  const decay = clamp01(state.variables.decay + decayRate * dt)

  // Memory can only accumulate. Stimuli therefore affect all subsequent stages.
  const memory = Math.max(state.variables.memory, memoryTarget)
  const spatial = stepSpatialField(state, nextStep, growth)
  const dead = nextStep >= state.totalSteps
  const moisture = moistureAtStep(state.environmentHistory, nextStep)
  const turbulence = turbulenceAtStep(state.environmentHistory, nextStep)

  return withDerivedState({
    ...state,
    step: nextStep,
    time: nextStep * dt,
    age: dead ? 1 : age,
    dead,
    variables: { growth, mineral, decay: dead ? 1 : decay, memory },
    environment: { moisture, turbulence },
    spatial,
  })
}

export function runLifeSteps(state, count = 1) {
  let next = state
  const steps = Math.max(0, Math.floor(Number(count) || 0))
  for (let index = 0; index < steps && !next.dead; index += 1) {
    next = stepLife(next)
  }
  return next
}

export function addLifeStimulus(state, direction, strength = 1) {
  if (!state || state.dead) return state
  const mapped = findLifeFieldRegion(state, direction)
  const entry = {
    id: state.history.reduce((max, item) => Math.max(max, item.id), -1) + 1,
    step: state.step,
    region: mapped.region,
    direction: mapped.direction,
    strength: clamp01(strength),
  }
  return withDerivedState({
    ...state,
    history: [...state.history, entry],
  })
}

function currentEnvEntry(state) {
  return {
    moisture: moistureAtStep(state.environmentHistory, state.step),
    turbulence: turbulenceAtStep(state.environmentHistory, state.step),
  }
}

function writeEnvHistory(state, patch) {
  const current = currentEnvEntry(state)
  const next = {
    moisture: Number.isFinite(patch.moisture) ? clamp01(patch.moisture) : current.moisture,
    turbulence: Number.isFinite(patch.turbulence)
      ? clamp01(patch.turbulence)
      : current.turbulence,
  }
  const history = [...(state.environmentHistory ?? [])]
  const last = history[history.length - 1]
  if (last && last.step === state.step) {
    history[history.length - 1] = { step: state.step, ...next }
  } else {
    history.push({ step: state.step, ...next })
  }
  return {
    environment: next,
    environmentHistory: history,
  }
}

/**
 * Record Moisture at the current life step (piecewise-constant env history).
 * Crystal length/radius already grown is kept; only future growth rates change.
 */
export function setLifeMoisture(state, moisture) {
  if (!state || state.dead) return state
  const next = clamp01(moisture)
  const current = moistureAtStep(state.environmentHistory, state.step)
  if (Math.abs(current - next) < 1e-9) {
    return withDerivedState({
      ...state,
      environment: {
        moisture: next,
        turbulence: state.environment?.turbulence ?? ENV_TURBULENCE_DEFAULT,
      },
    })
  }
  return withDerivedState({
    ...state,
    ...writeEnvHistory(state, { moisture: next }),
  })
}

/**
 * Environmental Turbulence (membrane field). Updates immediately for reversible
 * response and records history for AGE scrub / replay. Does not alter crystals.
 */
export function setLifeTurbulence(state, turbulence) {
  if (!state || state.dead) return state
  const next = clamp01(turbulence)
  const current = turbulenceAtStep(state.environmentHistory, state.step)
  if (Math.abs(current - next) < 1e-9) {
    return withDerivedState({
      ...state,
      environment: {
        moisture: state.environment?.moisture ?? ENV_MOISTURE_NEUTRAL,
        turbulence: next,
      },
    })
  }
  return withDerivedState({
    ...state,
    ...writeEnvHistory(state, { turbulence: next }),
  })
}

/**
 * Lab compare helper: treat Moisture as constant from birth and rebuild the
 * organism at the current AGE (same seed + stimulus history).
 * Used by Playground Crystal Moisture scrub so 0.2 / 0.5 / 0.8 are visible
 * without requiring a manual Restart.
 */
export function applyLifeMoistureFromBirth(state, moisture) {
  if (!state || state.dead) return state
  const next = clamp01(moisture)
  const turbulence =
    state.environment?.turbulence ?? ENV_TURBULENCE_DEFAULT
  return replayLife({
    seed: state.seed,
    history: state.history,
    environmentHistory: [{ step: 0, moisture: next, turbulence }],
    durationSeconds: state.durationSeconds,
    step: state.step,
  })
}

/**
 * Replay boundary: Seed + stimulus history + environment history + step
 * → exact state (including accumulated crystal geometry).
 */
export function replayLife({
  seed,
  history = [],
  environmentHistory = [],
  step = 0,
  durationSeconds = LIFE_DURATION_SECONDS,
} = {}) {
  const initial = createLifeState({
    seed,
    history,
    environmentHistory,
    durationSeconds,
  })
  return runLifeSteps(initial, Math.min(initial.totalSteps, Math.max(0, step)))
}

export function lifeSnapshot(state) {
  return {
    version: state.version,
    seed: state.seed,
    step: state.step,
    age: state.age,
    dead: state.dead,
    variables: { ...state.variables },
    environment: {
      moisture: state.environment?.moisture ?? ENV_MOISTURE_NEUTRAL,
      turbulence: state.environment?.turbulence ?? ENV_TURBULENCE_DEFAULT,
    },
    environmentHistory: (state.environmentHistory ?? []).map((entry) => ({
      step: entry.step,
      moisture: entry.moisture,
      turbulence: entry.turbulence ?? ENV_TURBULENCE_DEFAULT,
    })),
    history: state.history.map((entry) => ({
      ...entry,
      direction: [...entry.direction],
    })),
    spatial: {
      accumulation: [...state.spatial.accumulation],
      sites: state.spatial.sites.map((site) => ({
        ...site,
        direction: [...site.direction],
        growthDirection: [...site.growthDirection],
        crystal: copyPrimaryCrystal(site.crystal),
      })),
    },
    outputs: state.outputs,
  }
}
