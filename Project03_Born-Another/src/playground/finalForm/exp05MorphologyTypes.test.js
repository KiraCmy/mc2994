import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createLifeState,
  replayLife,
} from '../../worldv2/life/lifeEngine.js'
import { EXP05_LIFE_SEED } from './exploreLifeAdapter.js'
import {
  createExp05RadiusAt,
  evaluateExp05SurfacePoint,
} from './exp05SurfaceEvaluator.js'
import {
  EXP05_MORPHOLOGY_TYPES,
  normalizeExp05MorphologyType,
} from './exp05MorphologyTypes.js'
import {
  EXP05_DIAGNOSTIC_MODES,
  EXP05_MATERIAL_MODES,
  normalizeExp05DiagnosticMode,
  normalizeExp05LabParams,
  normalizeExp05MaterialMode,
} from './exp05LabParams.js'
import { applyMorphPreset } from './exp05MorphologyCalibration.js'

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

test('normalizeExp05MorphologyType falls back to world', () => {
  assert.equal(normalizeExp05MorphologyType('world'), 'world')
  assert.equal(normalizeExp05MorphologyType('segmented'), 'segmented')
  assert.equal(normalizeExp05MorphologyType('spiral'), 'spiral')
  assert.equal(normalizeExp05MorphologyType('nope'), 'world')
})

test('morphology types produce distinct silhouettes at fixed AGE/Seed', () => {
  const seed = EXP05_LIFE_SEED
  const life = lifeAtAge(seed, 0.55)
  const dir = [0.42, 0.18, -0.89]
  const opts = { finiteDifferenceNormal: false, lobeAmplitude: 1 }

  const world = evaluateExp05SurfacePoint(
    dir,
    life,
    createExp05RadiusAt(seed, EXP05_MORPHOLOGY_TYPES.WORLD),
    opts,
  )
  const segmented = evaluateExp05SurfacePoint(
    dir,
    life,
    createExp05RadiusAt(seed, EXP05_MORPHOLOGY_TYPES.SEGMENTED),
    opts,
  )
  const spiral = evaluateExp05SurfacePoint(
    dir,
    life,
    createExp05RadiusAt(seed, EXP05_MORPHOLOGY_TYPES.SPIRAL),
    opts,
  )

  assert.ok(world && segmented && spiral)
  const rWorld = Math.hypot(...world.position)
  const rSeg = Math.hypot(...segmented.position)
  const rSpiral = Math.hypot(...spiral.position)

  assert.ok(
    Math.abs(rWorld - rSeg) > 0.01 || Math.abs(rWorld - rSpiral) > 0.01,
    `expected type radius difference, got world=${rWorld} seg=${rSeg} spiral=${rSpiral}`,
  )
  assert.ok(
    Math.abs(rSeg - rSpiral) > 0.005,
    `expected segmented ≠ spiral, got ${rSeg} vs ${rSpiral}`,
  )
})

test('morph presets leave morphologyType unchanged', () => {
  const lab = normalizeExp05LabParams({
    morphologyType: EXP05_MORPHOLOGY_TYPES.SPIRAL,
    morphologyComplexity: 1,
    macroDeformationStrength: 1,
  })
  const high = applyMorphPreset(lab, 'high')
  assert.equal(high.morphologyType, EXP05_MORPHOLOGY_TYPES.SPIRAL)
  assert.ok(high.morphologyComplexity !== lab.morphologyComplexity)
})

