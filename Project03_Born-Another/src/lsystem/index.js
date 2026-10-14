export { default as LSystemField } from './LSystemField.jsx'
export {
  expandLSystem,
  turtleBranches,
  turtleSegments,
  buildLSystemGeometry,
} from './generateLSystem.js'
export {
  buildVeinTopology,
  buildVeinRibbonAttributes,
  buildVeinDebugSamples,
} from './attachLSystemToSurface.js'
export {
  applyVeinLifecycle,
  veinLifecycleAtAge,
  LSYSTEM_TOPOLOGY_AGE,
} from './lsystemLifecycle.js'
// Free-space turtle remains available for experiments / capture scripts.
export {
  INITIAL_LSYSTEM,
  LSYSTEM_AXIOM,
  LSYSTEM_RULES,
  LSYSTEM_DEPTH_MIN,
  LSYSTEM_DEPTH_MAX,
  LSYSTEM_ANGLE_MIN,
  LSYSTEM_ANGLE_MAX,
  LSYSTEM_LENGTH_MIN,
  LSYSTEM_LENGTH_MAX,
  LSYSTEM_BRANCH_ROTATION_MIN,
  LSYSTEM_BRANCH_ROTATION_MAX,
  LSYSTEM_RANDOMNESS_MIN,
  LSYSTEM_RANDOMNESS_MAX,
  LSYSTEM_ORIGIN_COUNT,
  LSYSTEM_RAYS_PER_SITE,
  LSYSTEM_SURFACE_OFFSET,
  LSYSTEM_MICRO_STEP,
  LSYSTEM_VEIN_COLOR,
} from './lsystemParams.js'
