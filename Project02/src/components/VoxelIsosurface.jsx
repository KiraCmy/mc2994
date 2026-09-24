import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEFAULT_MESHER_ID, meshWithMesher } from '../voxel/meshing/index.js'

/**
 * Density / binary isosurface mesh — uses VoxelScene lights (no local lights).
 * Default mesher is Marching Cubes (smooth). Pass mesherId="culled" for face quads.
 *
 * Dispose discipline matches HeightField in GridScene3D.
 */
export default function VoxelIsosurface({
  grid,
  threshold = 0,
  revision = 0,
  mesherId = DEFAULT_MESHER_ID,
}) {
  const geometry = useMemo(() => {
    if (!grid) return null

    const { positions, normals, triangleCount } = meshWithMesher(mesherId, grid, threshold)
    if (triangleCount === 0) return null

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    return geo
  }, [grid, threshold, revision, mesherId])

  useEffect(
    () => () => {
      geometry?.dispose()
    },
    [geometry],
  )

  if (!geometry) return null

  const flat = mesherId === 'culled'

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#c8c4cc"
        roughness={0.62}
        metalness={0.04}
        flatShading={flat}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}
