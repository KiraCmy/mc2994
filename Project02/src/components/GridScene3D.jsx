import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { sampleHeight } from '../noise/generateNoiseMap.js'
import CaptureBridge from './CaptureBridge.jsx'

function skipRaycast() {}

/**
 * Height field mesh: Y from the shared noiseMap.height array (× displace).
 * SOLID vertex colors are driven by normalized height; wire modes share geometry.
 */
function HeightField({ noiseMap, displace, gridScale, displayMode }) {
  const meshRef = useRef(null)
  const overlayRef = useRef(null)
  const baseRef = useRef(null)

  const geometry = useMemo(() => {
    const res = noiseMap?.resolution ?? 32
    const geo = new THREE.PlaneGeometry(gridScale, gridScale, res - 1, res - 1)
    geo.rotateX(-Math.PI / 2)
    baseRef.current = Float32Array.from(geo.attributes.position.array)
    return geo
  }, [noiseMap?.resolution, gridScale])

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry],
  )

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !noiseMap || !baseRef.current) return

    const pos = mesh.geometry.attributes.position
    const base = baseRef.current
    const half = gridScale * 0.5
    const colors = new Float32Array(pos.count * 3)
    const heights = new Float32Array(pos.count)
    let hMin = Infinity
    let hMax = -Infinity

    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3]
      const bz = base[i * 3 + 2]
      const u = (bx + half) / gridScale
      const v = (bz + half) / gridScale

      const h = sampleHeight(noiseMap, u, v, displace)

      pos.setXYZ(i, bx, h, bz)
      heights[i] = h
      hMin = Math.min(hMin, h)
      hMax = Math.max(hMax, h)
    }

    const span = Math.max(1e-5, hMax - hMin)

    for (let i = 0; i < pos.count; i++) {
      const t = (heights[i] - hMin) / span
      // Smooth dark → mid → light gray across elevation (no accent color)
      const toMid = smoothstep(0, 0.5, t)
      const toHigh = smoothstep(0.5, 1, t)
      const dark = 0.16
      const mid = 0.48
      const light = 0.82
      const lowBand = dark + (mid - dark) * toMid
      const g = lowBand + (light - lowBand) * toHigh

      colors[i * 3] = g
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = g
    }

    pos.needsUpdate = true
    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    mesh.geometry.computeVertexNormals()
  }, [noiseMap, displace, gridScale])

  const showSolid = displayMode !== 'wireframe'
  const showWire = displayMode !== 'solid'
  const wireColor = displayMode === 'wireframe' ? '#c8c8c8' : '#2f2f2f'
  const wireOpacity = displayMode === 'wireframe' ? 0.5 : 0.16

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} visible={showSolid}>
        <meshStandardMaterial
          vertexColors
          color="#ffffff"
          roughness={0.62}
          metalness={0.02}
          envMapIntensity={0}
          flatShading={false}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
          side={THREE.FrontSide}
        />
      </mesh>
      <mesh ref={overlayRef} geometry={geometry} visible={showWire} raycast={skipRaycast}>
        <meshBasicMaterial
          color={wireColor}
          wireframe
          transparent
          opacity={wireOpacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-6, edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

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

export default function GridScene3D({
  noiseMap,
  displace,
  gridScale,
  displayMode = 'solid',
  showAxis = false,
  showGrid = true,
  cameraResetNonce = 0,
  captureApiRef = null,
}) {
  return (
    <Canvas
      className="scene-3d"
      camera={{ position: [3.4, 2.8, 3.4], fov: 42, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      resize={{ debounce: 0 }}
      onCreated={({ gl }) => {
        gl.setClearColor('#000000')
      }}
    >
      <ambientLight intensity={0.32} color="#d0d0d0" />
      <directionalLight position={[5.6, 8.2, 3.4]} intensity={1.45} color="#ffffff" />
      <directionalLight position={[-3.2, 2.4, -4.5]} intensity={0.24} color="#ffffff" />
      {noiseMap ? (
        <HeightField
          noiseMap={noiseMap}
          displace={displace}
          gridScale={gridScale}
          displayMode={displayMode}
        />
      ) : null}
      <gridHelper
        args={[gridScale * 1.15, 10, '#4d4d4d', '#242424']}
        position={[0, -0.02, 0]}
        visible={showGrid}
      />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI * 0.49} />
      <ViewportAids showAxis={showAxis} resetNonce={cameraResetNonce} gridScale={gridScale} />
      <CaptureBridge captureApiRef={captureApiRef} />
    </Canvas>
  )
}
