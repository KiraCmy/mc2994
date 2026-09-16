import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { sampleField } from '../noise/generateNoiseMap.js'
import { sampleHeight } from '../simulation/particleSystem.js'
import CaptureBridge from './CaptureBridge.jsx'

function Terrain({ noiseMap, displace, gridScale }) {
  const meshRef = useRef(null)
  const baseRef = useRef(null)

  const geometry = useMemo(() => {
    const res = noiseMap?.resolution ?? 32
    const geo = new THREE.PlaneGeometry(gridScale, gridScale, res - 1, res - 1)
    geo.rotateX(-Math.PI / 2)
    baseRef.current = Float32Array.from(geo.attributes.position.array)
    return geo
  }, [noiseMap?.resolution, gridScale])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !noiseMap || !baseRef.current) return

    const pos = mesh.geometry.attributes.position
    const base = baseRef.current
    const colors = new Float32Array(pos.count * 3)
    const half = gridScale * 0.5

    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3]
      const bz = base[i * 3 + 2]
      const u = (bx + half) / gridScale
      const v = (bz + half) / gridScale
      const h = sampleHeight(noiseMap, u, v, displace)
      pos.setXYZ(i, bx, h, bz)
      const t = Math.min(1, Math.max(0, h / Math.max(0.001, displace)))
      colors[i * 3] = 0.35 + t * 0.35
      colors[i * 3 + 1] = 0.35 + t * 0.35
      colors[i * 3 + 2] = 0.35 + t * 0.35
    }
    pos.needsUpdate = true
    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    mesh.geometry.computeVertexNormals()
  }, [noiseMap, displace, gridScale])

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        wireframe
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function WindLines({ noiseMap, displace, gridScale, windStrength, vectorDensity }) {
  const lineRef = useRef(null)

  const { geometry, count } = useMemo(() => {
    const density = Math.max(4, Math.min(32, Math.floor(vectorDensity)))
    const segments = density * density
    const positions = new Float32Array(segments * 2 * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return { geometry: geo, count: density }
  }, [vectorDensity])

  useEffect(() => {
    if (!noiseMap || !lineRef.current) return
    const pos = geometry.attributes.position.array
    const half = gridScale * 0.5
    const denom = Math.max(1, count - 1)
    const gain = 0.12 * Math.max(0.05, windStrength)
    let o = 0

    for (let j = 0; j < count; j++) {
      for (let i = 0; i < count; i++) {
        const u = i / denom
        const v = j / denom
        const cx = sampleField(noiseMap.vx, noiseMap.resolution, u, v)
        const cy = sampleField(noiseMap.vy, noiseMap.resolution, u, v)
        const h = sampleHeight(noiseMap, u, v, displace) + 0.02
        const x = u * gridScale - half
        const z = v * gridScale - half
        const len = gain
        pos[o++] = x
        pos[o++] = h
        pos[o++] = z
        pos[o++] = x + cx * len
        pos[o++] = h
        pos[o++] = z + cy * len
      }
    }
    geometry.attributes.position.needsUpdate = true
  }, [noiseMap, displace, gridScale, windStrength, count, geometry])

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineBasicMaterial color="#ff1493" transparent opacity={0.85} />
    </lineSegments>
  )
}

