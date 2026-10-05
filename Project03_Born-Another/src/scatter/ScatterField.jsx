import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createBudGeometry } from './BudAsset.js'
import { sampleSphereSurface } from './sampleSurface.js'
import { scatterCountFromDensity } from './scatterParams.js'
import {
  scatterAttachmentFragmentShader,
  scatterAttachmentVertexShader,
} from '../surfaceShader.js'

const UP = new THREE.Vector3(0, 1, 0)

/**
 * Instanced procedural buds attached to the deforming base surface.
 * Rest samples stay on the unit sphere; GPU applies the shared Study 03
 * displacement. Local +Y is aligned to the surface normal so buds grow out.
 */
export default function ScatterField({
  density = 0.45,
  seed = 1,
  generation = 0,
  radius = 1,
  surfaceSeed = 884731,
  noiseScale = 2.8,
  age = 0.5,
  speed = 0.32,
  pulseSpeed = 1.1,
  displacement = 0.22,
  noiseAmount = 1.55,
  colorA = '#d9c8cd',
  colorB = '#c9dbdf',
  rimColor = '#f4e4ea',
}) {
  const meshRef = useRef(null)
  const count = scatterCountFromDensity(density)

  const samples = useMemo(
    () =>
      sampleSphereSurface({
        count,
        seed: seed + generation * 9973,
        radius,
      }),
    [count, seed, generation, radius],
  )

  const geometry = useMemo(() => createBudGeometry(), [])

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
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uRimColor: { value: new THREE.Color(rimColor) },
      uBodyAlpha: { value: 0.78 },
      uFresnelPower: { value: 2.4 },
      uRimStrength: { value: 0.38 },
    }),
    [],
  )

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: scatterAttachmentVertexShader,
        fragmentShader: scatterAttachmentFragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [uniforms],
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const dummy = new THREE.Object3D()
    const normal = new THREE.Vector3()
    const axis = new THREE.Vector3()

    for (let i = 0; i < samples.length; i += 1) {
      const { position, normal: n } = samples[i]
      normal.set(n[0], n[1], n[2]).normalize()
      dummy.position.set(position[0], position[1], position[2])
      // Local +Y (bud growth) → surface normal.
      if (Math.abs(normal.y) > 0.999) {
        dummy.quaternion.setFromAxisAngle(axis.set(1, 0, 0), normal.y > 0 ? 0 : Math.PI)
      } else {
        dummy.quaternion.setFromUnitVectors(UP, normal)
      }
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }

    mesh.count = samples.length
    mesh.instanceMatrix.needsUpdate = true
  }, [samples])

  useLayoutEffect(() => {
    uniforms.uAge.value = age
    uniforms.uSeed.value = surfaceSeed
    uniforms.uNoiseScale.value = noiseScale
    uniforms.uSpeed.value = speed
    uniforms.uPulseSpeed.value = pulseSpeed
    uniforms.uDisplacement.value = displacement
    uniforms.uNoiseAmount.value = noiseAmount
    uniforms.uColorA.value.set(colorA)
    uniforms.uColorB.value.set(colorB)
    uniforms.uRimColor.value.set(rimColor)
  }, [
    uniforms,
    age,
    surfaceSeed,
    noiseScale,
    speed,
    pulseSpeed,
    displacement,
    noiseAmount,
    colorA,
    colorB,
    rimColor,
  ])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()
  })

  useLayoutEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  if (samples.length === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, Math.max(samples.length, 1)]}
      frustumCulled={false}
      renderOrder={2}
    />
  )
}
