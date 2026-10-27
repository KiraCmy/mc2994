import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createLifeState,
  replayLife,
} from '../../worldv2/life/lifeEngine.js'
import { EXP05_LIFE_SEED } from './exploreLifeAdapter.js'
import {
  applyExp05SculpturalOffset,
  createExp05SculpturalSampler,
  normalizeExp05SculpturalStrength,
} from './exp05SculpturalDeformation.js'
import {
  createExp05RadiusAt,
  evaluateExp05SurfacePoint,
} from './exp05SurfaceEvaluator.js'

const DIRECTION = [0.42, 0.71, -0.56]

function lifeAtAge(seed, age) {
  const initial = createLifeState({ seed })
  const step = Math.round(
    Math.min(1, Math.max(0, age)) * initial.totalSteps,
  )
  return replayLife({
    seed,
    history: [],
    environmentHistory: [],
    durationSeconds: initial.durationSeconds,
    step,
  })
}

function positionDelta(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

test('normalizeExp05SculpturalStrength clamps to 0–2', () => {
  assert.equal(normalizeExp05SculpturalStrength(undefined), 0)
  assert.equal(normalizeExp05SculpturalStrength(-1), 0)
  assert.equal(normalizeExp05SculpturalStrength(0.5), 0.5)
  assert.equal(normalizeExp05SculpturalStrength(3), 2)
})

test('strength 0 sampler offset is identity', () => {
  const sampler = createExp05SculpturalSampler(EXP05_LIFE_SEED)
  const offset = sampler.sampleOffset(1.1, -0.4, 0.8, 0)
  assert.deepEqual([...offset], [0, 0, 0])
  const point = applyExp05SculpturalOffset(1.1, -0.4, 0.8, sampler, 0)
  assert.deepEqual(point, [1.1, -0.4, 0.8])
})

test('evaluateExp05SurfacePoint strength 0 matches baseline radial path', () => {
  const seed = EXP05_LIFE_SEED
  const life = lifeAtAge(seed, 0.48)
  const radiusAt = createExp05RadiusAt(seed)
  const baseline = evaluateExp05SurfacePoint(DIRECTION, life, radiusAt, {
    finiteDifferenceNormal: false,
  })
  const withZero = evaluateExp05SurfacePoint(DIRECTION, life, radiusAt, {
    finiteDifferenceNormal: false,
    sculpturalStrength: 0,
  })
  assert.ok(baseline && withZero)
  assert.equal(positionDelta(baseline.position, withZero.position), 0)
})

test('evaluateExp05SurfacePoint strength > 0 moves surface', () => {
  const seed = EXP05_LIFE_SEED
  const life = lifeAtAge(seed, 0.48)
  const radiusAt = createExp05RadiusAt(seed)
  const sampler = createExp05SculpturalSampler(seed)
  const baseline = evaluateExp05SurfacePoint(DIRECTION, life, radiusAt, {
    finiteDifferenceNormal: false,
    sculpturalStrength: 0,
    sculpturalSampler: sampler,
  })
  const sculpted = evaluateExp05SurfacePoint(DIRECTION, life, radiusAt, {
    finiteDifferenceNormal: false,
    sculpturalStrength: 1.25,
    sculpturalSampler: sampler,
  })
  assert.ok(baseline && sculpted)
  const delta = positionDelta(baseline.position, sculpted.position)
  assert.ok(
    delta > 0.02,
    `expected tangible sculptural displacement, got ${delta}`,
  )
})

test('sculptural sampler is seed-stable and seed-sensitive', () => {
  const a = createExp05SculpturalSampler(101)
  const b = createExp05SculpturalSampler(101)
  const c = createExp05SculpturalSampler(202)
  const pa = [...a.sampleOffset(0.8, 0.3, -0.5, 1)]
  const pb = [...b.sampleOffset(0.8, 0.3, -0.5, 1)]
  const pc = [...c.sampleOffset(0.8, 0.3, -0.5, 1)]
  assert.equal(positionDelta(pa, pb), 0)
  assert.ok(positionDelta(pa, pc) > 1e-4)
})
