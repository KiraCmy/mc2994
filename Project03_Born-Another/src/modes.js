/** Top-level project modes. Shader holds Studies 01–09. */
export const MODES = [
  { id: 'shader', label: 'Shader' },
  { id: 'scatter', label: 'Scatter' },
  { id: 'path', label: 'Path' },
  { id: 'particle', label: 'Particle' },
]

export function isShaderMode(modeId) {
  return modeId === 'shader'
}
