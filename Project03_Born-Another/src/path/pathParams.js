/** Path mode defaults — surface strokes stored in rest space. */
export const INITIAL_PATH = {
  /** Closed strokes: each is an ordered list of unit-sphere rest samples. */
  strokes: [],
  /** When true, pointer drag draws; otherwise orbit / zoom only. */
  drawing: false,
  /** Lift along deformed normal so the spline stays visible. */
  surfaceOffset: 0.045,
  /** Tube radius for the visible path ribbon. */
  lineRadius: 0.016,
  /** Minimum rest-space distance between successive draw samples. */
  sampleSpacing: 0.045,
  /** Outward swell along the path (body vertices) — final maximum. */
  growthStrength: 0.28,
  /** Chord-distance falloff radius for path influence — final maximum. */
  growthRadius: 0.32,
  /**
   * Seconds after a stroke closes for influence to reach full strength/radius.
   * Growth expands from the path outward; sliders stay the caps.
   */
  growthDuration: 3.2,
  /** Arc length of organism-continued path on the unit sphere (rest space). */
  extensionLength: 1.15,
  /** Seconds for the auto-extension to fully reveal from the tip. */
  extensionDuration: 4.6,
  /** Heading wander while the organism continues the path on the surface. */
  extensionWander: 0.4,
}
