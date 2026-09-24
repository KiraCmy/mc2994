import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { AtmosphereBackground } from './atmosphereBackground.js'
import VoxelBlocks from './VoxelBlocks.jsx'
import VoxelChunkMeshes from './VoxelChunkMeshes.jsx'
import VoxelIsosurface from './VoxelIsosurface.jsx'

function ViewportAids({ showAxis, resetNonce, gridScale }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  const initialRef = useRef(null)

  const axes = useMemo(
    () => new THREE.AxesHelper(Math.max(1, gridScale * 0.5)),
    [gridScale],
  )

  useEffect(
    () => () => {
      axes.geometry.dispose()
      const materials = Array.isArray(axes.material) ? axes.material : [axes.material]
      materials.forEach((material) => material?.dispose())
    },
    [axes],
  )

  useLayoutEffect(() => {
    if (!controls || initialRef.current) return
    initialRef.current = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      zoom: camera.zoom,
      target: controls.target.clone(),
    }
    controls.saveState?.()
  }, [camera, controls])

  useEffect(() => {
    if (!resetNonce || !controls || !initialRef.current) return
    const initial = initialRef.current
    camera.position.copy(initial.position)
    camera.quaternion.copy(initial.quaternion)
    camera.zoom = initial.zoom
    controls.target.copy(initial.target)
    camera.updateProjectionMatrix()
    controls.reset?.()
    controls.update()
  }, [resetNonce, camera, controls])

  return <primitive object={axes} visible={showAxis} />
}

/**
 * R3F viewport for the Voxel tab (no HeightField).
 * Lighting is shared. displayMode is exclusive A/B:
 *   'blocks' → InstancedMesh voxels (grid or chunks)
 *   'mesh'   → chunk MC meshes when available, else full-grid isosurface
 */
export default function VoxelScene({
  grid = null,
  chunks = null,
  threshold = 0,
  revision = 0,
  displayMode = 'blocks',
  mesherId = 'mc',
  gridScale = 3.2,
  showAxis = false,
  showGrid = true,
  cameraResetNonce = 0,
}) {
  const helperScale = chunks?.length
    ? chunks[0].size * chunks[0].voxelSize * 2
    : grid
      ? grid.size * grid.voxelSize
      : gridScale
  const showBlocks = displayMode === 'blocks'
  const showMesh = displayMode === 'mesh'
  const useChunkMeshes = showMesh && chunks?.length > 0

  return (
    <Canvas
      className="scene-3d"
      camera={{ position: [3.4, 2.8, 3.4], fov: 42, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      resize={{ debounce: 0 }}
      onCreated={({ gl }) => {
        gl.setClearColor('#11131B')
      }}
    >
      <AtmosphereBackground />
      <ambientLight intensity={0.32} color="#d0d0d0" />
      <directionalLight position={[5.6, 8.2, 3.4]} intensity={1.45} color="#ffffff" />
      <directionalLight position={[-3.2, 2.4, -4.5]} intensity={0.24} color="#ffffff" />
      {showBlocks && (chunks?.length || grid) ? (
        <VoxelBlocks
          chunks={chunks}
          grid={chunks?.length ? null : grid}
          threshold={threshold}
          revision={revision}
        />
      ) : null}
      {useChunkMeshes ? (
        <VoxelChunkMeshes
          chunks={chunks}
          revision={revision}
          flatShading={mesherId === 'culled'}
        />
      ) : null}
      {showMesh && !useChunkMeshes && grid ? (
        <VoxelIsosurface
          grid={grid}
          threshold={threshold}
          revision={revision}
          mesherId={mesherId}
        />
      ) : null}
      <gridHelper
        args={[helperScale * 1.15, 10, '#4d4d4d', '#242424']}
        position={[0, -0.02, 0]}
        visible={showGrid}
      />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      <ViewportAids showAxis={showAxis} resetNonce={cameraResetNonce} gridScale={helperScale} />
    </Canvas>
  )
}
