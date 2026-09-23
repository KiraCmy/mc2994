import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { sampleHeight } from '../noise/generateNoiseMap.js'
import CaptureBridge from './CaptureBridge.jsx'
import { AtmosphereBackground } from './atmosphereBackground.js'

function skipRaycast() {}

const BIOME = {
  lowland: [0x4a / 255, 0x4d / 255, 0x5a / 255],
  highland: [0x72 / 255, 0x6b / 255, 0x79 / 255],
  rock: [0xa3 / 255, 0x9a / 255, 0xa1 / 255],
  peaks: [0xe8 / 255, 0xe5 / 255, 0xe7 / 255],
  accent: [0xff / 255, 0x14 / 255, 0x93 / 255],
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-6, edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function sampleStops(stops, t) {
  if (t <= stops[0].t) return stops[0].c
  if (t >= stops[stops.length - 1].t) return stops[stops.length - 1].c
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (t >= a.t && t <= b.t) {
      const u = smoothstep(a.t, b.t, t)
      return lerp3(a.c, b.c, u)
    }
  }
  return stops[stops.length - 1].c
}

/** Land-only biome colors. Water is drawn as a separate plane. */
function biomeColor(t, waterLevel, slope) {
  const stops = [
    { t: 0.0, c: BIOME.lowland },
    { t: 0.26, c: BIOME.lowland },
    { t: 0.5, c: BIOME.highland },
    { t: 0.74, c: BIOME.rock },
    { t: 1.0, c: BIOME.peaks },
  ]

  let color = sampleStops(stops, t)

  // Ridges/valleys: darken steep slopes so form reads more clearly
  const shade = 1 - Math.min(0.34, slope * 0.55)
  color = [color[0] * shade, color[1] * shade, color[2] * shade]

  // Tiny shoreline accent only — never a terrain base
  const shore = 1 - Math.min(1, Math.abs(t - waterLevel) / 0.016)
  if (shore > 0) {
    color = lerp3(color, BIOME.accent, shore * shore * 0.045)
  }

  return color
}

function vertexSlope(heights, i, res, span) {
  const x = i % res
  const y = (i / res) | 0
  const h = heights[i]
  const left = x > 0 ? heights[i - 1] : h
  const right = x < res - 1 ? heights[i + 1] : h
  const down = y > 0 ? heights[i - res] : h
  const up = y < res - 1 ? heights[i + res] : h
  const dx = (right - left) / span
  const dy = (up - down) / span
  return Math.min(1, Math.sqrt(dx * dx + dy * dy) * 1.8)
}

/**
 * Height field mesh: Y from the shared noiseMap.height array (× displace).
 * SOLID uses grayscale height; BIOME uses neutral land bands + a water plane.
 */
function HeightField({ noiseMap, displace, gridScale, displayMode, waterLevel = 0 }) {
  const meshRef = useRef(null)
  const overlayRef = useRef(null)
  const baseRef = useRef(null)
  const [waterY, setWaterY] = useState(0)

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
    const res = noiseMap.resolution
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
    const useBiome = displayMode === 'biome'
    const w = Math.min(0.72, Math.max(0, waterLevel))
    setWaterY(hMin + w * span)

    for (let i = 0; i < pos.count; i++) {
      const t = (heights[i] - hMin) / span
      let r
      let g
      let b

      if (useBiome) {
        const slope = vertexSlope(heights, i, res, span)
        ;[r, g, b] = biomeColor(t, w, slope)
      } else {
        const toMid = smoothstep(0, 0.5, t)
        const toHigh = smoothstep(0.5, 1, t)
        const dark = 0.16
        const mid = 0.48
        const light = 0.82
        const lowBand = dark + (mid - dark) * toMid
        const gray = lowBand + (light - lowBand) * toHigh
        r = gray
        g = gray
        b = gray
      }

      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    pos.needsUpdate = true
    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    mesh.geometry.computeVertexNormals()
  }, [noiseMap, displace, gridScale, displayMode, waterLevel])

  const showSolid = displayMode !== 'wireframe'
  const showWire = displayMode === 'wireframe' || displayMode === 'solid-wire'
  const showWater = displayMode === 'biome'
  const wireColor = displayMode === 'wireframe' ? '#c8c8c8' : '#2f2f2f'
  const wireOpacity = displayMode === 'wireframe' ? 0.5 : 0.16
  const roughness = displayMode === 'biome' ? 0.7 : 0.62

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} visible={showSolid}>
        <meshStandardMaterial
          vertexColors
          color="#ffffff"
          roughness={roughness}
          metalness={displayMode === 'biome' ? 0.04 : 0.02}
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
      {showWater ? <WaterPlane y={waterY} size={gridScale * 1.04} /> : null}
    </group>
  )
}

/** Flat lake surface — constant world Y, never deformed by the height field. */
function WaterPlane({ y, size }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, y, 0]}
      renderOrder={2}
      raycast={skipRaycast}
    >
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        color="#161A24"
        transparent
        opacity={0.68}
        roughness={0.94}
        metalness={0.12}
        envMapIntensity={0.2}
        depthWrite
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
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
  waterLevel = 0,
  showAxis = false,
  showGrid = true,
  cameraResetNonce = 0,
  captureApiRef = null,
}) {
  const biomeLighting = displayMode === 'biome'

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
      <ambientLight intensity={biomeLighting ? 0.22 : 0.32} color="#d0d0d0" />
      <directionalLight
        position={[5.6, 8.2, 3.4]}
        intensity={biomeLighting ? 1.7 : 1.45}
        color="#ffffff"
      />
      <directionalLight
        position={[-3.2, 2.4, -4.5]}
        intensity={biomeLighting ? 0.18 : 0.24}
        color="#ffffff"
      />
      {noiseMap ? (
        <HeightField
          noiseMap={noiseMap}
          displace={displace}
          gridScale={gridScale}
          displayMode={displayMode}
          waterLevel={waterLevel}
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
