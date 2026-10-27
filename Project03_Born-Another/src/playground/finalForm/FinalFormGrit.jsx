import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleSphereSurface } from '../../scatter/sampleSurface.js'
import { resolveParticleDrawCount } from '../../renderBudget.js'
import { INITIAL_PARTICLE } from '../../particle/particleParams.js'
import { INITIAL_INDIVIDUALITY, INITIAL_SURFACE } from '../../surfaceParams.js'
import { deformDirectionToSurface } from './finalFormSurface.js'
import {
  finalFormGritFragmentShader,
  finalFormGritVertexShader,
} from './finalFormShaders.js'

/**
 * Dense Explore-tint particle field on World's deformed membrane.
 * Uses surface sampling (not GPGPU Study flow) so grit stays seated on Life Engine form.
 */
export default function FinalFormGrit({
  world,
  life,
  tintCool = INITIAL_SURFACE.rimColor,
  tintWarm = INITIAL_INDIVIDUALITY.accentColor,
  tintSoft = INITIAL_SURFACE.colorA,
  opacity = 0.72,
  fieldThickness = 0.11,
}) {
  const pointsRef = useRef(null)
  const count = useMemo(
    () =>
      resolveParticleDrawCount(INITIAL_PARTICLE.count, {
        explore: true,
      }),
    [],
  )

  const samples = useMemo(
    () =>
      sampleSphereSurface({
        count,
        seed: (life?.seed ?? 7319) ^ 0x44017,
        radius: 1,
        jitter: 0.42,
      }),
    [count, life?.seed],
  )

  const { geometry, material, buffers } = useMemo(() => {
    const n = samples.length
    const positions = new Float32Array(n * 3)
    const sizes = new Float32Array(n)
    const tints = new Float32Array(n * 3)
    const cool = new THREE.Color(tintCool)
    const warm = new THREE.Color(tintWarm)
    const soft = new THREE.Color(tintSoft)
    const mix = new THREE.Color()

    for (let i = 0; i < n; i += 1) {
      const u = (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296
      const v = (Math.imul(i + 7, 1597334677) >>> 0) / 4294967296
      const w = (Math.imul(i + 13, 2246822519) >>> 0) / 4294967296
      /* Cyan / orange / pink / white distribution like Explore. */
      if (u < 0.42) mix.copy(cool)
      else if (u < 0.62) mix.copy(warm)
      else if (u < 0.88) mix.copy(soft)
      else mix.setRGB(0.96, 0.98, 1)
      mix.lerp(cool, v * 0.2)
      tints[i * 3] = mix.r
      tints[i * 3 + 1] = mix.g
      tints[i * 3 + 2] = mix.b
      /* Mostly fine grains, sparse brighter/larger. */
      const bright = w * w
      sizes[i] = 0.7 + bright * 3.2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aTint', new THREE.BufferAttribute(tints, 3))
    geo.setDrawRange(0, n)

    const mat = new THREE.ShaderMaterial({
      vertexShader: finalFormGritVertexShader,
      fragmentShader: finalFormGritFragmentShader,
      uniforms: { uOpacity: { value: opacity } },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })

    return { geometry: geo, material: mat, buffers: { positions } }
  }, [samples, tintCool, tintWarm, tintSoft, opacity])

  useLayoutEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useLayoutEffect(() => {
    material.uniforms.uOpacity.value = opacity
  }, [material, opacity])

  const ageRef = useRef(-1)
  useFrame(() => {
    if (!world || !life || !pointsRef.current) return
    /* Rebuild when AGE moves; skip identical frames for Windows cost. */
    const age = life.age
    if (Math.abs(age - ageRef.current) < 0.0005 && ageRef.current >= 0) return
    ageRef.current = age

    const positions = buffers.positions
    const n = samples.length
    let written = 0
    for (let i = 0; i < n; i += 1) {
      const sample = samples[i]
      const anchored = deformDirectionToSurface(world, life, sample.normal)
      if (!anchored) continue
      const lift =
        ((Math.imul(i + 3, 2246822519) >>> 0) / 4294967296) *
        fieldThickness *
        (0.15 + ((Math.imul(i + 9, 1597334677) >>> 0) / 4294967296) * 0.85)
      positions[written * 3] =
        anchored.position[0] + anchored.normal[0] * lift
      positions[written * 3 + 1] =
        anchored.position[1] + anchored.normal[1] * lift
      positions[written * 3 + 2] =
        anchored.position[2] + anchored.normal[2] * lift
      written += 1
    }
    geometry.attributes.position.needsUpdate = true
    geometry.setDrawRange(0, written)
    pointsRef.current.visible = written > 0
  })

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={5}
    />
  )
}