test('diagnostic mode normalizes and survives lab normalize defaults', () => {
  assert.equal(
    normalizeExp05DiagnosticMode(EXP05_DIAGNOSTIC_MODES.GEOMETRY),
    EXP05_DIAGNOSTIC_MODES.GEOMETRY,
  )
  assert.equal(
    normalizeExp05DiagnosticMode('nope'),
    EXP05_DIAGNOSTIC_MODES.FULL,
  )
  const lab = normalizeExp05LabParams({
    diagnosticMode: EXP05_DIAGNOSTIC_MODES.SURFACE_LIGHTING,
    morphologyType: EXP05_MORPHOLOGY_TYPES.SEGMENTED,
  })
  assert.equal(lab.diagnosticMode, EXP05_DIAGNOSTIC_MODES.SURFACE_LIGHTING)
  assert.equal(lab.morphologyType, EXP05_MORPHOLOGY_TYPES.SEGMENTED)
  const high = applyMorphPreset(lab, 'high')
  assert.equal(high.diagnosticMode, EXP05_DIAGNOSTIC_MODES.SURFACE_LIGHTING)
})

test('material mode defaults to Pearlescent and survives morph presets', () => {
  assert.equal(
    normalizeExp05LabParams({}).materialMode,
    EXP05_MATERIAL_MODES.PEARLESCENT,
  )
  assert.equal(
    normalizeExp05MaterialMode(EXP05_MATERIAL_MODES.EXPLORE),
    EXP05_MATERIAL_MODES.EXPLORE,
  )
  assert.equal(
    normalizeExp05MaterialMode(EXP05_MATERIAL_MODES.PEARLESCENT),
    EXP05_MATERIAL_MODES.PEARLESCENT,
  )
  assert.equal(
    normalizeExp05MaterialMode(EXP05_MATERIAL_MODES.PEARLESCENT_V2),
    EXP05_MATERIAL_MODES.PEARLESCENT_V2,
  )
  assert.equal(
    normalizeExp05MaterialMode(EXP05_MATERIAL_MODES.BIOLOGICAL),
    EXP05_MATERIAL_MODES.BIOLOGICAL,
  )
  assert.equal(
    normalizeExp05MaterialMode(EXP05_MATERIAL_MODES.BIOLOGICAL_V2),
    EXP05_MATERIAL_MODES.BIOLOGICAL_V2,
  )
  assert.equal(
    normalizeExp05MaterialMode('nope'),
    EXP05_MATERIAL_MODES.PEARLESCENT,
  )
  const depthLab = normalizeExp05LabParams({})
  assert.equal(depthLab.opticalDensity, 1.2)
  assert.equal(depthLab.thicknessContrast, 1.15)
  const lab = normalizeExp05LabParams({
    materialMode: EXP05_MATERIAL_MODES.PEARLESCENT,
    morphologyType: EXP05_MORPHOLOGY_TYPES.WORLD,
  })
  assert.equal(lab.materialMode, EXP05_MATERIAL_MODES.PEARLESCENT)
  const high = applyMorphPreset(lab, 'high')
  assert.equal(high.materialMode, EXP05_MATERIAL_MODES.PEARLESCENT)
})

test('same type+seed is deterministic across evaluations', () => {
  const seed = EXP05_LIFE_SEED
  const life = lifeAtAge(seed, 0.4)
  const dir = [-0.2, 0.9, 0.3]
  const radiusAt = createExp05RadiusAt(seed, EXP05_MORPHOLOGY_TYPES.SEGMENTED)
  const a = evaluateExp05SurfacePoint(dir, life, radiusAt, {
    finiteDifferenceNormal: false,
  })
  const b = evaluateExp05SurfacePoint(dir, life, radiusAt, {
    finiteDifferenceNormal: false,
  })
  assert.deepEqual(a.position, b.position)
})

test('segmented quilt is flattened vs elongated axis', () => {
  const radiusAt = createExp05RadiusAt(
    EXP05_LIFE_SEED,
    EXP05_MORPHOLOGY_TYPES.SEGMENTED,
  )
  /* Mild body yaw — world ±Y still near thickness; ±Z near length. */
  const thin = radiusAt({ x: 0, y: 1, z: 0 })
  const long = radiusAt({ x: 0, y: 0, z: 1 })
  const wide = radiusAt({ x: 1, y: 0, z: 0 })
  assert.ok(
    long > thin * 1.45,
    `expected elongated flat body, long=${long} thin=${thin}`,
  )
  assert.ok(
    wide > thin * 1.15,
    `expected oval width > thickness, wide=${wide} thin=${thin}`,
  )
  assert.ok(
    long > wide * 1.05,
    `expected length > width oval footprint, long=${long} wide=${wide}`,
  )
})

