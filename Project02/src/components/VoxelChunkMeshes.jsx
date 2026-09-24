import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

/**
 * Draw meshes for drawn (non-empty) chunks.
 * Empty chunks are skipped in remeshChunkBlock — nothing to mount.
 */
export default function VoxelChunkMeshes({ chunks = null, revision = 0, flatShading = false }) {
  const geometries = useMemo(() => {
    if (!chunks?.length) return []

    const list = []
    for (const chunk of chunks) {
      if (!chunk.drawn || !chunk.lastMesh || chunk.lastMesh.triangleCount <= 0) continue
      const { positions, normals } = chunk.lastMesh
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
      list.push({ key: chunk.key, geometry: geo })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, revision])

  useEffect(
    () => () => {
      for (const item of geometries) item.geometry.dispose()
    },
    [geometries],
  )

  if (geometries.length === 0) return null

  return (
    <group>
      {geometries.map(({ key, geometry }) => (
        <mesh key={key} geometry={geometry}>
          <meshStandardMaterial
            color="#c8c4cc"
            roughness={0.62}
            metalness={0.04}
            flatShading={flatShading}
            side={THREE.FrontSide}
          />
        </mesh>
      ))}
    </group>
  )
}
