import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  DECAY_BIAS,
  edgeAlpha,
  isLifecycleStudy,
  isMaterialLifecycleStudy,
  layeredLifecycleVisualStudy,
  lifecycleVisualStudy,
  materialLifecycleVisualStudy,
} from './surfaceParams.js'
import {
  decayFragmentShader,
  decayVertexShader,
  developmentFragmentShader,
  developmentVertexShader,
  fragmentShader,
  individualityFragmentShader,
  layeredFragmentShader,
  layeredVertexShader,
  materialFragmentShader,
  traceBodyFragmentShader,
  traceFragmentShader,
  traceVertexShader,
  vertexShader,
} from './surfaceShader.js'

function familyMode(family) {
  if (family === 'crystal') return 1
  if (family === 'hybrid') return 2
  return 0
}

function decayBiasFor(materialParams) {
  const family = materialParams.family ?? 'membrane'
  const preset = DECAY_BIAS[family] ?? DECAY_BIAS.membrane
  return {
    thinning: materialParams.thinning ?? preset.thinning,
    edgeSoftnessBias: materialParams.edgeSoftnessBias ?? preset.edgeSoftnessBias,
    fractureSharpness: materialParams.fractureSharpness ?? preset.fractureSharpness,
    lateWarp: materialParams.lateWarp ?? preset.lateWarp,
  }
}

