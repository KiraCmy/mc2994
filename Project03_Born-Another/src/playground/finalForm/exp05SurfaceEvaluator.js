/**
 * Phase C1/C2 — Exp05 Shared World Surface Evaluator.
 *
 * Single geometry authority for body, petals, and particles.
 * World radiusAt is expressed in Explore framing units by dividing by
 * ORGANISM_BIRTH_RADIUS (birth sphere ≈ unit sphere — not an arbitrary fit scale).
 */
import * as THREE from 'three'
import {
  createWorldGeometry,
  disposeWorldGeometry,
} from '../../worldv2/worldGeometry.js'
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

function wrapRadiusAt(rawRadiusAt) {
  return (direction) => {
    const raw = rawRadiusAt(direction)
    if (!Number.isFinite(raw)) return raw
    return raw / EXP05_SURFACE_UNIT
  }
}

/**
 * Explore-framed World radiusAt (birth ≈ 1).
 */
export function createExp05RadiusAt(seed = EXP05_LIFE_SEED) {
  const normalized = normalizeSeed(seed)
  const world = createWorldGeometry(normalized)
  const radiusAt = wrapRadiusAt(world.radiusAt)
  disposeWorldGeometry(world)
  return radiusAt
}

/**
 * World mesh whose rest field is already in Explore framing units.
 */
export function createExp05WorldGeometry(seed = EXP05_LIFE_SEED) {
  const normalized = normalizeSeed(seed)
  const probe = createWorldGeometry(normalized)
  const rawRadiusAt = probe.radiusAt
  disposeWorldGeometry(probe)
  return createWorldGeometry(normalized, {
    radiusAt: wrapRadiusAt(rawRadiusAt),
  })
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
  const extra = sampleTurbulenceFromLife(
    shapedPoint[0],
    shapedPoint[1],
    shapedPoint[2],
    life,
  )
  const deformations = scaleDeformations(
    life.outputs?.form?.localDeformations,
    deformationStrength,
  )
  const position = deformRadialPoint(
    shapedPoint[0],
    shapedPoint[1],
    shapedPoint[2],
    deformations,
    extra,
  )

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
  }
}

/**
 * Stateful evaluator bound to one morphology seed (Exp05 Life seed).
 */
export function createExp05SurfaceEvaluator({
  seed = EXP05_LIFE_SEED,
} = {}) {
  let currentSeed = normalizeSeed(seed)
  let radiusAt = createExp05RadiusAt(currentSeed)
  let restMean = estimateRadiusAtMean(radiusAt)

  return {
    get seed() {
      return currentSeed
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
      radiusAt = createExp05RadiusAt(currentSeed)
      restMean = estimateRadiusAtMean(radiusAt)
      return currentSeed
    },

    evaluate(direction, life, options = {}) {
      return evaluateExp05SurfacePoint(direction, life, radiusAt, {
        restMean,
        ...options,
      })
    },

    evaluateMany(directions, life, options = {}) {
      if (!Array.isArray(directions)) return []
      const merged = { restMean, ...options }
      return directions.map((direction) =>
        evaluateExp05SurfacePoint(direction, life, radiusAt, merged),
      )
    },

    dispose() {
      radiusAt = () => NaN
      restMean = NaN
    },
  }
}
