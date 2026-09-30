import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  innerCoreFragmentShader,
  innerLayeredVertexShader,
  outerLayeredVertexShader,
  outerShellFragmentShader,
} from './surfaceShader.js'

function createOuterUniforms({
  outerColorA,
  outerColorB,
  outerRimColor,
  innerColorA,
  innerColorB,
  seed,
  age,
  outerOpacity,
}) {
  return {
    uColorA: { value: new THREE.Color(outerColorA) },
    uColorB: { value: new THREE.Color(outerColorB) },
    uRimColor: { value: new THREE.Color(outerRimColor) },
    uInnerTintA: { value: new THREE.Color(innerColorA) },
    uInnerTintB: { value: new THREE.Color(innerColorB) },
    uLow: { value: -0.65 },
    uHigh: { value: 0.75 },
    uFresnelPower: { value: 2.2 },
    uRimStrength: { value: 0.42 },
    uBodyAlpha: { value: outerOpacity },
    uSeed: { value: seed },
    uNoiseScale: { value: 1.35 },
    uPatternContrast: { value: 0.35 },
    uAccentColor: { value: new THREE.Color(outerColorB) },
    uAccentStrength: { value: 0.28 },
    uTime: { value: 0 },
    uAge: { value: age },
    uSpeed: { value: 0.14 },
    uPulseSpeed: { value: 0.38 },
    uDisplacement: { value: 0.14 },
    uNoiseAmount: { value: 1.15 },
  }
}

function createInnerUniforms({
  innerColorA,
  innerColorB,
  outerColorA,
  outerColorB,
  seed,
  age,
  innerContrast,
}) {
  return {
    uColorA: { value: new THREE.Color(innerColorA) },
    uColorB: { value: new THREE.Color(innerColorB) },
    uShellTintA: { value: new THREE.Color(outerColorA) },
    uShellTintB: { value: new THREE.Color(outerColorB) },
    uRimColor: { value: new THREE.Color(innerColorB) },
    uLow: { value: -0.65 },
    uHigh: { value: 0.75 },
    uFresnelPower: { value: 2.0 },
    uRimStrength: { value: 0.22 },
    uBodyAlpha: { value: 0.62 },
    // Same seed as outer so sharedBody() matches across layers.
    uSeed: { value: seed },
    uNoiseScale: { value: 0.95 },
    uPatternContrast: { value: 0.5 },
    uAccentColor: { value: new THREE.Color(innerColorB) },
    uAccentStrength: { value: 0.55 },
    uTime: { value: 0 },
    uAge: { value: age },
    uSpeed: { value: 0.14 },
    uPulseSpeed: { value: 0.38 },
    uDisplacement: { value: 0.15 },
    uNoiseAmount: { value: 1.15 },
    uInternalContrast: { value: innerContrast },
  }
}

export default function LayeredBody({
  seed,
  age,
  mode = 'both',
  outerOpacity = 0.22,
  innerScale = 0.93,
  innerContrast = 0.65,
  outerColorA = '#ebe6ea',
  outerColorB = '#dfe8ee',
  outerRimColor = '#f7f4f8',
  innerColorA = '#7ec8e8',
  innerColorB = '#f0a8c8',
}) {
  const outerRef = useRef(null)
  const innerRef = useRef(null)

  const showOuter = mode === 'both' || mode === 'outer'
  const showInner = mode === 'both' || mode === 'inner'

  const outerUniforms = useMemo(
    () =>
      createOuterUniforms({
        outerColorA,
        outerColorB,
        outerRimColor,
        innerColorA,
        innerColorB,
        seed,
        age,
        outerOpacity,
      }),
    [],
  )
  const innerUniforms = useMemo(
    () =>
      createInnerUniforms({
        innerColorA,
        innerColorB,
        outerColorA,
        outerColorB,
        seed,
        age,
        innerContrast,
      }),
    [],
  )

  useLayoutEffect(() => {
    const mat = outerRef.current
    if (!mat) return
    mat.uniforms.uColorA.value.set(outerColorA)
    mat.uniforms.uColorB.value.set(outerColorB)
    mat.uniforms.uRimColor.value.set(outerRimColor)
    mat.uniforms.uInnerTintA.value.set(innerColorA)
    mat.uniforms.uInnerTintB.value.set(innerColorB)
    mat.uniforms.uAccentColor.value.set(outerColorB)
    mat.uniforms.uBodyAlpha.value = outerOpacity
    mat.uniforms.uSeed.value = seed
    mat.uniforms.uAge.value = age
  }, [
    showOuter,
    outerColorA,
    outerColorB,
    outerRimColor,
    innerColorA,
    innerColorB,
    seed,
    age,
    outerOpacity,
  ])

  useLayoutEffect(() => {
    const mat = innerRef.current
    if (!mat) return
    mat.uniforms.uColorA.value.set(innerColorA)
    mat.uniforms.uColorB.value.set(innerColorB)
    mat.uniforms.uShellTintA.value.set(outerColorA)
    mat.uniforms.uShellTintB.value.set(outerColorB)
    mat.uniforms.uRimColor.value.set(innerColorB)
    mat.uniforms.uAccentColor.value.set(innerColorB)
    mat.uniforms.uSeed.value = seed
    mat.uniforms.uAge.value = age
    mat.uniforms.uInternalContrast.value = innerContrast
  }, [showInner, innerColorA, innerColorB, outerColorA, outerColorB, seed, age, innerContrast])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // Same clock so sharedBody motion stays locked between layers.
    if (outerRef.current) outerRef.current.uniforms.uTime.value = t
    if (innerRef.current) innerRef.current.uniforms.uTime.value = t
  })

  // Keep core almost flush with the shell — slight late reveal only.
  const liveInnerScale = innerScale * (1.0 + Math.min(0.04, Math.max(0, age - 0.6) * 0.12))

  return (
    <group>
      {showInner && (
        <mesh scale={liveInnerScale} renderOrder={0}>
          <sphereGeometry args={[1, 128, 128]} />
          <shaderMaterial
            key="inner-core"
            ref={innerRef}
            vertexShader={innerLayeredVertexShader}
            fragmentShader={innerCoreFragmentShader}
            uniforms={innerUniforms}
            transparent
            depthWrite={false}
            side={THREE.FrontSide}
            toneMapped={false}
          />
        </mesh>
      )}

      {showOuter && (
        <mesh scale={1} renderOrder={1}>
          <sphereGeometry args={[1, 128, 128]} />
          <shaderMaterial
            key="outer-shell"
            ref={outerRef}
            vertexShader={outerLayeredVertexShader}
            fragmentShader={outerShellFragmentShader}
            uniforms={outerUniforms}
            transparent
            depthWrite={false}
            side={THREE.FrontSide}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  )
}
