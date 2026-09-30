export const STUDIES = [
  {
    id: 'surface',
    index: '01',
    name: 'Surface',
    heading: 'Surface Parameters',
  },
  {
    id: 'individuality',
    index: '02',
    name: 'Individuality',
    heading: 'Individuality Parameters',
  },
  {
    id: 'development',
    index: '03',
    name: 'Development',
    heading: 'Development Parameters',
  },
  {
    id: 'decay',
    index: '04',
    name: 'Decay',
    heading: 'Decay Parameters',
  },
  {
    id: 'trace',
    index: '05',
    name: 'Trace',
    heading: 'Trace Parameters',
  },
  {
    id: 'lifecycle',
    index: '06',
    name: 'Lifecycle',
    heading: 'Lifecycle Parameters',
  },
  {
    id: 'material',
    index: '07',
    name: 'Material',
    heading: 'Material Parameters',
  },
  {
    id: 'behavior',
    index: '08',
    name: 'Behavior',
    heading: 'Behavior Parameters',
  },
  {
    id: 'layered',
    index: '09',
    name: 'Layered',
    heading: 'Layered Parameters',
  },
]

export const INITIAL_SURFACE = {
  colorA: '#d9c8cd',
  colorB: '#c9dbdf',
  rimColor: '#f4e4ea',
  fresnelPower: 2.6,
  rimStrength: 0.36,
  opacity: 0.86,
}

export const INITIAL_INDIVIDUALITY = {
  seed: 884731,
  noiseScale: 2.8,
  patternContrast: 0.62,
  accentColor: '#7f9aa6',
  accentStrength: 0.72,
}

export const INITIAL_DEVELOPMENT = {
  age: 0.5,
  speed: 0.32,
  pulseSpeed: 1.1,
  displacement: 0.22,
  noiseAmount: 1.55,
}

export const INITIAL_DECAY = {
  age: 0.78,
  decayStart: 0.48,
  edgeSoftness: 0.2,
  boundaryWidth: 0.09,
  discardThreshold: 0.035,
  decayDisplacement: 0.055,
  decayScale: 1.25,
  decayAccent: '#c9a0aa',
}

export const INITIAL_TRACE = {
  age: 0.92,
  traceScale: 2.9,
  traceThreshold: 0.74,
  internalTrace: 0.42,
  rimTrace: 0.55,
  boundaryTrace: 0.35,
  traceOpacity: 0.26,
  traceFresnelPower: 3.2,
  persistence: 1,
  traceColor: '#e0d6dc',
}

export const MATERIAL_FAMILIES = [
  { id: 'membrane', label: 'Membrane' },
  { id: 'crystal', label: 'Crystalline' },
  { id: 'hybrid', label: 'Hybrid' },
]

/** How each family fails — shared age/seed, different response curves. */
export const DECAY_BIAS = {
  membrane: {
    thinning: 0.75,
    edgeSoftnessBias: 0.22,
    fractureSharpness: 0.15,
    lateWarp: 0.7,
  },
  crystal: {
    thinning: 0.35,
    edgeSoftnessBias: 0.06,
    fractureSharpness: 0.85,
    lateWarp: 1.15,
  },
  hybrid: {
    thinning: 0.55,
    edgeSoftnessBias: 0.14,
    fractureSharpness: 0.5,
    lateWarp: 0.9,
  },
}

/** Parameter bundles — substance families, not color swatches. */
export const MATERIAL_PRESETS = {
  membrane: {
    family: 'membrane',
    clarity: 0.18,
    fresnelPower: 2.4,
    rimStrength: 0.35,
    iridescence: 0.28,
    internalContrast: 0.45,
    transmission: 0.12,
    bodyAlpha: 0.86,
    ...DECAY_BIAS.membrane,
  },
  crystal: {
    family: 'crystal',
    clarity: 0.72,
    fresnelPower: 4.2,
    rimStrength: 0.78,
    iridescence: 0.72,
    internalContrast: 0.82,
    transmission: 0.58,
    bodyAlpha: 0.4,
    ...DECAY_BIAS.crystal,
  },
  hybrid: {
    family: 'hybrid',
    clarity: 0.48,
    fresnelPower: 3.2,
    rimStrength: 0.55,
    iridescence: 0.52,
    internalContrast: 0.68,
    transmission: 0.36,
    bodyAlpha: 0.68,
    ...DECAY_BIAS.hybrid,
  },
}

export const INITIAL_MATERIAL = { ...MATERIAL_PRESETS.membrane }

export function materialFromFamily(familyId) {
  return { ...(MATERIAL_PRESETS[familyId] ?? MATERIAL_PRESETS.membrane) }
}

/** Map clarity into opacity / transmission while keeping family character. */
export function applyMaterialClarity(material, clarity) {
  const family = material.family ?? 'membrane'
  const preset = MATERIAL_PRESETS[family] ?? MATERIAL_PRESETS.membrane
  const t = Math.min(1, Math.max(0, clarity))
  return {
    ...material,
    clarity: t,
    bodyAlpha: Math.min(0.94, Math.max(0.3, preset.bodyAlpha * (1 - t * 0.55))),
    transmission: Math.min(0.72, Math.max(0.05, preset.transmission * 0.25 + t * 0.7)),
  }
}

/** Seconds for one automatic Birth → Death pass in Study 06. */
export const LIFE_DURATION = 16

export const PRESERVE_AGE = 0.95

export function edgeAlpha(opacity) {
  return Math.min(1, opacity + 0.11)
}

export function studyLabel(study) {
  return `Study ${study.index} / ${study.name}`
}

export function lifecycleStage(age) {
  if (age >= 1) return 'trace'
  if (age >= 0.95) return 'death'
  if (age >= 0.75) return 'decay'
  if (age >= 0.55) return 'instability'
  if (age >= 0.25) return 'maturity'
  if (age > 0) return 'development'
  return 'birth'
}

/** Map lifecycle age to an existing study material (no new GLSL). */
export function lifecycleVisualStudy(age, isDead) {
  if (isDead || age >= 1) return 'trace'
  if (age >= 0.55) return 'decay'
  if (age > 0.02) return 'development'
  return 'individuality'
}

/**
 * Studies 07–08: one substance from birth through fragmentation; only death
 * hands off to the sparse trace layer.
 */
export function materialLifecycleVisualStudy(age, isDead) {
  if (isDead || age >= 0.95) return 'trace'
  return 'material'
}

export function isMaterialLifecycleStudy(studyId) {
  return studyId === 'material' || studyId === 'behavior'
}

export function isLifecycleStudy(studyId) {
  return studyId === 'lifecycle' || isMaterialLifecycleStudy(studyId)
}

export const LAYER_MODES = [
  { id: 'both', label: 'Both' },
  { id: 'outer', label: 'Outer' },
  { id: 'inner', label: 'Inner' },
]

export const INITIAL_LAYERED = {
  mode: 'both',
  age: 0.45,
  outerOpacity: 0.22,
  innerScale: 0.93,
  innerContrast: 0.65,
  // Pearly frosted membrane
  outerColorA: '#ebe6ea',
  outerColorB: '#dfe8ee',
  outerRimColor: '#f7f4f8',
  // Soft cyan ↔ pink core (reference iridescence)
  innerColorA: '#7ec8e8',
  innerColorB: '#f0a8c8',
}

export const INNER_SEED_OFFSET = 17.13
