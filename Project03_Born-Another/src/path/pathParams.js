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
}
