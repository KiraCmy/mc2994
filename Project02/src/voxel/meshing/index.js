import { meshFromScalarField } from '../marchingCubes.js'
import { CULLED_FACES_MESHER, meshCulledFaces } from './culledFaces.js'

/**
 * Stage 7 mesher registry.
 * Marching Cubes is the smooth default; culled faces is the blocky face-emitter.
 */

export const MARCHING_CUBES_MESHER = {
  id: 'mc',
  label: 'MARCHING CUBES',
  input: 'density',
  mesh: meshFromScalarField,
}

export const VOXEL_MESHERS = [MARCHING_CUBES_MESHER, CULLED_FACES_MESHER]

/** Smooth default for MESH view. */
export const DEFAULT_MESHER_ID = 'mc'

export function getVoxelMesher(id = DEFAULT_MESHER_ID) {
  return VOXEL_MESHERS.find((m) => m.id === id) ?? MARCHING_CUBES_MESHER
}

export function meshWithMesher(id, grid, iso = 0) {
  const mesher = getVoxelMesher(id)
  return mesher.mesh(grid, iso)
}

export { meshFromScalarField, meshCulledFaces }
