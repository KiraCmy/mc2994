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
  decayStart: 0.52,
  edgeSoftness: 0.14,
  boundaryWidth: 0.07,
  discardThreshold: 0.06,
  decayDisplacement: 0.07,
  decayScale: 2.35,
  decayAccent: '#b87a8a',
}

export const INITIAL_TRACE = {
  age: 0.92,
  traceScale: 2.6,
  traceThreshold: 0.62,
  internalTrace: 0.7,
  rimTrace: 0.85,
  boundaryTrace: 0.55,
  traceOpacity: 0.42,
  traceFresnelPower: 2.8,
  persistence: 1,
  traceColor: '#d8dde4',
}

export function edgeAlpha(opacity) {
  return Math.min(1, opacity + 0.11)
}

export function studyLabel(study) {
  return `Study ${study.index} / ${study.name}`
}
