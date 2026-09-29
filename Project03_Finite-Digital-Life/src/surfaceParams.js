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
  age: 0.45,
  speed: 0.28,
  pulseSpeed: 1.25,
  displacement: 0.09,
  noiseAmount: 1.2,
}

export function edgeAlpha(opacity) {
  return Math.min(1, opacity + 0.11)
}

export function studyLabel(study) {
  return `Study ${study.index} / ${study.name}`
}
