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
  {
    id: '02',
    label: 'Experiment 02',
    title: 'Independent Life B',
    description:
      'Two autonomous procedural organisms share one 3D scene and camera while keeping independent Life Engines, AGE, seeds, crystals, and local stimuli. Environmental coupling between A and B is not introduced yet.',
  },
  {
    id: '03',
    label: 'Experiment 03',
    title: 'Agent Behaviors',
    description:
      'Multi-scale agent studies. Study 01 — Crystal Agents: autonomous FSM growth on the Exp05 membrane with moisture coupling and an inspector. Studies 02–03 placeholders.',
  },
  {
    id: '04',
    label: 'Experiment 04',
    title: 'Morphology Lab',
    description:
      'Compare Flattened, Spiral, and Segmented rest shapes in one WorldViewport. Silhouette comes from injectable radial radius fields; membrane deformation, growth sites, and crystals stay on the existing World pipeline.',
  },
  {
    id: '05',
    label: 'Experiment 05',
    title: 'Final Form Lab',
    description:
      'Phase C2: World morphology + Explore ethereal look. Body material study — Biological Membrane (living tissue) with Pearlescent A/B. Lab tunes petals, particles, and morph strength.',
  },
]

export const DEFAULT_PLAYGROUND_EXPERIMENT_ID = PLAYGROUND_EXPERIMENTS[0].id

export function getPlaygroundExperiment(id) {
  return (
    PLAYGROUND_EXPERIMENTS.find((item) => item.id === id) ??
    PLAYGROUND_EXPERIMENTS[0]
  )
}
