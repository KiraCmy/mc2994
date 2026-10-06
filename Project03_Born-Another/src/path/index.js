export { default as PathField } from './PathField.jsx'
export { INITIAL_PATH } from './pathParams.js'
export {
  PATH_GROWTH_MAX,
  PATH_GROWTH_DURATION,
  packPathRestPoints,
  pathStrokeProgress,
  pathGrowthWeight,
  applyPathGrowth,
} from './pathGrowth.js'
export {
  PATH_EXTENSION_LENGTH,
  PATH_EXTENSION_DURATION,
  PATH_EXTENSION_WANDER,
  planSurfaceExtension,
  revealExtensionPlan,
  extensionRibbonPoints,
} from './pathExtend.js'
export {
  buildSurfaceSpline,
  consolidateRestStroke,
  createStrokeId,
} from './pathSpline.js'
export { deformRestPoint, raycastUnitSphere } from './surfaceDisplace.js'

