/**
 * Experiment 05 Final Form Lab — visual tuning params (Exp05-scoped only).
 */
import {
  INITIAL_PARTICLE,
  PARTICLE_COUNT_MAX,
  PARTICLE_COUNT_MIN,
} from '../../particle/particleParams.js'
import { PARTICLE_FULL_COUNT } from '../../renderBudget.js'
import { INITIAL_SCATTER } from '../../scatter/scatterParams.js'
import {
  EXP05_DEFAULT_MORPHOLOGY_TYPE,
  normalizeExp05MorphologyType,
} from './exp05MorphologyTypes.js'
import {
  EXP05_ENV_TEMPERATURE_NEUTRAL,
  normalizeExp05Temperature,
} from './exp05EnvironmentCoupling.js'
import { normalizeExp05SculpturalStrength } from './exp05SculpturalDeformation.js'

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

/** Temporary Exp05 white-out isolation — not a visual look control. */
export const EXP05_COMPOSITION_MODES = {
  BODY: 'body',
  BODY_PETALS: 'body-petals',
  BODY_PARTICLES: 'body-particles',
  FULL: 'full',
}

export const EXP05_COMPOSITION_MODE_OPTIONS = [
  { id: EXP05_COMPOSITION_MODES.BODY, label: 'Body Only' },
  { id: EXP05_COMPOSITION_MODES.BODY_PETALS, label: 'Body + Petals' },
  { id: EXP05_COMPOSITION_MODES.BODY_PARTICLES, label: 'Body + Particles' },
  { id: EXP05_COMPOSITION_MODES.FULL, label: 'Full Composition' },
]

/**
 * Morphology diagnostic appearance — same geometry + Life state, different look.
 * Switching modes must not reset AGE / Seed / morph / playback.
 */
export const EXP05_DIAGNOSTIC_MODES = {
  GEOMETRY: 'geometry',
  SURFACE_LIGHTING: 'surface-lighting',
  FULL: 'full',
}

export const EXP05_DIAGNOSTIC_MODE_OPTIONS = [
  { id: EXP05_DIAGNOSTIC_MODES.GEOMETRY, label: 'Geometry Only' },
  {
    id: EXP05_DIAGNOSTIC_MODES.SURFACE_LIGHTING,
    label: 'Surface + Lighting',
  },
  { id: EXP05_DIAGNOSTIC_MODES.FULL, label: 'Full Appearance' },
]

/**
 * Body material study — same geometry / Life; Explore default unchanged.
 * Pearlescent is Exp05-scoped custom shader (not World MeshPhysical).
 */
export const EXP05_MATERIAL_MODES = {
  EXPLORE: 'explore',
  PEARLESCENT: 'pearlescent',
  PEARLESCENT_V2: 'pearlescent-v2',
}

export const EXP05_MATERIAL_MODE_OPTIONS = [
  { id: EXP05_MATERIAL_MODES.EXPLORE, label: 'Original Explore' },
  {
    id: EXP05_MATERIAL_MODES.PEARLESCENT,
    label: 'Pearlescent Membrane',
  },
  {
    id: EXP05_MATERIAL_MODES.PEARLESCENT_V2,
    label: 'Pearlescent V2',
  },
]

export const EXP05_LAB_DEFAULTS = {
  petalDensity: INITIAL_SCATTER.density,
  petalScale: INITIAL_SCATTER.size,
  /** 0 = PARTICLE_COUNT_MIN, 1 = PARTICLE_FULL_COUNT (Explore default). */
  particleDensity: 1,
  /** Drives ParticleField pulseStrength + fieldComplexity. */
  particleMotion: INITIAL_PARTICLE.pulseStrength,
  /**
   * Scales Life localDeformations (stimulus bumps). Inert until stimuli exist;
   * still stored so presets stay comparable when stimuli are added later.
   */
  macroDeformationStrength: 1,
  /**
   * Amplifies Explore-framed radiusAt deviation from the field mean
   * (0 → sphere, 1 → native rest field, >1 → stronger lobes).
   */
  morphologyComplexity: 1,
  /**
   * Radial rest silhouette: world | segmented | spiral.
   * Independent of Low/Med/High amplitude and macro deformation.
   */
  morphologyType: EXP05_DEFAULT_MORPHOLOGY_TYPE,
  /** Temporary layer isolation for white-out debugging. */
  compositionMode: EXP05_COMPOSITION_MODES.FULL,
  /** Morphology diagnostic look (geometry / lit / full Explore). */
  diagnosticMode: EXP05_DIAGNOSTIC_MODES.FULL,
  /** Body material: Pearlescent Membrane (default) | Original Explore. */
  materialMode: EXP05_MATERIAL_MODES.PEARLESCENT,
  /**
   * Playground Temperature coupling (membrane expand/contract).
   * Not Life Engine state — immediate visual; neutral 0.5 = recovered.
   */
  temperature: EXP05_ENV_TEMPERATURE_NEUTRAL,
  /**
   * Optional Exp05 sculptural tangential deformation (post-radial).
   * 0 = identity — current radial morphology unchanged.
   */
  sculpturalStrength: 0,
}

