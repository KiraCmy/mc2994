/**
 * Exp05-only morphology calibration — remaps lab knobs onto the existing
 * World radiusAt + localDeformations pipeline (no new shape algorithm).
 */
import * as THREE from 'three'

const _dir = new THREE.Vector3()

export function clampMorphAmplitude(value, fallback = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(3, Math.max(0, n))
}

/**
 * Scale deviation of a rest radius from the field mean.
 * amplitude 0 → sphere at mean; 1 → native radiusAt; >1 → stronger lobes.
 */
export function calibrateRestRadius(restRadius, meanRadius, amplitude = 1) {
  const radius = Number(restRadius)
  const mean = Number(meanRadius)
  if (!Number.isFinite(radius)) return radius
  const amp = clampMorphAmplitude(amplitude, 1)
  const center = Number.isFinite(mean) && mean > 1e-6 ? mean : radius
  return Math.max(1e-4, center + (radius - center) * amp)
}

/** Fibonacci-ish mean of an Explore-framed radiusAt field. */
export function estimateRadiusAtMean(radiusAt, sampleCount = 256) {
  if (typeof radiusAt !== 'function') return 1
  const n = Math.max(32, Math.floor(sampleCount))
  let sum = 0
  let valid = 0
  for (let i = 0; i < n; i += 1) {
    const t = (i + 0.5) / n
    const z = 1 - 2 * t
    const r = Math.sqrt(Math.max(0, 1 - z * z))
    const phi = (i * 2.399963229728653) % (Math.PI * 2)
    _dir.set(r * Math.cos(phi), r * Math.sin(phi), z)
    const radius = radiusAt(_dir)
    if (Number.isFinite(radius)) {
      sum += radius
      valid += 1
    }
  }
  return valid > 0 ? sum / valid : 1
}

export function estimateRestPositionsMean(restPositions) {
  if (!restPositions || restPositions.length < 3) return 1
  let sum = 0
  let count = 0
  for (let i = 0; i < restPositions.length; i += 3) {
    sum += Math.hypot(
      restPositions[i],
      restPositions[i + 1],
      restPositions[i + 2],
    )
    count += 1
  }
  return count > 0 ? sum / count : 1
}

/**
 * Presets only touch morphology knobs — AGE / Seed / petals / particles unchanged.
 * Values chosen so Low / Medium / High produce measurable radius-span deltas
 * from the same radiusAt field (see Exp05 morph audit).
 */
export const EXP05_MORPH_PRESETS = {
  low: {
    id: 'low',
    label: 'Low',
    morphologyComplexity: 0.45,
    macroDeformationStrength: 0.35,
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    morphologyComplexity: 1,
    macroDeformationStrength: 1,
  },
  high: {
    id: 'high',
    label: 'High',
    morphologyComplexity: 1.85,
    macroDeformationStrength: 2.4,
  },
}

export const EXP05_MORPH_PRESET_OPTIONS = [
  EXP05_MORPH_PRESETS.low,
  EXP05_MORPH_PRESETS.medium,
  EXP05_MORPH_PRESETS.high,
]

export function applyMorphPreset(lab, presetId) {
  const preset =
    EXP05_MORPH_PRESETS[presetId] ||
    Object.values(EXP05_MORPH_PRESETS).find((entry) => entry.id === presetId)
  if (!preset || !lab) return lab
  return {
    ...lab,
    morphologyComplexity: preset.morphologyComplexity,
    macroDeformationStrength: preset.macroDeformationStrength,
  }
}

export function matchMorphPresetId(lab) {
  if (!lab) return null
  const complexity = Number(lab.morphologyComplexity)
  const deform = Number(lab.macroDeformationStrength)
  for (const preset of EXP05_MORPH_PRESET_OPTIONS) {
    if (
      Math.abs(complexity - preset.morphologyComplexity) < 0.001 &&
      Math.abs(deform - preset.macroDeformationStrength) < 0.001
    ) {
      return preset.id
    }
  }
  return null
}
