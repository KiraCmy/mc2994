import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { edgeAlpha } from './surfaceParams.js'
import {
  developmentFragmentShader,
  developmentVertexShader,
  fragmentShader,
  individualityFragmentShader,
  vertexShader,
} from './surfaceShader.js'

function shadersFor(studyId) {
  if (studyId === 'development') {
    return {
      vertex: developmentVertexShader,
      fragment: developmentFragmentShader,
    }
  }
  if (studyId === 'individuality') {
    return {
      vertex: vertexShader,
      fragment: individualityFragmentShader,
    }
  }
  return {
    vertex: vertexShader,
    fragment: fragmentShader,
  }
}

export default function Specimen({ studyId, surface, individuality, development }) {
  const materialRef = useRef(null)
  const showNoise = studyId !== 'surface'
  const shaders = shadersFor(studyId)

  const uniforms = useMemo(
    () => ({
      uColorA: { value: new THREE.Color(surface.colorA) },
      uColorB: { value: new THREE.Color(surface.colorB) },
      uRimColor: { value: new THREE.Color(surface.rimColor) },
      uLow: { value: -0.65 },
      uHigh: { value: 0.75 },
      uFresnelPower: { value: surface.fresnelPower },
      uRimStrength: { value: surface.rimStrength },
      uBodyAlpha: { value: surface.opacity },
      uEdgeAlpha: { value: edgeAlpha(surface.opacity) },
      uSeed: { value: individuality.seed },
      uNoiseScale: { value: individuality.noiseScale },
      uPatternContrast: { value: individuality.patternContrast },
      uAccentColor: { value: new THREE.Color(individuality.accentColor) },
      uAccentStrength: { value: individuality.accentStrength },
      uTime: { value: 0 },
      uAge: { value: development.age },
      uSpeed: { value: development.speed },
      uPulseSpeed: { value: development.pulseSpeed },
      uDisplacement: { value: development.displacement },
      uNoiseAmount: { value: development.noiseAmount },
    }),
    [],
  )

  useLayoutEffect(() => {
    const material = materialRef.current
    if (!material) return

    material.uniforms.uColorA.value.set(surface.colorA)
    material.uniforms.uColorB.value.set(surface.colorB)
    material.uniforms.uRimColor.value.set(surface.rimColor)
    material.uniforms.uFresnelPower.value = surface.fresnelPower
    material.uniforms.uRimStrength.value = surface.rimStrength
    material.uniforms.uBodyAlpha.value = surface.opacity
    material.uniforms.uEdgeAlpha.value = edgeAlpha(surface.opacity)

    material.uniforms.uSeed.value = individuality.seed
    material.uniforms.uNoiseScale.value = individuality.noiseScale
    material.uniforms.uPatternContrast.value = individuality.patternContrast
    material.uniforms.uAccentColor.value.set(individuality.accentColor)
    material.uniforms.uAccentStrength.value = showNoise ? individuality.accentStrength : 0

    material.uniforms.uAge.value = development.age
    material.uniforms.uSpeed.value = development.speed
    material.uniforms.uPulseSpeed.value = development.pulseSpeed
    material.uniforms.uDisplacement.value = development.displacement
    material.uniforms.uNoiseAmount.value = development.noiseAmount
  }, [showNoise, surface, individuality, development])

  useFrame(({ clock }) => {
    const material = materialRef.current
    if (!material) return
    if (studyId === 'development') {
      material.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <mesh>
      <sphereGeometry args={[1, 96, 96]} />
      <shaderMaterial
        key={studyId}
        ref={materialRef}
        vertexShader={shaders.vertex}
        fragmentShader={shaders.fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
