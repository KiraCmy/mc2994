/**
 * Phase C1/C2 — Exp05 Shared World Surface Evaluator.
 *
 * Single geometry authority for body, petals, and particles.
 * World radiusAt is expressed in Explore framing units by dividing by
 * ORGANISM_BIRTH_RADIUS (birth sphere ≈ unit sphere — not an arbitrary fit scale).
 */
import * as THREE from 'three'
import { createWorldGeometry } from '../../worldv2/worldGeometry.js'
import {
  deformRadialPoint,
  formMorphAmount,
  morphRestRadius,
  ORGANISM_BIRTH_RADIUS,
} from '../../worldv2/life/worldLifeAdapter.js'
import { sampleTurbulenceFromLife } from '../../worldv2/turbulenceField.js'
import { EXP05_LIFE_SEED } from './exploreLifeAdapter.js'
import {
  calibrateRestRadius,
  clampMorphAmplitude,
  estimateRadiusAtMean,
} from './exp05MorphologyCalibration.js'
import {
  createExp05MorphologyRadiusAt,
  EXP05_DEFAULT_MORPHOLOGY_TYPE,
  normalizeExp05MorphologyType,
} from './exp05MorphologyTypes.js'
import {
  EXP05_ENV_TEMPERATURE_NEUTRAL,
  normalizeExp05Temperature,
  prepareExp05TemperatureSurface,
} from './exp05EnvironmentCoupling.js'
import {
  applyExp05SculpturalOffset,
  createExp05SculpturalSampler,
  normalizeExp05SculpturalStrength,
} from './exp05SculpturalDeformation.js'

const _dir = new THREE.Vector3()
const _scratchA = new THREE.Vector3()
const _scratchB = new THREE.Vector3()
const _scratchC = new THREE.Vector3()

/** Angular epsilon (unit-sphere) for finite-difference normals. */
const NORMAL_EPS = 0.04

/** Birth sphere maps to radius 1 in Exp05 / Explore framing. */
export const EXP05_SURFACE_UNIT = ORGANISM_BIRTH_RADIUS

function normalizeSeed(seed) {
  const n = Number(seed)
  if (!Number.isFinite(n)) return EXP05_LIFE_SEED
  return Math.abs(Math.floor(n)) % 2147483647 || EXP05_LIFE_SEED
}

function normalizeDirectionArray(direction) {
  const x = Number(direction?.[0]) || 0
  const y = Number(direction?.[1]) || 0
  const z = Number(direction?.[2]) || 0
  const len = Math.hypot(x, y, z) || 1
  return [x / len, y / len, z / len]
}

function toVector3(direction, target = _dir) {
  if (direction && typeof direction.x === 'number') {
    const len = Math.hypot(direction.x, direction.y, direction.z) || 1
    return target.set(direction.x / len, direction.y / len, direction.z / len)
  }
  const [x, y, z] = normalizeDirectionArray(direction)
  return target.set(x, y, z)
}

function orthonormalTangentBitangent(nx, ny, nz) {
  const reference = Math.abs(ny) > 0.86 ? [1, 0, 0] : [0, 1, 0]
  let tx = reference[1] * nz - reference[2] * ny
  let ty = reference[2] * nx - reference[0] * nz
  let tz = reference[0] * ny - reference[1] * nx
  let tLen = Math.hypot(tx, ty, tz) || 1
  tx /= tLen
  ty /= tLen
  tz /= tLen
  const bx = ny * tz - nz * ty
  const by = nz * tx - nx * tz
  const bz = nx * ty - ny * tx
  const bLen = Math.hypot(bx, by, bz) || 1
  return {
    tangent: [tx, ty, tz],
    bitangent: [bx / bLen, by / bLen, bz / bLen],
  }
}

/**
 * Explore-framed radiusAt (birth ≈ 1).
 * morphologyType: world | segmented | spiral (Exp05-only).
 */
export function createExp05RadiusAt(
  seed = EXP05_LIFE_SEED,
  morphologyType = EXP05_DEFAULT_MORPHOLOGY_TYPE,
) {
  return createExp05MorphologyRadiusAt(seed, morphologyType)
}

/**
 * Mesh whose rest field is already in Explore framing units.
 * Rest silhouette follows morphologyType; Life morph/deform stay radial on top.
 */
export function createExp05WorldGeometry(
  seed = EXP05_LIFE_SEED,
  morphologyType = EXP05_DEFAULT_MORPHOLOGY_TYPE,
) {
  const normalized = normalizeSeed(seed)
  const type = normalizeExp05MorphologyType(morphologyType)
  const radiusAt = createExp05MorphologyRadiusAt(normalized, type)
  return createWorldGeometry(normalized, { radiusAt })
}

function scaleDeformations(deformations, scale) {
  const amount = clampMorphAmplitude(scale, 1)
  if (amount === 1) return deformations ?? []
  return (deformations ?? []).map((entry) => ({
    ...entry,
    deformation: (Number(entry.deformation) || 0) * amount,
  }))
}