test('segmented quilt shows longitudinal rib oscillation', () => {
  const radiusAt = createExp05RadiusAt(
    EXP05_LIFE_SEED,
    EXP05_MORPHOLOGY_TYPES.SEGMENTED,
  )
  const samples = []
  const n = 36
  for (let i = 0; i < n; i += 1) {
    const along = (i / (n - 1)) * 1.7 - 0.85
    const across = 0.12
    const up = 0.42
    const len = Math.hypot(across, up, along) || 1
    samples.push(
      radiusAt({
        x: across / len,
        y: up / len,
        z: along / len,
      }),
    )
  }
  let peaks = 0
  for (let i = 1; i < samples.length - 1; i += 1) {
    if (samples[i] > samples[i - 1] && samples[i] > samples[i + 1]) {
      peaks += 1
    }
  }
  assert.ok(
    peaks >= 3,
    `expected ≥3 rib peaks along length, got ${peaks} (${samples.map((v) => v.toFixed(3)).join(',')})`,
  )
})

test('segmented field is not regularly stacked discs along Y', () => {
  const radiusAt = createExp05RadiusAt(
    EXP05_LIFE_SEED,
    EXP05_MORPHOLOGY_TYPES.SEGMENTED,
  )
  const ys = [-0.85, -0.55, -0.25, 0.05, 0.35, 0.65, 0.9]
  const radii = ys.map((y) => {
    const polar = Math.sqrt(Math.max(0, 1 - y * y))
    return radiusAt({ x: polar * 0.7, y, z: polar * 0.71414 })
  })
  const deltas = []
  for (let i = 1; i < radii.length; i += 1) {
    deltas.push(radii[i] - radii[i - 1])
  }
  let signFlips = 0
  for (let i = 1; i < deltas.length; i += 1) {
    if (deltas[i] === 0 || deltas[i - 1] === 0) continue
    if (Math.sign(deltas[i]) !== Math.sign(deltas[i - 1])) signFlips += 1
  }
  assert.ok(
    signFlips <= 3,
    `expected non-disc Y profile, got ${signFlips} sign flips (${radii})`,
  )
})

test('segmented morphology changes with seed', () => {
  const dir = { x: 0.55, y: 0.2, z: -0.81 }
  const a = createExp05RadiusAt(12001, EXP05_MORPHOLOGY_TYPES.SEGMENTED)(dir)
  const b = createExp05RadiusAt(884731, EXP05_MORPHOLOGY_TYPES.SEGMENTED)(dir)
  assert.ok(Math.abs(a - b) > 0.01, `expected seed variance, got ${a} vs ${b}`)
})

test('segmented quilt has strong silhouette span', () => {
  const radiusAt = createExp05RadiusAt(
    EXP05_LIFE_SEED,
    EXP05_MORPHOLOGY_TYPES.SEGMENTED,
  )
  let min = Infinity
  let max = -Infinity
  let sum = 0
  const n = 128
  for (let i = 0; i < n; i += 1) {
    const t = (i + 0.5) / n
    const z = 1 - 2 * t
    const r = Math.sqrt(Math.max(0, 1 - z * z))
    const phi = (i * 2.399963229728653) % (Math.PI * 2)
    const radius = radiusAt({
      x: r * Math.cos(phi),
      y: r * Math.sin(phi),
      z,
    })
    min = Math.min(min, radius)
    max = Math.max(max, radius)
    sum += radius
  }
  const mean = sum / n
  const span = (max - min) / mean
  assert.ok(
    span > 0.28,
    `expected articulated radius span > 0.28, got ${span} (min=${min} max=${max})`,
  )
})