function ParticlePoints({ particleSystem, noiseMap, displace, gridScale, particleCount, particleSize }) {
  const pointsRef = useRef(null)
  const noiseRef = useRef(noiseMap)
  noiseRef.current = noiseMap

  const geometry = useMemo(() => {
    const n = Math.max(1, Math.floor(particleCount))
    particleSystem.ensureCount(n)
    const positions = new Float32Array(n * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [particleSystem, particleCount])

  useFrame(() => {
    const map = noiseRef.current
    const attr = geometry.attributes.position
    if (!map || !attr) return

    particleSystem.ensureCount(particleCount)
    const x = particleSystem.getPosX()
    const y = particleSystem.getPosY()
    const n = particleSystem.getCount()
    const half = gridScale * 0.5
    const arr = attr.array

    for (let i = 0; i < n; i++) {
      const u = x[i]
      const v = y[i]
      const h = sampleHeight(map, u, v, displace) + 0.04
      arr[i * 3] = u * gridScale - half
      arr[i * 3 + 1] = h
      arr[i * 3 + 2] = v * gridScale - half
    }
    attr.needsUpdate = true
    attr.count = n
    geometry.setDrawRange(0, n)
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#ff1493"
        size={Math.max(0.02, particleSize * 0.04)}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

function ErosionTerrainMesh({ erosionTerrain, gridScale, version }) {
  const meshRef = useRef(null)
  const baseRef = useRef(null)
  const res = erosionTerrain?.isReady() ? erosionTerrain.getResolution() : 32
  const lastRev = useRef(-1)

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(gridScale, gridScale, res - 1, res - 1)
    geo.rotateX(-Math.PI / 2)
    baseRef.current = Float32Array.from(geo.attributes.position.array)
    lastRev.current = -1
    return geo
  }, [res, gridScale])

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry],
  )

  const syncMesh = () => {
    const mesh = meshRef.current
    if (!mesh || !erosionTerrain?.isReady() || !baseRef.current) return

    const rev = erosionTerrain.getRevision()
    if (rev === lastRev.current && lastRev.current >= 0) return
    lastRev.current = rev

    const pos = mesh.geometry.attributes.position
    const base = baseRef.current
    const colors = new Float32Array(pos.count * 3)
    const half = gridScale * 0.5
    const displaceAmt = Math.max(0.001, erosionTerrain.getDisplace())

    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3]
      const bz = base[i * 3 + 2]
      const u = (bx + half) / gridScale
      const v = (bz + half) / gridScale
      const h = erosionTerrain.sample(u, v)
      const wet = Math.min(1, erosionTerrain.sampleWater(u, v) / 0.2)
      // Slight pool rise so accumulated water reads in silhouette
      pos.setXYZ(i, bx, h + wet * 0.045, bz)

      const t = Math.min(1, Math.max(0, h / displaceAmt))
      let r = 0.2 + t * 0.55
      let g = 0.2 + t * 0.5
      let b = 0.2 + t * 0.48
      if (wet > 0.03) {
        r = r * (1 - wet * 0.55) + 0.85 * wet
        g = g * (1 - wet * 0.5) + 0.12 * wet
        b = b * (1 - wet * 0.2) + 0.72 * wet
      }
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
    pos.needsUpdate = true
    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    mesh.geometry.computeVertexNormals()
  }

  useEffect(() => {
    lastRev.current = -1
    syncMesh()
  }, [erosionTerrain, gridScale, version, geometry])

  useFrame(() => {
    syncMesh()
  })

  if (!erosionTerrain?.isReady()) return null

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        roughness={0.68}
        metalness={0.03}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

function RaindropPoints({ raindropSystem, erosionTerrain, gridScale, rainAmount }) {
  const geometry = useMemo(() => {
    const n = Math.max(1, Math.floor(rainAmount))
    raindropSystem.ensureCount(n)
    const positions = new Float32Array(n * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [raindropSystem, rainAmount])

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry],
  )

  useFrame(() => {
    const attr = geometry.attributes.position
    if (!attr || !erosionTerrain?.isReady() || !raindropSystem?.isActive()) {
      geometry.setDrawRange(0, 0)
      return
    }

    raindropSystem.ensureCount(rainAmount)
    const x = raindropSystem.getPosX()
    const y = raindropSystem.getPosY()
    const hy = raindropSystem.getHeightY()
    const phase = raindropSystem.getPhase()
    const n = raindropSystem.getCount()
    if (!x || !y || !hy || n === 0) {
      geometry.setDrawRange(0, 0)
      return
    }

    const half = gridScale * 0.5
    const arr = attr.array
    const falling = raindropSystem.PHASE_FALLING
    for (let i = 0; i < n; i++) {
      const u = x[i]
      const v = y[i]
      const surface = erosionTerrain.sample(u, v)
      const wet = erosionTerrain.sampleWater(u, v)
      const groundClearance = 0.045 + Math.min(0.07, wet * 0.3)
      let worldY = hy[i]
      if (phase && phase[i] !== falling) {
        worldY = Math.max(hy[i], surface + groundClearance)
      } else {
        worldY = Math.max(hy[i], surface + 0.03)
      }
      arr[i * 3] = u * gridScale - half
      arr[i * 3 + 1] = worldY
      arr[i * 3 + 2] = v * gridScale - half
    }
    attr.needsUpdate = true
    geometry.setDrawRange(0, n)
  })

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={2}>
      <pointsMaterial
        color="#ff1493"
        size={0.028}
        sizeAttenuation
        depthTest
        depthWrite={false}
        transparent
        opacity={0.92}
        toneMapped={false}
      />
    </points>
  )
}

/**
 * 3D simulation view: height field + wind lines and/or particles.
 */
export default function SimulationScene3D({
  mode,
  noiseMap,
  params,
  particleSystem,
  captureApiRef = null,
  erosionTerrain = null,
  raindropSystem = null,
  erosionVersion = 0,
}) {
  const gridScale = params.gridScale
  const displace = params.displace
  const isErosion = mode === 'erosion'

  return (
    <Canvas
      className="scene-3d sim-scene-3d"
      camera={{ position: [3.6, 2.8, 3.6], fov: 42, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      resize={{ debounce: 0 }}
      onCreated={({ gl }) => {
        gl.setClearColor('#000000')
      }}
    >
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 8, 2]} intensity={1.0} color="#ffffff" />
      <directionalLight position={[-3, 2, -4]} intensity={0.35} color="#ff1493" />

      {isErosion ? (
        <ErosionTerrainMesh
          erosionTerrain={erosionTerrain}
          gridScale={gridScale}
          version={erosionVersion}
        />
      ) : noiseMap ? (
        <Terrain noiseMap={noiseMap} displace={displace} gridScale={gridScale} />
      ) : null}

      {isErosion && raindropSystem ? (
        <RaindropPoints
          raindropSystem={raindropSystem}
          erosionTerrain={erosionTerrain}
          gridScale={gridScale}
          rainAmount={params.rainAmount}
        />
      ) : null}

      {!isErosion && noiseMap && mode === 'wind' ? (
        <WindLines
          noiseMap={noiseMap}
          displace={displace}
          gridScale={gridScale}
          windStrength={params.windStrength}
          vectorDensity={params.vectorDensity}
        />
      ) : null}

      {!isErosion && noiseMap && mode === 'particle' && particleSystem ? (
        <ParticlePoints
          particleSystem={particleSystem}
          noiseMap={noiseMap}
          displace={displace}
          gridScale={gridScale}
          particleCount={params.particleCount}
          particleSize={params.particleSize}
        />
      ) : null}

      <gridHelper args={[gridScale * 1.15, 10, '#4d4d4d', '#242424']} position={[0, -0.02, 0]} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI * 0.49} />
      <CaptureBridge captureApiRef={captureApiRef} />
    </Canvas>
  )
}

