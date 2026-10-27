import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyLifeMoistureFromBirth,
  createLifeState,
  replayLife,
  setLifeTurbulence,
} from '../../worldv2/life/lifeEngine.js'
import { EXP05_LIFE_SEED } from './exploreLifeAdapter.js'
import {
  createExp05RadiusAt,
  evaluateExp05SurfacePoint,
} from './exp05SurfaceEvaluator.js'
import {
  EXP05_ENV_MOISTURE_NEUTRAL,
  EXP05_ENV_TEMPERATURE_NEUTRAL,
  prepareExp05TemperatureSurface,
  readExp05Environment,
} from './exp05EnvironmentCoupling.js'

function lifeAtAge(seed, age, environmentHistory = []) {
  const initial = createLifeState({ seed, environmentHistory })
  const step = Math.round(
    Math.min(1, Math.max(0, age)) * initial.totalSteps,
  )
  return replayLife({
    seed,
    history: [],
    environmentHistory,
    durationSeconds: initial.durationSeconds,
    step,
  })
}

test('readExp05Environment falls back to Life + Temperature defaults', () => {
  assert.deepEqual(readExp05Environment(null), {
    moisture: EXP05_ENV_MOISTURE_NEUTRAL,
    turbulence: 0,
    temperature: EXP05_ENV_TEMPERATURE_NEUTRAL,
  })
  const life = createLifeState({ seed: EXP05_LIFE_SEED })
  assert.equal(readExp05Environment(life).moisture, EXP05_ENV_MOISTURE_NEUTRAL)
  assert.equal(readExp05Environment(life).turbulence, 0)
  assert.equal(
    readExp05Environment(life, { temperature: 0.82 }).temperature,
    0.82,
  )
})

test('turbulence moves Exp05 shared surface sample without changing rest radius', () => {
  const seed = EXP05_LIFE_SEED
  const dir = [0.2, 0.75, -0.63]
  const radiusAt = createExp05RadiusAt(seed)
  const calm = lifeAtAge(seed, 0.45)
  const stirred = setLifeTurbulence(calm, 0.85)
  const opts = { finiteDifferenceNormal: false }

  const a = evaluateExp05SurfacePoint(dir, calm, radiusAt, opts)
  const b = evaluateExp05SurfacePoint(dir, stirred, radiusAt, opts)
  assert.ok(a && b)
  assert.equal(a.restRadius, b.restRadius)
  const dist = Math.hypot(
    a.position[0] - b.position[0],
    a.position[1] - b.position[1],
    a.position[2] - b.position[2],
  )
  assert.ok(dist > 0.01, `expected membrane offset from turbulence, got ${dist}`)
})

test('moisture from birth changes growth-site maturity path at fixed AGE/Seed', () => {
  const seed = EXP05_LIFE_SEED
  const base = lifeAtAge(seed, 0.55)
  const dry = applyLifeMoistureFromBirth(base, 0.2)
  const wet = applyLifeMoistureFromBirth(base, 0.8)
  assert.equal(dry.environment.moisture, 0.2)
  assert.equal(wet.environment.moisture, 0.8)

  const drySites = dry.outputs?.surface?.spatialGrowthSites ?? []
  const wetSites = wet.outputs?.surface?.spatialGrowthSites ?? []
  const dryLen = drySites.reduce(
    (sum, site) => sum + (Number(site.crystal?.length) || 0),
    0,
  )
  const wetLen = wetSites.reduce(
    (sum, site) => sum + (Number(site.crystal?.length) || 0),
    0,
  )
  assert.ok(
    wetLen > dryLen,
    `expected wet crystals longer than dry at same AGE, dry=${dryLen} wet=${wetLen}`,
  )
})

test('AGE scrub preserves moisture and turbulence environment history', () => {
  const seed = EXP05_LIFE_SEED
  let life = lifeAtAge(seed, 0.4)
  life = applyLifeMoistureFromBirth(life, 0.7)
  life = setLifeTurbulence(life, 0.55)
  const scrubbed = replayLife({
    seed: life.seed,
    history: life.history,
    environmentHistory: life.environmentHistory,
    durationSeconds: life.durationSeconds,
    step: Math.round(0.6 * life.totalSteps),
  })
  assert.equal(scrubbed.environment.moisture, 0.7)
  assert.equal(scrubbed.environment.turbulence, 0.55)
})

test('temperature expands or contracts Exp05 shared surface without mutating Life', () => {
  const seed = EXP05_LIFE_SEED
  const dir = [0.15, 0.82, -0.55]
  const radiusAt = createExp05RadiusAt(seed)
  const life = lifeAtAge(seed, 0.45)
  const opts = { finiteDifferenceNormal: false }
  const neutral = evaluateExp05SurfacePoint(dir, life, radiusAt, {
    ...opts,
    temperature: EXP05_ENV_TEMPERATURE_NEUTRAL,
  })
  const hot = evaluateExp05SurfacePoint(dir, life, radiusAt, {
    ...opts,
    temperature: 0.95,
  })
  const cold = evaluateExp05SurfacePoint(dir, life, radiusAt, {
    ...opts,
    temperature: 0.05,
  })
  assert.ok(neutral && hot && cold)
  assert.equal(life.environment?.moisture, EXP05_ENV_MOISTURE_NEUTRAL)
  assert.equal(life.environment?.turbulence, 0)
  assert.ok(
    !('temperature' in (life.environment ?? {})),
    'Life Engine must not gain a temperature channel',
  )
  const hotDist = Math.hypot(
    hot.position[0] - neutral.position[0],
    hot.position[1] - neutral.position[1],
    hot.position[2] - neutral.position[2],
  )
  const coldDist = Math.hypot(
    cold.position[0] - neutral.position[0],
    cold.position[1] - neutral.position[1],
    cold.position[2] - neutral.position[2],
  )
  assert.ok(hotDist > 0.01, `expected hot membrane offset, got ${hotDist}`)
  assert.ok(coldDist > 0.01, `expected cold membrane offset, got ${coldDist}`)
})

test('temperature recovery to neutral restores membrane offset to near zero field', () => {
  const seed = EXP05_LIFE_SEED
  const life = lifeAtAge(seed, 0.5)
  const hot = prepareExp05TemperatureSurface(life, {
    temperature: 0.9,
    seed,
  })
  const recovered = prepareExp05TemperatureSurface(life, {
    temperature: EXP05_ENV_TEMPERATURE_NEUTRAL,
    seed,
  })
  const dir = { x: 0.4, y: 0.3, z: 0.866 }
  const hotOff = hot.sampleTemperatureOffset(dir.x, dir.y, dir.z)
  const recoveredOff = recovered.sampleTemperatureOffset(dir.x, dir.y, dir.z)
  assert.ok(Math.abs(hotOff) > 1e-4, `expected hot spatial offset, got ${hotOff}`)
  assert.equal(recoveredOff, 0)
})

test('temperature change does not alter Life step or seed', () => {
  const seed = EXP05_LIFE_SEED
  const life = lifeAtAge(seed, 0.55)
  const step = life.step
  prepareExp05TemperatureSurface(life, { temperature: 0.2, seed })
  prepareExp05TemperatureSurface(life, { temperature: 0.9, seed })
  assert.equal(life.step, step)
  assert.equal(life.seed, seed)
  assert.equal(life.age.toFixed(3), (0.55).toFixed(3))
})
