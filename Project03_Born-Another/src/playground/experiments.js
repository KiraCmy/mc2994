/**
 * Playground experiment registry.
 * Add a new experiment by appending an entry and mapping it in PlaygroundPage.
 */
export const PLAYGROUND_EXPERIMENTS = [
  {
    id: '01',
    label: 'Experiment 01',
    title: 'Language as Environment',
    description:
      'Can human language alter environmental conditions and indirectly shape the evolution of a procedural organism? Step 03B: Temperature deforms Branch B immediately and accumulates thermal structural memory that persists after the environment recovers.',
  },
]

export const DEFAULT_PLAYGROUND_EXPERIMENT_ID = PLAYGROUND_EXPERIMENTS[0].id

export function getPlaygroundExperiment(id) {
  return (
    PLAYGROUND_EXPERIMENTS.find((item) => item.id === id) ??
    PLAYGROUND_EXPERIMENTS[0]
  )
}
