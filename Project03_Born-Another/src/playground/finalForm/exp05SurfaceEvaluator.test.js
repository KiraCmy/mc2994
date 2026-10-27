import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createLifeState,
  replayLife,
} from '../../worldv2/life/lifeEngine.js'
import { EXP05_LIFE_SEED } from './exploreLifeAdapter.js'
import {
  createExp05RadiusAt,
  createExp05SurfaceEvaluator,
  evaluateExp05SurfacePoint,
} from './exp05SurfaceEvaluator.js'

const DIRECTION_A = [0.28, 0.86, -0.42]
const DIRECTION_B = [-0.62, 0.15, 0.77]

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

function nearlyEqual(a, b, eps = 1e-9) {
  assert.ok(
    Math.abs(a - b) <= eps,
    `expected ${a} ≈ ${b} (eps ${eps})`,
  )
}

function vectorsEqual(a, b, eps = 1e-9) {
  assert.equal(a.length, b.length)
  for (let i = 0; i < a.length; i += 1) nearlyEqual(a[i], b[i], eps)
}

test('Explore framing: birth morph maps near unit radius', () => {
  const seed = EXP05_LIFE_SEED
  const radiusAt = createExp05RadiusAt(seed)
  const young = evaluateExp05SurfacePoint(
    [0, 1, 0],
    lifeAtAge(seed, 0.02),
    radiusAt,
    { finiteDifferenceNormal: false },
  )
  assert.ok(young)
  const r = Math.hypot(...young.position)
  assert.ok(
    r > 0.85 && r < 1.25,
    `expected birth-ish radius near 1, got ${r}`,
  )
})

test('Exp05 surface evaluator is deterministic for fixed seed, AGE, direction', () => {
  const seed = EXP05_LIFE_SEED
  const age = 0.45
  const lifeA = lifeAtAge(seed, age)
  const lifeB = lifeAtAge(seed, age)
  const radiusAt = createExp05RadiusAt(seed)

  const sampleA = evaluateExp05SurfacePoint(DIRECTION_A, lifeA, radiusAt)
  const sampleB = evaluateExp05SurfacePoint(DIRECTION_A, lifeB, radiusAt)

  assert.ok(sampleA)
  assert.ok(sampleB)
  vectorsEqual(sampleA.position, sampleB.position)
  vectorsEqual(sampleA.normal, sampleB.normal)
  nearlyEqual(sampleA.restRadius, sampleB.restRadius)
  nearlyEqual(sampleA.morph, sampleB.morph)
  assert.ok(sampleA.morph >= 0 && sampleA.morph <= 1)
})

test('different AGE changes surface for the same seed and direction', () => {
  const seed = EXP05_LIFE_SEED
  const radiusAt = createExp05RadiusAt(seed)
  const young = evaluateExp05SurfacePoint(
    DIRECTION_A,
    lifeAtAge(seed, 0.05),
    radiusAt,
  )
  const mature = evaluateExp05SurfacePoint(
    DIRECTION_A,
    lifeAtAge(seed, 0.45),
    radiusAt,
  )

  assert.ok(young)
  assert.ok(mature)
  assert.ok(young.morph < mature.morph)
  const dist = Math.hypot(
    young.position[0] - mature.position[0],
    young.position[1] - mature.position[1],
    young.position[2] - mature.position[2],
  )
  assert.ok(dist > 1e-4, `expected AGE morph displacement, got ${dist}`)
})

test('different directions evaluate to different surface points', () => {
  const seed = EXP05_LIFE_SEED
  const life = lifeAtAge(seed, 0.45)
  const evaluator = createExp05SurfaceEvaluator({ seed })
  const a = evaluator.evaluate(DIRECTION_A, life)
  const b = evaluator.evaluate(DIRECTION_B, life)
  assert.ok(a && b)
  const dist = Math.hypot(
    a.position[0] - b.position[0],
    a.position[1] - b.position[1],
    a.position[2] - b.position[2],
  )
  assert.ok(dist > 0.05)
  const nLen = Math.hypot(...a.normal)
  nearlyEqual(nLen, 1, 1e-6)
  evaluator.dispose()
})

test('evaluator seed follows Exp05 life seed, not a hardcoded World default', () => {
  const seedA = EXP05_LIFE_SEED
  const seedB = EXP05_LIFE_SEED ^ 0x51c3a7
  assert.notEqual(seedA, 7319)
  const life = lifeAtAge(seedA, 0.45)
  const evalA = createExp05SurfaceEvaluator({ seed: seedA })
  const evalB = createExp05SurfaceEvaluator({ seed: seedB })
  const a = evalA.evaluate(DIRECTION_A, life)
  const b = evalB.evaluate(DIRECTION_A, life)
  assert.ok(a && b)
  const dist = Math.hypot(
    a.position[0] - b.position[0],
    a.position[1] - b.position[1],
    a.position[2] - b.position[2],
  )
  assert.ok(
    dist > 1e-4,
    'morphology seed must affect radiusAt rest shape',
  )
  assert.equal(evalA.seed, seedA)
  evalA.dispose()
  evalB.dispose()
})

test('evaluateMany matches per-direction evaluate', () => {
  const seed = EXP05_LIFE_SEED
  const life = lifeAtAge(seed, 0.45)
  const evaluator = createExp05SurfaceEvaluator({ seed })
  const batch = evaluator.evaluateMany([DIRECTION_A, DIRECTION_B], life)
  const single = evaluator.evaluate(DIRECTION_A, life)
  assert.equal(batch.length, 2)
  vectorsEqual(batch[0].position, single.position)
  evaluator.dispose()
})

test('morphStrength 0 collapses toward birth (not coerced to full morph)', () => {
  const seed = EXP05_LIFE_SEED
  const life = lifeAtAge(seed, 0.45)
  const radiusAt = createExp05RadiusAt(seed)
  const full = evaluateExp05SurfacePoint(DIRECTION_A, life, radiusAt, {
    morphStrength: 1,
    finiteDifferenceNormal: false,
  })
  const none = evaluateExp05SurfacePoint(DIRECTION_A, life, radiusAt, {
    morphStrength: 0,
    finiteDifferenceNormal: false,
  })
  assert.ok(full && none)
  nearlyEqual(none.morph, 0)
  assert.ok(full.morph > none.morph)
  const rNone = Math.hypot(...none.position)
  const rFull = Math.hypot(...full.position)
  assert.ok(
    Math.abs(rNone - rFull) > 1e-3,
    `morphStrength 0 must change radius (0→${rNone}, 1→${rFull})`,
  )
})