/**
 * Pure evaluation: direction + Life → Explore-framed surface sample.
 *
 * @param {{
 *   finiteDifferenceNormal?: boolean,
 *   morphStrength?: number,
 *   deformationStrength?: number,
 *   lobeAmplitude?: number,
 *   restMean?: number,
 *   temperature?: number,
 *   sampleTemperatureOffset?: (x:number,y:number,z:number) => number,
 *   deformLife?: object,
 *   sculpturalStrength?: number,
 *   sculpturalSampler?: { sampleOffset: Function },
 * }} [options]
 */
export function evaluateExp05SurfacePoint(
  direction,
  life,
  radiusAt,
  options = {},
) {
  if (!life || typeof radiusAt !== 'function') return null

  const dir = toVector3(direction, _dir)
  /* 0 is valid — do not coerce with || 1 (that desyncs petals from body). */
  const morphRaw = Number(options.morphStrength)
  const deformRaw = Number(options.deformationStrength)
  const morphStrength = Math.min(
    1.5,
    Math.max(0, Number.isFinite(morphRaw) ? morphRaw : 1),
  )
  const deformationStrength = clampMorphAmplitude(
    Number.isFinite(deformRaw) ? deformRaw : 1,
    1,
  )
  const lobeAmplitude = clampMorphAmplitude(
    options.lobeAmplitude,
    1,
  )
  const temperature = normalizeExp05Temperature(
    options.temperature ?? EXP05_ENV_TEMPERATURE_NEUTRAL,
  )
  const sculpturalStrength = normalizeExp05SculpturalStrength(
    options.sculpturalStrength,
  )

  let deformLife = options.deformLife
  let sampleTemperatureOffset = options.sampleTemperatureOffset
  if (!deformLife || typeof sampleTemperatureOffset !== 'function') {
    const prepared = prepareExp05TemperatureSurface(life, {
      temperature,
      seed: life.seed,
    })
    deformLife = prepared.life
    sampleTemperatureOffset = prepared.sampleTemperatureOffset
  }

  const morph =
    formMorphAmount(life.variables?.growth ?? 0) * morphStrength
  const nativeRestRadius = radiusAt(dir)
  if (!Number.isFinite(nativeRestRadius)) return null

  const restMean = Number.isFinite(options.restMean)
    ? options.restMean
    : nativeRestRadius
  const restRadius = calibrateRestRadius(
    nativeRestRadius,
    restMean,
    lobeAmplitude,
  )

  /* Single morph pass (morphRestRadius only — no second morphRestPoint). */
  const shapedRadius = morphRestRadius(restRadius, morph)
  const shapedPoint = [
    dir.x * shapedRadius,
    dir.y * shapedRadius,
    dir.z * shapedRadius,
  ]
  const turbulence = sampleTurbulenceFromLife(
    shapedPoint[0],
    shapedPoint[1],
    shapedPoint[2],
    life,
  )
  const temperatureOffset = sampleTemperatureOffset(
    shapedPoint[0],
    shapedPoint[1],
    shapedPoint[2],
  )
  const extra = turbulence + (Number(temperatureOffset) || 0)
  const deformations = scaleDeformations(
    deformLife.outputs?.form?.localDeformations,
    deformationStrength,
  )
  let position = deformRadialPoint(
    shapedPoint[0],
    shapedPoint[1],
    shapedPoint[2],
    deformations,
    extra,
  )

  /* Optional Exp05 sculptural layer — tangential, after radial pipeline. */
  const sculpturalSampler =
    sculpturalStrength > 1e-6
      ? (options.sculpturalSampler ??
        createExp05SculpturalSampler(life.seed))
      : options.sculpturalSampler ?? null
  if (sculpturalSampler && sculpturalStrength > 1e-6) {
    position = applyExp05SculpturalOffset(
      position[0],
      position[1],
      position[2],
      sculpturalSampler,
      sculpturalStrength,
    )
  }

  const plen = Math.hypot(position[0], position[1], position[2]) || 1
  let normal = [position[0] / plen, position[1] / plen, position[2] / plen]

  const useFd = options.finiteDifferenceNormal !== false
  if (useFd) {
    const [nx, ny, nz] = [dir.x, dir.y, dir.z]
    const { tangent, bitangent } = orthonormalTangentBitangent(nx, ny, nz)
    const dirT = normalizeDirectionArray([
      nx + tangent[0] * NORMAL_EPS,
      ny + tangent[1] * NORMAL_EPS,
      nz + tangent[2] * NORMAL_EPS,
    ])
    const dirB = normalizeDirectionArray([
      nx + bitangent[0] * NORMAL_EPS,
      ny + bitangent[1] * NORMAL_EPS,
      nz + bitangent[2] * NORMAL_EPS,
    ])
    const childOpts = {
      finiteDifferenceNormal: false,
      morphStrength,
      deformationStrength,
      lobeAmplitude,
      restMean,
      temperature,
      deformLife,
      sampleTemperatureOffset,
      sculpturalStrength,
      sculpturalSampler,
    }
    const pT = evaluateExp05SurfacePoint(dirT, life, radiusAt, childOpts)
    const pB = evaluateExp05SurfacePoint(dirB, life, radiusAt, childOpts)
    if (pT && pB) {
      _scratchA.set(
        pT.position[0] - position[0],
        pT.position[1] - position[1],
        pT.position[2] - position[2],
      )
      _scratchB.set(
        pB.position[0] - position[0],
        pB.position[1] - position[1],
        pB.position[2] - position[2],
      )
      _scratchC.crossVectors(_scratchA, _scratchB)
      if (_scratchC.lengthSq() > 1e-12) {
        _scratchC.normalize()
        if (_scratchC.dot(dir) < 0) _scratchC.negate()
        normal = [_scratchC.x, _scratchC.y, _scratchC.z]
      }
    }
  }

  return {
    position,
    normal,
    direction: [dir.x, dir.y, dir.z],
    restRadius,
    nativeRestRadius,
    morph,
    lobeAmplitude,
    temperature,
    sculpturalStrength,
  }
}