function shadersFor(visualStudy, age = 0) {
  if (visualStudy === 'material') {
    return {
      vertex: age >= 0.5 ? decayVertexShader : developmentVertexShader,
      fragment: materialFragmentShader,
    }
  }
  if (visualStudy === 'trace') {
    return {
      vertex: decayVertexShader,
      fragment: traceBodyFragmentShader,
    }
  }
  if (visualStudy === 'decay') {
    return {
      vertex: decayVertexShader,
      fragment: decayFragmentShader,
    }
  }
  if (visualStudy === 'development') {
    return {
      vertex: developmentVertexShader,
      fragment: developmentFragmentShader,
    }
  }
  if (visualStudy === 'layered') {
    return {
      vertex: layeredVertexShader,
      fragment: layeredFragmentShader,
    }
  }
  if (visualStudy === 'individuality') {
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

function createBodyUniforms(surface, individuality, development, decay, material, age) {
  const bias = decayBiasFor(material)
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
    uEdgeSoftness: { value: bias.edgeSoftnessBias },
    uBoundaryWidth: { value: decay.boundaryWidth },
    uDiscardThreshold: { value: decay.discardThreshold },
    uDecayDisplacement: { value: decay.decayDisplacement },
    uDecayAccent: { value: new THREE.Color(decay.decayAccent) },
    uMaterialMode: { value: familyMode(material.family) },
    uIridescence: { value: material.iridescence },
    uInternalContrast: { value: material.internalContrast },
    uTransmission: { value: material.transmission },
    uTransmitTint: { value: new THREE.Color('#b7cdd6') },
    uIridSecondary: { value: new THREE.Color('#c9b4d4') },
    uThinningRate: { value: bias.thinning },
    uFractureSharpness: { value: bias.fractureSharpness },
    uLateWarp: { value: bias.lateWarp },
    uGlow: { value: 0.88 },
    uFoil: { value: 0.62 },
    uGrain: { value: 0.42 },
    uGlowCyan: { value: new THREE.Color('#7ec8e8') },
    uGlowPink: { value: new THREE.Color('#f0a8c8') },
    uGlowYellow: { value: new THREE.Color('#f0e0a0') },
    uFoilColor: { value: new THREE.Color('#2a2c32') },
  }
}

function syncBodyUniforms(material, {
  showNoise,
  surface,
  individuality,
  development,
  decay,
  materialParams,
  layered,
  age,
  isMaterialStudy,
  materialLifecycle,
  isLayeredStudy,
}) {
  const bias = decayBiasFor(materialParams)

  material.uniforms.uColorA.value.set(surface.colorA)
  material.uniforms.uColorB.value.set(surface.colorB)
  material.uniforms.uRimColor.value.set(surface.rimColor)

  if (isLayeredStudy) {
    material.uniforms.uFresnelPower.value = 2.8
    material.uniforms.uRimStrength.value = 0.48
    material.uniforms.uBodyAlpha.value = 0.82
    material.uniforms.uEdgeAlpha.value = edgeAlpha(0.82)
    material.uniforms.uIridescence.value = layered.iridescence
    if (material.uniforms.uGlow) material.uniforms.uGlow.value = layered.glow
    if (material.uniforms.uFoil) material.uniforms.uFoil.value = layered.foil
    if (material.uniforms.uGrain) material.uniforms.uGrain.value = layered.grain
    if (material.uniforms.uLateWarp) material.uniforms.uLateWarp.value = 1
    material.uniforms.uEdgeSoftness.value = decay.edgeSoftness
  } else if (isMaterialStudy) {
    material.uniforms.uFresnelPower.value = materialParams.fresnelPower
    material.uniforms.uRimStrength.value = materialParams.rimStrength
    material.uniforms.uBodyAlpha.value = materialParams.bodyAlpha
    material.uniforms.uEdgeAlpha.value = edgeAlpha(materialParams.bodyAlpha)
    material.uniforms.uMaterialMode.value = familyMode(materialParams.family)
    material.uniforms.uIridescence.value = materialParams.iridescence
    material.uniforms.uInternalContrast.value = materialParams.internalContrast
    material.uniforms.uTransmission.value = materialParams.transmission
    material.uniforms.uThinningRate.value = bias.thinning
    material.uniforms.uFractureSharpness.value = bias.fractureSharpness
    material.uniforms.uLateWarp.value = bias.lateWarp
    material.uniforms.uEdgeSoftness.value = bias.edgeSoftnessBias
  } else if (materialLifecycle) {
    material.uniforms.uFresnelPower.value = materialParams.fresnelPower
    material.uniforms.uRimStrength.value = materialParams.rimStrength
    material.uniforms.uBodyAlpha.value = materialParams.bodyAlpha
    material.uniforms.uEdgeAlpha.value = edgeAlpha(materialParams.bodyAlpha)
    if (material.uniforms.uLateWarp) material.uniforms.uLateWarp.value = bias.lateWarp
  } else {
    material.uniforms.uFresnelPower.value = surface.fresnelPower
    material.uniforms.uRimStrength.value = surface.rimStrength
    material.uniforms.uBodyAlpha.value = surface.opacity
    material.uniforms.uEdgeAlpha.value = edgeAlpha(surface.opacity)
    if (material.uniforms.uLateWarp) material.uniforms.uLateWarp.value = 1
    if (material.uniforms.uThinningRate) material.uniforms.uThinningRate.value = 0.45
    if (material.uniforms.uFractureSharpness) material.uniforms.uFractureSharpness.value = 0.2
    material.uniforms.uEdgeSoftness.value = decay.edgeSoftness
  }

  material.uniforms.uSeed.value = individuality.seed
  material.uniforms.uNoiseScale.value = individuality.noiseScale
  material.uniforms.uPatternContrast.value = individuality.patternContrast
  material.uniforms.uAccentColor.value.set(individuality.accentColor)
  material.uniforms.uAccentStrength.value = showNoise ? individuality.accentStrength : 0

  material.uniforms.uAge.value = age
  material.uniforms.uSpeed.value = development.speed
  material.uniforms.uPulseSpeed.value = development.pulseSpeed
  material.uniforms.uDisplacement.value = isMaterialStudy
    ? development.displacement * 0.55
    : isLayeredStudy
      ? development.displacement * 1.05
      : development.displacement
  material.uniforms.uNoiseAmount.value = isLayeredStudy
    ? Math.max(development.noiseAmount, 1.45)
    : development.noiseAmount

  material.uniforms.uDecayScale.value = decay.decayScale
  material.uniforms.uDecayStart.value = decay.decayStart
  if (!isMaterialStudy && !isLayeredStudy) {
    material.uniforms.uEdgeSoftness.value = decay.edgeSoftness
  }
  material.uniforms.uBoundaryWidth.value = decay.boundaryWidth
  material.uniforms.uDiscardThreshold.value = decay.discardThreshold
  material.uniforms.uDecayDisplacement.value = isLayeredStudy
    ? Math.max(decay.decayDisplacement, 0.07)
    : decay.decayDisplacement
  material.uniforms.uDecayAccent.value.set(decay.decayAccent)
}

export default function Specimen({
  studyId,
  surface,
  individuality,
  development,
  decay,
  trace,
  material: materialParams,
  layered,
  preserved,
  isDead = false,
}) {
  const bodyRef = useRef(null)
  const residueRef = useRef(null)

  const age =
    isLifecycleStudy(studyId)
      ? development.age
      : studyId === 'trace'
        ? trace.age
        : studyId === 'decay'
          ? decay.age
          : development.age

  const visualStudy =
    studyId === 'lifecycle'
      ? lifecycleVisualStudy(age, isDead)
      : isMaterialLifecycleStudy(studyId)
        ? materialLifecycleVisualStudy(age, isDead)
        : studyId === 'layered'
          ? layeredLifecycleVisualStudy(age, isDead)
          : studyId

  const isMaterialStudy = visualStudy === 'material'
  const isLayeredStudy = visualStudy === 'layered'
  const materialLifecycle = isMaterialLifecycleStudy(studyId)
  const showNoise = visualStudy !== 'surface'
  const shaders = shadersFor(visualStudy, age)
  const showBody =
    isLifecycleStudy(studyId)
      ? !isDead && age < 0.995
      : studyId !== 'trace' || age < 0.995
  const showResidue =
    isLifecycleStudy(studyId) ? isDead || age >= 0.92 : studyId === 'trace'

  const bodyUniforms = useMemo(
    () => createBodyUniforms(surface, individuality, development, decay, materialParams, age),
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
      materialParams,
      layered,
      age,
      isMaterialStudy,
      materialLifecycle,
      isLayeredStudy,
    })
  }, [
    showNoise,
    surface,
    individuality,
    development,
    decay,
    materialParams,
    layered,
    age,
    showBody,
    visualStudy,
    isMaterialStudy,
    materialLifecycle,
    isLayeredStudy,
  ])

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
    const mat = bodyRef.current
    if (!mat) return
    if (
      visualStudy === 'development' ||
      visualStudy === 'decay' ||
      visualStudy === 'trace' ||
      visualStudy === 'material' ||
      visualStudy === 'layered' ||
      isLifecycleStudy(studyId)
    ) {
      mat.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <group>
      {showBody && (
        <mesh renderOrder={0}>
          <sphereGeometry args={[1, 128, 128]} />
          <shaderMaterial
            key={`body-${visualStudy}-${isMaterialStudy && age >= 0.5 ? 'late' : 'live'}`}
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
