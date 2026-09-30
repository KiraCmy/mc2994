import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { edgeAlpha } from './surfaceParams.js'
import {
  decayFragmentShader,
  decayVertexShader,
  developmentFragmentShader,
  developmentVertexShader,
  fragmentShader,
  individualityFragmentShader,
  traceBodyFragmentShader,
  traceFragmentShader,
  traceVertexShader,
  vertexShader,
} from './surfaceShader.js'

function shadersFor(studyId) {
  if (studyId === 'trace') {
    return {
      vertex: decayVertexShader,
      fragment: traceBodyFragmentShader,
    }
  }
  if (studyId === 'decay') {
    return {
      vertex: decayVertexShader,
      fragment: decayFragmentShader,
    }
  }
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

function createBodyUniforms(surface, individuality, development, decay, age) {
  return {
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
    uAge: { value: age },
    uSpeed: { value: development.speed },
    uPulseSpeed: { value: development.pulseSpeed },
    uDisplacement: { value: development.displacement },
    uNoiseAmount: { value: development.noiseAmount },
    uDecayScale: { value: decay.decayScale },
    uDecayStart: { value: decay.decayStart },
    uEdgeSoftness: { value: decay.edgeSoftness },
    uBoundaryWidth: { value: decay.boundaryWidth },
    uDiscardThreshold: { value: decay.discardThreshold },
    uDecayDisplacement: { value: decay.decayDisplacement },
    uDecayAccent: { value: new THREE.Color(decay.decayAccent) },
  }
}

function syncBodyUniforms(material, {
  showNoise,
  surface,
  individuality,
  development,
  decay,
  age,
}) {
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

  material.uniforms.uAge.value = age
  material.uniforms.uSpeed.value = development.speed
  material.uniforms.uPulseSpeed.value = development.pulseSpeed
  material.uniforms.uDisplacement.value = development.displacement
  material.uniforms.uNoiseAmount.value = development.noiseAmount

  material.uniforms.uDecayScale.value = decay.decayScale
  material.uniforms.uDecayStart.value = decay.decayStart
  material.uniforms.uEdgeSoftness.value = decay.edgeSoftness
  material.uniforms.uBoundaryWidth.value = decay.boundaryWidth
  material.uniforms.uDiscardThreshold.value = decay.discardThreshold
  material.uniforms.uDecayDisplacement.value = decay.decayDisplacement
  material.uniforms.uDecayAccent.value.set(decay.decayAccent)
}

export default function Specimen({
  studyId,
  surface,
  individuality,
  development,
  decay,
  trace,
  preserved,
}) {
  const bodyRef = useRef(null)
  const residueRef = useRef(null)
  const showNoise = studyId !== 'surface'
  const shaders = shadersFor(studyId)
  const age =
    studyId === 'trace' ? trace.age : studyId === 'decay' ? decay.age : development.age
  const showBody = studyId !== 'trace' || age < 0.995
  const showResidue = studyId === 'trace'

  const bodyUniforms = useMemo(
    () => createBodyUniforms(surface, individuality, development, decay, age),
    [],
  )

  const residueUniforms = useMemo(
    () => ({
      uSeed: { value: individuality.seed },
      uNoiseScale: { value: individuality.noiseScale },
      uDecayScale: { value: decay.decayScale },
      uDecayStart: { value: decay.decayStart },
      uDecayDisplacement: { value: decay.decayDisplacement },
      uAge: { value: age },
      uPreservedAge: { value: preserved?.preservedAge ?? age },
      uTraceScale: { value: trace.traceScale },
      uTraceThreshold: { value: trace.traceThreshold },
      uInternalTrace: { value: trace.internalTrace },
      uRimTrace: { value: trace.rimTrace },
      uBoundaryTrace: { value: trace.boundaryTrace },
      uTraceOpacity: { value: trace.traceOpacity },
      uTraceFresnelPower: { value: trace.traceFresnelPower },
      uPersistence: { value: trace.persistence },
      uTraceColor: { value: new THREE.Color(trace.traceColor) },
      uAccentColor: { value: new THREE.Color(individuality.accentColor) },
    }),
    [],
  )

  useLayoutEffect(() => {
    const material = bodyRef.current
    if (!material) return
    syncBodyUniforms(material, {
      showNoise,
      surface,
      individuality,
      development,
      decay,
      age,
    })
  }, [showNoise, surface, individuality, development, decay, age, showBody])

  useLayoutEffect(() => {
    const material = residueRef.current
    if (!material || !showResidue) return

    const identity = preserved ?? {
      seed: individuality.seed,
      noiseScale: individuality.noiseScale,
      accentColor: individuality.accentColor,
      decayScale: decay.decayScale,
      decayStart: decay.decayStart,
      decayDisplacement: decay.decayDisplacement,
      preservedAge: age,
    }

    material.uniforms.uSeed.value = identity.seed
    material.uniforms.uNoiseScale.value = identity.noiseScale
    material.uniforms.uDecayScale.value = identity.decayScale
    material.uniforms.uDecayStart.value = identity.decayStart
    material.uniforms.uDecayDisplacement.value = identity.decayDisplacement
    material.uniforms.uAge.value = age
    material.uniforms.uPreservedAge.value = identity.preservedAge
    material.uniforms.uTraceScale.value = trace.traceScale
    material.uniforms.uTraceThreshold.value = trace.traceThreshold
    material.uniforms.uInternalTrace.value = trace.internalTrace
    material.uniforms.uRimTrace.value = trace.rimTrace
    material.uniforms.uBoundaryTrace.value = trace.boundaryTrace
    material.uniforms.uTraceOpacity.value = trace.traceOpacity
    material.uniforms.uTraceFresnelPower.value = trace.traceFresnelPower
    material.uniforms.uPersistence.value = trace.persistence
    material.uniforms.uTraceColor.value.set(trace.traceColor)
    material.uniforms.uAccentColor.value.set(identity.accentColor)
  }, [showResidue, individuality, decay, trace, age, preserved])

  useFrame(({ clock }) => {
    const material = bodyRef.current
    if (!material) return
    if (studyId === 'development' || studyId === 'decay' || studyId === 'trace') {
      material.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <group>
      {showBody && (
        <mesh renderOrder={0}>
          <sphereGeometry args={[1, 128, 128]} />
          <shaderMaterial
            key={`body-${studyId}`}
            ref={bodyRef}
            vertexShader={shaders.vertex}
            fragmentShader={shaders.fragment}
            uniforms={bodyUniforms}
            transparent
            depthWrite={false}
            side={THREE.FrontSide}
            toneMapped={false}
          />
        </mesh>
      )}

      {showResidue && (
        <mesh scale={1.004} renderOrder={1}>
          <sphereGeometry args={[1, 128, 128]} />
          <shaderMaterial
            key="residue"
            ref={residueRef}
            vertexShader={traceVertexShader}
            fragmentShader={traceFragmentShader}
            uniforms={residueUniforms}
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
