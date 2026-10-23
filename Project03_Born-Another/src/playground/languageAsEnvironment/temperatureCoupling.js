/**
 * Step 03A — Temperature visual coupling (Playground only).
 *
 * Temporal: breath + soft pulsing ambient lobes (time-dependent).
 * Spatial: distributed rest-space FBM (see temperatureSpatialField.js).
 *
 * Temporal ambient still feeds `localDeformations`.
 * Spatial displacement is sampled per vertex via extraRadialOffset.
 */

import { ENV_NEUTRAL } from './envState.js'
import {
  createNeutralSpatialSampler,
  createTemperatureSpatialSampler,
} from './temperatureSpatialField.js'

export const DEFAULT_TEMPERATURE_COUPLING = Object.freeze({
  temporalEnabled: true,
  temporalAmplitudeSensitivity: 1.25,
  frequencySensitivity: 1.15,
  spatialEnabled: true,
  /** Active membrane fraction (threshold), not amplitude. */
  spatialCoverage: 0.88,
  /** Noise frequency / feature size. */
  spatialVariation: 0.52,
  /** Radial displacement magnitude. */
  displacementStrength: 1.4,
})

export const TEMPORAL_AMBIENT_BASE = 0.035
export const COMPARE_BREATH_AMPLITUDE = 0.018

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function clamp01(value) {
  return clamp(Number(value) || 0, 0, 1)
}

function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function unitDirection(random) {
  const z = random() * 2 - 1
  const angle = random() * Math.PI * 2
  const radius = Math.sqrt(Math.max(0, 1 - z * z))
  return [radius * Math.cos(angle), radius * Math.sin(angle), z]
}

export function temperatureDeformationMultipliers(
  temperature,
  options = DEFAULT_TEMPERATURE_COUPLING,
) {
  if (options.temporalEnabled === false) {
    return { amplitude: 1, frequency: 1 }
  }

  const t = clamp01(temperature)
  const delta = t - ENV_NEUTRAL
  const ampSens = clamp(
    Number(options.temporalAmplitudeSensitivity) || 0,
    0,
    3,
  )
  const freqSens = clamp(Number(options.frequencySensitivity) || 0, 0, 3)

  return {
    amplitude: clamp(1 + delta * 2 * ampSens * 0.9, 0.3, 2.3),
    frequency: clamp(1 + delta * 2 * freqSens * 0.8, 0.35, 2.1),
  }
}

export function createTemporalAmbientDeformations(
  seed,
  amplitudeMul = 1,
  frequencyMul = 1,
  sharedElapsed = 0,
) {
  const random = mulberry32((Number(seed) || 0) ^ 0x7e3a01)
  const amp = Number.isFinite(amplitudeMul) ? amplitudeMul : 1
  const freq = Math.max(1e-3, Number.isFinite(frequencyMul) ? frequencyMul : 1)
  const time = Number(sharedElapsed) || 0
  const regions = []

  for (let index = 0; index < 5; index += 1) {
    const direction = unitDirection(random)
    const phase = random() * Math.PI * 2
    const omega = (0.5 + random() * 0.7) * freq
    const pulse = 0.75 + 0.25 * Math.sin(time * omega + phase)
    regions.push({
      id: `temporal-${index}`,
      direction,
      response: pulse,
      radius: 0.26 + random() * 0.12,
      deformation: TEMPORAL_AMBIENT_BASE * amp * pulse,
      mineralBoost: 0,
    })
  }

  return regions
}

/**
 * Temporal-only display life (no spatial lobes).
 * Spatial response is applied per-vertex via createTemperatureSpatialSampler.
 */
export function resolveCoupledLife(life, config) {
  const {
    temperature = ENV_NEUTRAL,
    sharedElapsed = 0,
    coupling = DEFAULT_TEMPERATURE_COUPLING,
    role = 'affected',
  } = config

  const isBaseline = role === 'baseline'
  const temp = isBaseline ? ENV_NEUTRAL : clamp01(temperature)
  const temporalOn = !isBaseline && coupling.temporalEnabled !== false

  const temporal = temperatureDeformationMultipliers(temp, {
    ...coupling,
    temporalEnabled: temporalOn,
  })

  const source = life?.outputs?.form?.localDeformations
  const scaledStimuli = Array.isArray(source)
    ? source.map((region) => ({
        ...region,
        deformation: (region.deformation ?? 0) * temporal.amplitude,
        radius:
          (region.radius ?? 0.28) /
          Math.sqrt(Math.max(1e-3, temporal.frequency)),
      }))
    : []

  const temporalAmbient = createTemporalAmbientDeformations(
    life.seed,
    temporal.amplitude,
    temporal.frequency,
    sharedElapsed,
  )

  return {
    ...life,
    outputs: {
      ...life.outputs,
      form: {
        ...life.outputs.form,
        localDeformations: [...scaledStimuli, ...temporalAmbient],
      },
    },
  }
}

/** Spatial sampler for a compare branch (baseline → neutral). */
export function resolveSpatialSampler({
  seed,
  temperature,
  coupling = DEFAULT_TEMPERATURE_COUPLING,
  role = 'affected',
}) {
  if (role === 'baseline' || coupling.spatialEnabled === false) {
    return createNeutralSpatialSampler()
  }
  return createTemperatureSpatialSampler({
    seed,
    temperature,
    spatialEnabled: coupling.spatialEnabled,
    spatialCoverage: coupling.spatialCoverage,
    spatialVariation: coupling.spatialVariation,
    displacementStrength: coupling.displacementStrength,
  })
}

export {
  createTemperatureSpatialSampler,
  createNeutralSpatialSampler,
} from './temperatureSpatialField.js'
