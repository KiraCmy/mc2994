/**
 * Organism material — one parameter set describing the body's substance.
 * Lives apart from the Shader-tab Study 07 material so any tab can opt in
 * later by passing these params to `Specimen` as `organismMaterial`.
 */
export const INITIAL_ORGANISM_MATERIAL = {
  /** Stored only. The spatial mask is off for the physical baseline. */
  coreOpacity: 0.7,
  /** MeshPhysicalMaterial transmission. */
  shellTransmission: 1,
  /** MeshPhysicalMaterial roughness. */
  roughness: 0.06,
  /** MeshPhysicalMaterial index of refraction. */
  ior: 1.62,
  /** Ignored while the spatial mask is disabled. */
  showMask: false,
  /**
   * MATERIAL-tab diagnostic. `baseline` is a unit sphere; `organism` is the
   * same material with AGE displacement. Both share one MeshPhysicalMaterial.
   */
  diagnostic: 'organism',
  /**
   * MATERIAL-tab optical test. Overrides the sliders while it is selected.
   * `reflection` is opaque, `clear` is untinted glass, `claude` is the demo.
   * The tab opens on the Claude material.
   */
  optical: 'claude',
  /** Optional transmission backdrop. Off in the presentation. */
  showChecker: false,
}

/** Isolated port of crystal-standalone.html. Not an organism material preset. */
export const ORIGINAL_DEMO_OPTICAL = 'original'

export const MATERIAL_DIAGNOSTIC_MODES = [
  { id: 'baseline', label: 'A · Sphere' },
  { id: 'organism', label: 'B · Organism' },
]

export const MATERIAL_OPTICAL_MODES = [
  { id: 'reflection', label: '1 · Reflection' },
  { id: 'clear', label: '2 · Clear Glass' },
  { id: 'claude', label: '3 · Claude' },
  { id: ORIGINAL_DEMO_OPTICAL, label: '4 · Original Demo' },
]

/** Slider definitions shared by every panel that exposes the material. */
export const ORGANISM_MATERIAL_SLIDERS = [
  { key: 'coreOpacity', label: 'Core Opacity', min: 0, max: 1, step: 0.01 },
  { key: 'shellTransmission', label: 'Shell Transmission', min: 0, max: 1, step: 0.01 },
  { key: 'roughness', label: 'Roughness', min: 0.02, max: 1, step: 0.01 },
  { key: 'ior', label: 'IOR', min: 1, max: 2.4, step: 0.01 },
]
