/** Simulation modes (algorithms wired in later). */
export const SIMULATION_MODES = [
  { id: 'wind', label: 'WIND FIELD' },
  { id: 'particle', label: 'PARTICLE FLOW' },
  { id: 'erosion', label: 'HYDRAULIC EROSION' },
]

export const DEFAULT_SIMULATION_MODE = 'particle'

export function getSimulationMode(id) {
  return SIMULATION_MODES.find((m) => m.id === id) ?? SIMULATION_MODES[0]
}
