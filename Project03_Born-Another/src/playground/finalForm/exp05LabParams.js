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
   * (0 → sphere, 1 → native World rest, >1 → stronger lobes).
   */
  morphologyComplexity: 1,
  /** Temporary layer isolation for white-out debugging. */
  compositionMode: EXP05_COMPOSITION_MODES.FULL,
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
  next.compositionMode = normalizeCompositionMode(next.compositionMode)
  return next
}
