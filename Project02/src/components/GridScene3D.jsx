import { useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { sampleField } from '../noise/generateNoiseMap.js'

/**
 * Height field mesh: Y from curl magnitude / potential.
 * Optional wireframe (line) vs solid shaded surface.
 */
function HeightField({ noiseMap, displace, gridScale, wireframe }) {
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

      const res = noiseMap.resolution
      const m = sampleField(noiseMap.mag, res, u, v)
      const pot = sampleField(noiseMap.potential, res, u, v)
      // Height field: blend magnitude with shaped potential for terrain relief
      const h = (m * 0.65 + ((pot + 1) * 0.5) * 0.35) * displace

      pos.setXYZ(i, bx, h, bz)

      const t = Math.min(1, Math.max(0, h / Math.max(0.001, displace)))
      colors[i * 3] = 0.55 + t * 0.45
      colors[i * 3 + 1] = 0.55 + t * 0.4
      colors[i * 3 + 2] = 0.55 + t * 0.28
    }

    pos.needsUpdate = true
    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    mesh.geometry.computeVertexNormals()
  }, [noiseMap, displace, gridScale])

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        wireframe={wireframe}
        flatShading={!wireframe}
        metalness={wireframe ? 0.05 : 0.12}
        roughness={wireframe ? 0.85 : 0.55}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export default function GridScene3D({ noiseMap, displace, gridScale, wireframe = false }) {
  return (
    <Canvas
      className="scene-3d"
      camera={{ position: [3.4, 2.8, 3.4], fov: 42, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor('#000000')
      }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 8, 2]} intensity={1.15} color="#ffffff" />
      <directionalLight position={[-3, 2, -4]} intensity={0.25} color="#e040a0" />
      {noiseMap ? (
        <HeightField
          noiseMap={noiseMap}
          displace={displace}
          gridScale={gridScale}
          wireframe={wireframe}
        />
      ) : null}
      <gridHelper args={[gridScale * 1.15, 10, '#5f5f5f', '#2d2d2d']} position={[0, -0.02, 0]} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI * 0.49} />
    </Canvas>
  )
}
