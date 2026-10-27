/**
 * Exp05 Phase D — Environmental Coupling (adapter notes + UI helpers).
 *
 * Moisture / Turbulence → Life Engine (useLifeEngine setters). Source of truth:
 *   life.environment + environmentHistory.
 *
 * Temperature → Playground visual coupling only (not in Life Engine).
 *   Reuses languageAsEnvironment/temperatureCoupling.js:
 *   - resolveCoupledLife → temporal ambient membrane lobes
 *   - resolveSpatialSampler → distributed radial expansion / contraction
 *   Applied through Exp05 shared surface evaluator (body / petals / particles).
 *   Neutral 0.5 → no offset (recovery). Immediate; does not reset AGE / Seed.
 */
import { ENV_NEUTRAL } from '../languageAsEnvironment/envState.js'
import {
  DEFAULT_TEMPERATURE_COUPLING,
  resolveCoupledLife,
  resolveSpatialSampler,
} from '../languageAsEnvironment/temperatureCoupling.js'
import {
  ENV_MOISTURE_NEUTRAL,
  ENV_TURBULENCE_DEFAULT,
} from '../../worldv2/life/lifeEngine.js'

export const EXP05_ENV_MOISTURE_NEUTRAL = ENV_MOISTURE_NEUTRAL
export const EXP05_ENV_TURBULENCE_DEFAULT = ENV_TURBULENCE_DEFAULT
export const EXP05_ENV_TEMPERATURE_NEUTRAL = ENV_NEUTRAL

export const EXP05_ENV_META = {
  temperature: {
    label: 'Temperature',
    min: 0,
    max: 1,
    step: 0.01,
    binding:
      'Playground temperatureCoupling → shared membrane expand/contract (not Life Engine)',
  },
  moisture: {
    label: 'Moisture',
    min: 0,
    max: 1,
    step: 0.01,
    binding:
      'Life environmentHistory → crystal growth / branching (from-birth rebuild)',
  },
  turbulence: {
    label: 'Turbulence',
    min: 0,
    max: 1,
    step: 0.01,
    binding:
      'Life environment.turbulence → shared membrane field (body/petals/particles)',
  },
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

export function normalizeExp05Temperature(value) {
  if (!Number.isFinite(Number(value))) return EXP05_ENV_TEMPERATURE_NEUTRAL
  return clamp01(value)
}

/**
 * @param {object|null} life
 * @param {{ temperature?: number }|null} [lab]
 */
export function readExp05Environment(life, lab = null) {
  return {
    moisture: Number.isFinite(life?.environment?.moisture)
      ? life.environment.moisture
      : EXP05_ENV_MOISTURE_NEUTRAL,
    turbulence: Number.isFinite(life?.environment?.turbulence)
      ? life.environment.turbulence
      : EXP05_ENV_TURBULENCE_DEFAULT,
    temperature: normalizeExp05Temperature(lab?.temperature),
  }
}

/**
 * Prepare Temperature visual coupling for one surface apply / evaluate pass.
 * Does not mutate Life Engine state.
 *
 * @returns {{
 *   life: object,
 *   sampleTemperatureOffset: (x:number,y:number,z:number) => number,
 *   temperature: number,
 * }}
 */
export function prepareExp05TemperatureSurface(
  life,
  {
    temperature = EXP05_ENV_TEMPERATURE_NEUTRAL,
    seed = null,
    coupling = DEFAULT_TEMPERATURE_COUPLING,
    sharedElapsed = null,
  } = {},
) {
  const temp = normalizeExp05Temperature(temperature)
  const elapsed =
    Number.isFinite(sharedElapsed)
      ? sharedElapsed
      : Number(life?.time) || 0
  const fieldSeed = Number.isFinite(Number(seed))
    ? Number(seed)
    : Number(life?.seed) || 0

  const coupledLife = resolveCoupledLife(life, {
    temperature: temp,
    sharedElapsed: elapsed,
    coupling,
    role: 'affected',
  })

  const sampler = resolveSpatialSampler({
    seed: fieldSeed,
    temperature: temp,
    coupling,
    role: 'affected',
  })

  return {
    life: coupledLife,
    temperature: temp,
    sampleTemperatureOffset: (x, y, z) => sampler.sampleOffset(x, y, z),
  }
}
