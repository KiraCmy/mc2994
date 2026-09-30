import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { INNER_SEED_OFFSET } from './surfaceParams.js'
import {
  innerCoreFragmentShader,
  layeredVertexShader,
  outerShellFragmentShader,
} from './surfaceShader.js'

function createOuterUniforms(surface, seed, age, outerOpacity) {
  return {
    uColorA: { value: new THREE.Color(surface.colorA) },
    uColorB: { value: new THREE.Color(surface.colorB) },
    uRimColor: { value: new THREE.Color(surface.rimColor) },
    uLow: { value: -0.65 },
    uHigh: { value: 0.75 },
    uFresnelPower: { value: 1.95 },
    uRimStrength: { value: 0.28 },
    uBodyAlpha: { value: outerOpacity },
    uSeed: { value: seed },
    uNoiseScale: { value: 1.35 },
    uPatternContrast: { value: 0.35 },
    uAccentColor: { value: new THREE.Color('#9bb6c0') },
    uAccentStrength: { value: 0.4 },
    uTime: { value: 0 },
    uAge: { value: age },
    uSpeed: { value: 0.14 },
    uPulseSpeed: { value: 0.42 },
    uDisplacement: { value: 0.085 },
    uNoiseAmount: { value: 0.95 },
  }
}

function createInnerUniforms(seed, age, innerContrast) {
  return {
    uColorA: { value: new THREE.Color('#d9c8cd') },
    uColorB: { value: new THREE.Color('#c9dbdf') },
    uRimColor: { value: new THREE.Color('#f0e4ec') },
    uLow: { value: -0.65 },
    uHigh: { value: 0.75 },
    uFresnelPower: { value: 2.4 },
    uRimStrength: { value: 0.22 },
    uBodyAlpha: { value: 0.42 },
    uSeed: { value: seed + INNER_SEED_OFFSET },
    // Low frequency + strong displacement → asymmetric organic blob
    uNoiseScale: { value: 1.05 },
    uPatternContrast: { value: 0.65 },
    uAccentColor: { value: new THREE.Color('#c9b4d4') },
    uAccentStrength: { value: 0.7 },
    uTime: { value: 0 },
    uAge: { value: age },
    uSpeed: { value: 0.26 },
    uPulseSpeed: { value: 0.5 },
    uDisplacement: { value: 0.3 },
    uNoiseAmount: { value: 1.55 },
    uInternalContrast: { value: innerContrast },
  }
}

export default function LayeredBody({
  surface,
  seed,
  age,
  mode = 'both',
  outerOpacity = 0.34,
  innerScale = 0.76,
  innerContrast = 0.78,
}) {
  const outerRef = useRef(null)
  const innerRef = useRef(null)

  const showOuter = mode === 'both' || mode === 'outer'
  const showInner = mode === 'both' || mode === 'inner'

  const outerUniforms = useMemo(
    () => createOuterUniforms(surface, seed, age, outerOpacity),
    [],
  )
  const innerUniforms = useMemo(
    () => createInnerUniforms(seed, age, innerContrast),
    [],
  )

  useLayoutEffect(() => {
    const mat = outerRef.current
    if (!mat) return
    mat.uniforms.uColorA.value.set(surface.colorA)
    mat.uniforms.uColorB.value.set(surface.colorB)
    mat.uniforms.uRimColor.value.set(surface.rimColor)
    mat.uniforms.uBodyAlpha.value = outerOpacity
    mat.uniforms.uSeed.value = seed
    mat.uniforms.uAge.value = age
  }, [showOuter, surface, seed, age, outerOpacity])

  useLayoutEffect(() => {
    const mat = innerRef.current
    if (!mat) return
    mat.uniforms.uSeed.value = seed + INNER_SEED_OFFSET
    mat.uniforms.uAge.value = age
    mat.uniforms.uInternalContrast.value = innerContrast
  }, [showInner, seed, age, innerContrast])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // Related clocks, different phase — no matching pulse.
    if (outerRef.current) outerRef.current.uniforms.uTime.value = t * 0.85
    if (innerRef.current) innerRef.current.uniforms.uTime.value = t * 1.05 + 2.3
  })

  return (
    <group>
      {showInner && (
        <mesh scale={innerScale} renderOrder={0}>
          <sphereGeometry args={[1, 128, 128]} />
          <shaderMaterial
            key="inner-core"
            ref={innerRef}
            vertexShader={layeredVertexShader}
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
            vertexShader={layeredVertexShader}
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
