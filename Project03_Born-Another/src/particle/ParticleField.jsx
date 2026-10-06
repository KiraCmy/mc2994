import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  particleSurfaceFragmentShader,
  particleSurfaceVertexShader,
} from '../surfaceShader.js'
import { PARTICLE_COUNT_MAX, PARTICLE_COUNT_MIN } from './particleParams.js'

function mulberry32(seed) {
  let t = seed >>> 0
  return function next() {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Exact unit-sphere rest samples (Fibonacci). */
function sampleUnitSphere(count, seed) {
  const n = Math.max(0, Math.floor(count))
  const rand = mulberry32(Math.floor(seed) || 1)
  const samples = new Array(n)
  const golden = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < n; i += 1) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2
    const rAtY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i + (rand() - 0.5) * 0.55
    const x = Math.cos(theta) * rAtY
    const z = Math.sin(theta) * rAtY
    const len = Math.hypot(x, y, z) || 1
    samples[i] = [x / len, y / len, z / len]
  }
  return samples
}

const _dummy = new THREE.Object3D()

/**
 * Near-surface particle layer (Scatter-style attachment).
 * Instance matrices sit on the unit-sphere rest; the GPU mirrors the body's
 * lifecycle surface and lifts grit slightly so it floats above the membrane.
 */
export default function ParticleField({
  count = 2800,
  seed = 44017,
  surfaceSeed = 884731,
  noiseScale = 2.8,
  age = 0.5,
  speed = 0.32,
  pulseSpeed = 1.1,
  displacement = 0.22,
  noiseAmount = 1.55,
  decayScale = 1.25,
  decayDisplacement = 0.055,
  lateWarp = 1,
  /** Local sphere radius before instance scale. */
  particleRadius = 0.0095,
  /** Clearance between membrane and grit underside (object units). */
  floatOffset = 0.022,
}) {
  const meshRef = useRef(null)
  const materialRef = useRef(null)

  const n = Math.min(
    PARTICLE_COUNT_MAX,
    Math.max(PARTICLE_COUNT_MIN, Math.floor(count)),
  )

  const rests = useMemo(() => sampleUnitSphere(n, seed), [n, seed])

  const geometry = useMemo(() => new THREE.SphereGeometry(1, 6, 6), [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAge: { value: age },
      uSeed: { value: surfaceSeed },
      uNoiseScale: { value: noiseScale },
      uSpeed: { value: speed },
      uPulseSpeed: { value: pulseSpeed },
      uDisplacement: { value: displacement },
      uNoiseAmount: { value: noiseAmount },
      uDecayScale: { value: decayScale },
      uDecayDisplacement: { value: decayDisplacement },
      uLateWarp: { value: lateWarp },
      uFloatOffset: { value: floatOffset },
      uColor: { value: new THREE.Color('#f4fbff') },
      uOpacity: { value: 0.78 },
      uGlowStrength: { value: 1.25 },
    }),
    [],
  )

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: particleSurfaceVertexShader,
        fragmentShader: particleSurfaceFragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [uniforms],
  )

  useLayoutEffect(() => {
    materialRef.current = material
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  // Place instances on the rest sphere once (Scatter pattern).
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const scale = Math.max(0.004, particleRadius)
    for (let i = 0; i < rests.length; i += 1) {
      const r = rests[i]
      _dummy.position.set(r[0], r[1], r[2])
      _dummy.scale.setScalar(scale)
      _dummy.rotation.set(0, 0, 0)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.count = rests.length
  }, [rests, particleRadius])

  useLayoutEffect(() => {
    const mat = materialRef.current
    if (!mat) return
    mat.uniforms.uAge.value = age
    mat.uniforms.uSeed.value = surfaceSeed
    mat.uniforms.uNoiseScale.value = noiseScale
    mat.uniforms.uSpeed.value = speed
    mat.uniforms.uPulseSpeed.value = pulseSpeed
    mat.uniforms.uDisplacement.value = displacement
    mat.uniforms.uNoiseAmount.value = noiseAmount
    mat.uniforms.uDecayScale.value = decayScale
    mat.uniforms.uDecayDisplacement.value = decayDisplacement
    mat.uniforms.uLateWarp.value = lateWarp
    mat.uniforms.uFloatOffset.value = floatOffset
  }, [
    age,
    surfaceSeed,
    noiseScale,
    speed,
    pulseSpeed,
    displacement,
    noiseAmount,
    decayScale,
    decayDisplacement,
    lateWarp,
    floatOffset,
  ])

  useFrame(({ clock }) => {
    const mat = materialRef.current
    if (!mat) return
    mat.uniforms.uTime.value = clock.getElapsedTime()
    mat.uniforms.uAge.value = age
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, Math.max(1, rests.length)]}
      frustumCulled={false}
      renderOrder={3}
    />
  )
}
