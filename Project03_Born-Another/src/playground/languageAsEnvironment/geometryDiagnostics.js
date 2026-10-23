/**
 * Step 03E — Final-geometry diagnostics for Structural Memory (Playground).
 *
 * Measures CPU BufferGeometry after applyLifeToWorld — the same path that
 * feeds the rendered membrane. There is no GPU vertex-displacement shader.
 */

import { createWorldGeometry, disposeWorldGeometry } from '../../worldv2/worldGeometry.js'
import {
  applyLifeToWorld,
  captureWorldRestState,
} from '../../worldv2/life/worldLifeAdapter.js'
import {
  createStructuralMemorySampler,
  thermalExposureForMagnitude,
} from './thermalMemory.js'

/** Exterior camera distance used by WorldViewport (for screen-arc estimate). */
export const DIAGNOSTIC_CAMERA_DISTANCE = 13.2

/** Mean radius of rest-surface vertices (characteristic organism size). */
export function computeMeanRestRadiusFromSurface(restPositions) {
  const positions = restPositions
  if (!positions || positions.length < 3) return 0
  let sum = 0
  const count = positions.length / 3
  for (let i = 0; i < positions.length; i += 3) {
    sum += Math.hypot(positions[i], positions[i + 1], positions[i + 2])
  }
  return sum / Math.max(1, count)
}

/** Build geometry once to measure mean rest radius for a seed. */
export function measureMeanRestRadius(seed) {
  const world = createWorldGeometry(seed)
  const rest = captureWorldRestState(world)
  try {
    return computeMeanRestRadiusFromSurface(rest.surface)
  } finally {
    disposeWorldGeometry(world)
  }
}

/**
 * Compare baseline vs memory-affected membrane positions for one magnitude.
 * Uses the same applyLifeToWorld + extraRadialOffset path as Branch B.
 *
 * @returns {{
 *   magnitude: number,
 *   active: boolean,
 *   vertexCount: number,
 *   meanRadius: number,
 *   maxDisp: number,
 *   meanDisp: number,
 *   rmsDisp: number,
 *   relMax: number,
 *   relMean: number,
 *   silhouetteMeanAbs: number,
 *   screenArcMaxDeg: number,
 * }}
 */
export function measureFinalMemoryDisplacement({
  seed,
  life,
  magnitude,
  memory,
  exposureBias = 1,
  meanRestRadius = null,
}) {
  const mag = Number(magnitude) || 0
  const world = createWorldGeometry(seed)
  const rest = captureWorldRestState(world)

  try {
    const restPos = rest.surface
    const vertexCount = restPos.length / 3
    const meanRadius =
      Number.isFinite(meanRestRadius) && meanRestRadius > 0
        ? meanRestRadius
        : computeMeanRestRadiusFromSurface(restPos)

    const sampler = createStructuralMemorySampler({
      seed,
      thermalExposure: thermalExposureForMagnitude(mag, memory),
      exposureBias,
      memory,
      meanRestRadius: meanRadius,
    })

    applyLifeToWorld(world, rest, life, {
      updateNormals: false,
      extraRadialOffset: null,
    })
    const baseline = Float32Array.from(world.surface.attributes.position.array)

    applyLifeToWorld(world, rest, life, {
      updateNormals: false,
      extraRadialOffset: sampler.active ? sampler.sampleOffset : null,
    })
    const affected = world.surface.attributes.position.array

    let sum = 0
    let sumSq = 0
    let max = 0
    let silhouette = 0
    for (let i = 0; i < baseline.length; i += 3) {
      const dx = affected[i] - baseline[i]
      const dy = affected[i + 1] - baseline[i + 1]
      const dz = affected[i + 2] - baseline[i + 2]
      const d = Math.hypot(dx, dy, dz)
      sum += d
      sumSq += d * d
      if (d > max) max = d
      const rA = Math.hypot(baseline[i], baseline[i + 1], baseline[i + 2])
      const rB = Math.hypot(affected[i], affected[i + 1], affected[i + 2])
      silhouette += Math.abs(rB - rA)
    }

    const meanDisp = sum / vertexCount
    const rmsDisp = Math.sqrt(sumSq / vertexCount)
    const silhouetteMeanAbs = silhouette / vertexCount

    return {
      magnitude: mag,
      active: Boolean(sampler.active),
      vertexCount,
      meanRadius,
      maxDisp: max,
      meanDisp,
      rmsDisp,
      relMax: meanRadius > 1e-8 ? max / meanRadius : 0,
      relMean: meanRadius > 1e-8 ? meanDisp / meanRadius : 0,
      silhouetteMeanAbs,
      screenArcMaxDeg:
        (Math.atan(max / DIAGNOSTIC_CAMERA_DISTANCE) * 180) / Math.PI,
    }
  } finally {
    disposeWorldGeometry(world)
  }
}

/** Table for the four Memory Preview calibration values. */
export function measureMemoryPreviewTable({
  seed,
  life,
  memory,
  exposureBias = 1,
  meanRestRadius = null,
  magnitudes = [0, 0.05, 0.1, 0.2],
}) {
  const radius =
    Number.isFinite(meanRestRadius) && meanRestRadius > 0
      ? meanRestRadius
      : measureMeanRestRadius(seed)
  return magnitudes.map((magnitude) =>
    measureFinalMemoryDisplacement({
      seed,
      life,
      magnitude,
      memory,
      exposureBias,
      meanRestRadius: radius,
    }),
  )
}
