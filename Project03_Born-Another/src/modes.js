/** Primary information architecture. */
export const MODES = [
  { id: 'concept', label: 'Concept' },
  { id: 'studies', label: 'Studies' },
  { id: 'system', label: 'System' },
  { id: 'worldv2', label: 'World' },
]

/** Technical studies share one Canvas and retain their state in App. */
export const STUDY_MODES = [
  { id: 'shader', label: 'Shader' },
  { id: 'scatter', label: 'Scatter' },
  { id: 'path', label: 'Path' },
  { id: 'particle', label: 'Particle' },
  { id: 'explore', label: 'Explore' },
  { id: 'lsystem', label: 'L-System' },
  { id: 'material', label: 'Material' },
]

export function isShaderMode(modeId) {
  return modeId === 'shader'
}

export function isStudyMode(modeId) {
  return STUDY_MODES.some((mode) => mode.id === modeId)
}

export function sectionForMode(modeId) {
  return isStudyMode(modeId) ? 'studies' : modeId
}

export const DEFAULT_STUDY_MODE = 'shader'

export function parseAppRoute(hash = '') {
  const raw = String(hash).replace(/^#\/?/, '').trim()
  if (!raw) return { modeId: DEFAULT_STUDY_MODE, studyId: null }

  const [head, sub] = raw.split('/')
  const token = head.toLowerCase()
  if (token === 'world' || token === 'worldv2') {
    return { modeId: 'worldv2', studyId: null }
  }
  if (token === 'studies') {
    return { modeId: DEFAULT_STUDY_MODE, studyId: null }
  }
  if (token === 'concept' || token === 'system') {
    return { modeId: token, studyId: null }
  }
  if (isStudyMode(token)) {
    return {
      modeId: token,
      studyId: token === 'shader' && sub ? sub : null,
    }
  }
  return { modeId: DEFAULT_STUDY_MODE, studyId: null }
}

export function appRouteHash(modeId, studyId) {
  if (modeId === 'worldv2') return '#world'
  if (modeId === 'shader' && studyId && studyId !== 'surface') {
    return `#shader/${studyId}`
  }
  return `#${modeId}`
}
