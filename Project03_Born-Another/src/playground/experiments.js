/**
 * Playground experiment registry.
 * Add a new experiment by appending an entry and mapping it in PlaygroundPage.
 */
export const PLAYGROUND_EXPERIMENTS = [
  {
    id: '01',
    label: 'Experiment 01',
    title: 'Experiment 01',
    description:
      'Empty workspace reserved for a future Three.js / R3F prototype. No scene is mounted yet.',
  },
]

export const DEFAULT_PLAYGROUND_EXPERIMENT_ID = PLAYGROUND_EXPERIMENTS[0].id

export function getPlaygroundExperiment(id) {
  return (
    PLAYGROUND_EXPERIMENTS.find((item) => item.id === id) ??
    PLAYGROUND_EXPERIMENTS[0]
  )
}