export const EXP05_LAB_META = {
  petalDensity: {
    label: 'Petal Density',
    min: 0,
    max: 1,
    step: 0.01,
    available: true,
    binding: 'scatter density → growth-site petal count',
  },
  petalScale: {
    label: 'Petal Scale',
    min: 0.25,
    max: 2,
    step: 0.01,
    available: true,
    binding: 'scatter size → instance scale',
  },
  particleDensity: {
    label: 'Particle Density',
    min: 0,
    max: 1,
    step: 0.01,
    available: true,
    binding: 'ParticleField count',
  },
  particleMotion: {
    label: 'Particle Motion',
    min: 0,
    max: 1,
    step: 0.01,
    available: true,
    binding: 'pulseStrength + fieldComplexity',
  },
  macroDeformationStrength: {
    label: 'Macro Deformation Strength',
    min: 0,
    max: 3,
    step: 0.01,
    available: true,
    binding: 'Life localDeformations amplitude (needs stimuli)',
  },
  morphologyComplexity: {
    label: 'Morphology Complexity',
    min: 0.25,
    max: 2.25,
    step: 0.01,
    available: true,
    binding: 'radiusAt lobe amplitude vs field mean',
  },
  sculpturalStrength: {
    label: 'Sculptural Deformation',
    min: 0,
    max: 2,
    step: 0.01,
    available: true,
    binding: 'tangential seed-driven silhouette offset (post-radial)',
  },
}

export function particleCountFromLabDensity(density) {
  const t = clamp01(density)
  const max = Math.min(PARTICLE_FULL_COUNT, PARTICLE_COUNT_MAX)
  const min = PARTICLE_COUNT_MIN
  return Math.round(min + t * (max - min))
}

function normalizeCompositionMode(value) {
  const allowed = new Set(Object.values(EXP05_COMPOSITION_MODES))
  return allowed.has(value) ? value : EXP05_COMPOSITION_MODES.FULL
}

export function normalizeExp05DiagnosticMode(value) {
  const allowed = new Set(Object.values(EXP05_DIAGNOSTIC_MODES))
  return allowed.has(value) ? value : EXP05_DIAGNOSTIC_MODES.FULL
}

export function normalizeExp05MaterialMode(value) {
  const allowed = new Set(Object.values(EXP05_MATERIAL_MODES))
  return allowed.has(value) ? value : EXP05_MATERIAL_MODES.PEARLESCENT
}

export function normalizeExp05LabParams(partial = {}) {
  const next = { ...EXP05_LAB_DEFAULTS, ...partial }
  next.petalDensity = clamp01(next.petalDensity)
  next.petalScale = Math.min(
    EXP05_LAB_META.petalScale.max,
    Math.max(EXP05_LAB_META.petalScale.min, Number(next.petalScale) || 1),
  )
  next.particleDensity = clamp01(next.particleDensity)
  next.particleMotion = clamp01(next.particleMotion)
  next.macroDeformationStrength = Math.min(
    EXP05_LAB_META.macroDeformationStrength.max,
    Math.max(
      EXP05_LAB_META.macroDeformationStrength.min,
      Number(next.macroDeformationStrength) || 0,
    ),
  )
  next.morphologyComplexity = Math.min(
    EXP05_LAB_META.morphologyComplexity.max,
    Math.max(
      EXP05_LAB_META.morphologyComplexity.min,
      Number(next.morphologyComplexity) || 1,
    ),
  )
  next.sculpturalStrength = normalizeExp05SculpturalStrength(
    next.sculpturalStrength,
  )
  next.morphologyType = normalizeExp05MorphologyType(next.morphologyType)
  next.compositionMode = normalizeCompositionMode(next.compositionMode)
  next.diagnosticMode = normalizeExp05DiagnosticMode(next.diagnosticMode)
  next.materialMode = normalizeExp05MaterialMode(next.materialMode)
  next.temperature = normalizeExp05Temperature(next.temperature)
  return next
}
