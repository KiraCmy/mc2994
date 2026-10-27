import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyMorphPreset,
  calibrateRestRadius,
  EXP05_MORPH_PRESETS,
  matchMorphPresetId,
} from './exp05MorphologyCalibration.js'
import { EXP05_LAB_DEFAULTS, normalizeExp05LabParams } from './exp05LabParams.js'
import { createExp05RadiusAt, evaluateExp05SurfacePoint } from './exp05SurfaceEvaluator.js'
import {
  createLifeState,
  replayLife,
} from '../../worldv2/life/lifeEngine.js'
import { EXP05_LIFE_SEED } from './exploreLifeAdapter.js'
import { estimateRadiusAtMean } from './exp05MorphologyCalibration.js'

function lifeAtAge(age) {
  const initial = createLifeState({ seed: EXP05_LIFE_SEED })
  const step = Math.round(Math.min(1, Math.max(0, age)) * initial.totalSteps)
  return replayLife({
    seed: EXP05_LIFE_SEED,
    history: [],
    environmentHistory: [],
    durationSeconds: initial.durationSeconds,
    step,
  })
}

test('calibrateRestRadius: amplitude 0 collapses to mean', () => {
  nearly(calibrateRestRadius(2.2, 1.7, 0), 1.7)
})

test('calibrateRestRadius: amplitude 1 preserves native', () => {
  nearly(calibrateRestRadius(2.2, 1.7, 1), 2.2)
})

test('calibrateRestRadius: amplitude >1 exaggerates lobes', () => {
  const high = calibrateRestRadius(2.2, 1.7, 1.85)
  assert.ok(high > 2.2)
})

test('morph presets keep non-morph lab fields and change lobe knobs', () => {
  const base = normalizeExp05LabParams({
    ...EXP05_LAB_DEFAULTS,
    petalDensity: 0.4,
    compositionMode: 'body',
  })
  const high = applyMorphPreset(base, 'high')
  assert.equal(high.petalDensity, 0.4)
  assert.equal(high.compositionMode, 'body')
  assert.equal(high.morphologyComplexity, EXP05_MORPH_PRESETS.high.morphologyComplexity)
  assert.equal(
    high.macroDeformationStrength,
    EXP05_MORPH_PRESETS.high.macroDeformationStrength,
  )
  assert.equal(matchMorphPresetId(high), 'high')
})

test('Low vs High lobeAmplitude changes surface radius at fixed AGE/Seed', () => {
  const life = lifeAtAge(0.45)
  const radiusAt = createExp05RadiusAt(EXP05_LIFE_SEED)
  const mean = estimateRadiusAtMean(radiusAt)
  const dir = [0.28, 0.86, -0.42]
  const low = evaluateExp05SurfacePoint(dir, life, radiusAt, {
    lobeAmplitude: EXP05_MORPH_PRESETS.low.morphologyComplexity,
    restMean: mean,
    finiteDifferenceNormal: false,
  })
  const high = evaluateExp05SurfacePoint(dir, life, radiusAt, {
    lobeAmplitude: EXP05_MORPH_PRESETS.high.morphologyComplexity,
    restMean: mean,
    finiteDifferenceNormal: false,
  })
  assert.ok(low && high)
  const rLow = Math.hypot(...low.position)
  const rHigh = Math.hypot(...high.position)
  assert.ok(
    Math.abs(rHigh - rLow) > 0.02,
    `expected Low/High radius delta, got ${rLow} vs ${rHigh}`,
  )
})

function nearly(a, b, eps = 1e-9) {
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b}`)
}