/**
 * Stateful evaluator bound to one morphology seed + type (Exp05 Life seed).
 */
export function createExp05SurfaceEvaluator({
  seed = EXP05_LIFE_SEED,
  morphologyType = EXP05_DEFAULT_MORPHOLOGY_TYPE,
  temperature = EXP05_ENV_TEMPERATURE_NEUTRAL,
  sculpturalStrength = 0,
} = {}) {
  let currentSeed = normalizeSeed(seed)
  let currentType = normalizeExp05MorphologyType(morphologyType)
  let currentTemperature = normalizeExp05Temperature(temperature)
  let currentSculptural = normalizeExp05SculpturalStrength(sculpturalStrength)
  let radiusAt = createExp05RadiusAt(currentSeed, currentType)
  let restMean = estimateRadiusAtMean(radiusAt)
  let sculpturalSampler = createExp05SculpturalSampler(currentSeed)

  function rebuildField() {
    radiusAt = createExp05RadiusAt(currentSeed, currentType)
    restMean = estimateRadiusAtMean(radiusAt)
    sculpturalSampler = createExp05SculpturalSampler(currentSeed)
  }

  return {
    get seed() {
      return currentSeed
    },

    get morphologyType() {
      return currentType
    },

    get temperature() {
      return currentTemperature
    },

    get sculpturalStrength() {
      return currentSculptural
    },

    get radiusAt() {
      return radiusAt
    },

    get restMean() {
      return restMean
    },

    setSeed(nextSeed) {
      const normalized = normalizeSeed(nextSeed)
      if (normalized === currentSeed) return currentSeed
      currentSeed = normalized
      rebuildField()
      return currentSeed
    },

    setMorphologyType(nextType) {
      const normalized = normalizeExp05MorphologyType(nextType)
      if (normalized === currentType) return currentType
      currentType = normalized
      rebuildField()
      return currentType
    },

    setTemperature(nextTemperature) {
      currentTemperature = normalizeExp05Temperature(nextTemperature)
      return currentTemperature
    },

    setSculpturalStrength(nextStrength) {
      currentSculptural = normalizeExp05SculpturalStrength(nextStrength)
      return currentSculptural
    },

    evaluate(direction, life, options = {}) {
      const temperature = normalizeExp05Temperature(
        options.temperature ?? currentTemperature,
      )
      const prepared = prepareExp05TemperatureSurface(life, {
        temperature,
        seed: currentSeed,
      })
      return evaluateExp05SurfacePoint(direction, life, radiusAt, {
        ...options,
        restMean: options.restMean ?? restMean,
        temperature,
        deformLife: prepared.life,
        sampleTemperatureOffset: prepared.sampleTemperatureOffset,
        sculpturalStrength:
          options.sculpturalStrength ?? currentSculptural,
        sculpturalSampler,
      })
    },

    evaluateMany(directions, life, options = {}) {
      if (!Array.isArray(directions)) return []
      const temperature = normalizeExp05Temperature(
        options.temperature ?? currentTemperature,
      )
      const prepared = prepareExp05TemperatureSurface(life, {
        temperature,
        seed: currentSeed,
      })
      const merged = {
        ...options,
        restMean: options.restMean ?? restMean,
        temperature,
        deformLife: prepared.life,
        sampleTemperatureOffset: prepared.sampleTemperatureOffset,
        sculpturalStrength:
          options.sculpturalStrength ?? currentSculptural,
        sculpturalSampler,
      }
      return directions.map((direction) =>
        evaluateExp05SurfacePoint(direction, life, radiusAt, merged),
      )
    },

    dispose() {
      radiusAt = () => NaN
      restMean = NaN
      sculpturalSampler = null
    },
  }
}
