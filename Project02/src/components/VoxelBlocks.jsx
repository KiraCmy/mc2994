import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { index3 } from '../voxel/VoxelGrid.js'

const _matrix = new THREE.Matrix4()
const _color = new THREE.Color()

/**
 * BLOCKS view — one InstancedMesh for the whole volume (Stage 8).
 * Accepts either a single `grid` or a `chunks` array (same density, world space).
 */
export default function VoxelBlocks({
  grid = null,
  chunks = null,
  threshold = 0,
  revision = 0,
}) {
  const meshRef = useRef(null)
  const sources = chunks?.length ? chunks : grid ? [grid] : []

  const capacity = useMemo(() => {
    let n = 0
    for (const src of sources) n += src.values?.length ?? src.cellCount ?? 0
    return n
  }, [sources, revision])

  const voxelSize = sources[0]?.voxelSize ?? 0.2

  const geometry = useMemo(() => {
    return new THREE.BoxGeometry(voxelSize * 0.92, voxelSize * 0.92, voxelSize * 0.92)
  }, [voxelSize])

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry],
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || capacity === 0) return

    let instance = 0
    for (const src of sources) {
      const size = src.size
      const values = src.values
      const origin = src.origin
      const vs = src.voxelSize
      const ox = origin[0]
      const oy = origin[1]
      const oz = origin[2]
      const extentY = size * vs || 1

      for (let k = 0; k < size; k++) {
        for (let j = 0; j < size; j++) {
          for (let i = 0; i < size; i++) {
            const d = values[index3(size, i, j, k)]
            if (d <= threshold) continue

            const x = ox + (i + 0.5) * vs
            const y = oy + (j + 0.5) * vs
            const z = oz + (k + 0.5) * vs
            _matrix.makeTranslation(x, y, z)
            mesh.setMatrixAt(instance, _matrix)

            const t = Math.min(1, Math.max(0, (y - oy) / extentY))
            _color.setRGB(0.45 + t * 0.35, 0.48 + t * 0.2, 0.55)
            mesh.setColorAt(instance, _color)
            instance++
          }
        }
      }
    }

    mesh.count = instance
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [sources, threshold, capacity, revision])

  if (capacity === 0) return null

  return (
    <instancedMesh
      key={`${sources.length}-${voxelSize}-${capacity}`}
      ref={meshRef}
      args={[geometry, undefined, capacity]}
      frustumCulled={false}
      castShadow={false}
    >
      <meshStandardMaterial color="#ffffff" roughness={0.62} metalness={0.04} />
    </instancedMesh>
  )
}
