import { organismSpatialMaterialFragmentShader } from './organismSpatialMaterialShader.js'

export { default as CrystalDemo } from './CrystalDemo.jsx'
export { default as OrganismStudio } from './OrganismStudio.jsx'
export { ORIGINAL_DEMO_OPTICAL } from './materialParams.js'
export {
  INITIAL_ORGANISM_MATERIAL,
  MATERIAL_DIAGNOSTIC_MODES,
  ORGANISM_MATERIAL_SLIDERS,
} from './materialParams.js'
export {
  createOrganismMaterialUniforms,
  syncOrganismMaterialUniforms,
} from './organismMaterial.js'
export {
  createOrganismPhysicalMaterial,
  ORGANISM_PHYSICAL_REVISION,
  syncOrganismDeformUniforms,
  syncOrganismPhysicalMaterial,
} from './organismPhysicalMaterial.js'
export { organismMaterialFragmentShader as coreShellMaterialFragmentShader } from './organismMaterialShader.js'
export { organismSpatialMaterialFragmentShader }

// Active MATERIAL shader. Core + Shell (Study 01) is kept but disabled.
export const organismMaterialFragmentShader = organismSpatialMaterialFragmentShader
