import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleSphereSurface } from '../../scatter/sampleSurface.js'
import { resolveParticleDrawCount } from '../../renderBudget.js'
import { INITIAL_PARTICLE } from '../../particle/particleParams.js'
import { createExp05SurfaceEvaluator } from './exp05SurfaceEvaluator.js'
import {
  EXP05_DEFAULT_MORPHOLOGY_TYPE,
  normalizeExp05MorphologyType,
} from './exp05MorphologyTypes.js'
import {
  EXP05_ENV_TEMPERATURE_NEUTRAL,
  normalizeExp05Temperature,
} from './exp05EnvironmentCoupling.js'

/**
 * Exp05 surface grit + accent particles on the shared World surface evaluator.
 *
 * Visibility notes (Exp05-only):
 * - Body depthWrite can occlude near-surface points → accent lift clears the membrane.
 * - Sub-pixel coverage was crushing alpha → grit keeps soft coverage; accents do not.
 * - Soft white grit + accents for contrast on the pearlescent membrane.
 * - Normal blending, soft defined disks (low glow), renderOrder above body.
 */
export default function ExploreWorldParticles({
  life,
  count = INITIAL_PARTICLE.count,
  seed = INITIAL_PARTICLE.seed,
  surfaceSeed = 884731,
  morphStrength = 1,
  deformationStrength = 1,
  lobeAmplitude = 1,
  morphologyType = EXP05_DEFAULT_MORPHOLOGY_TYPE,
  temperature = EXP05_ENV_TEMPERATURE_NEUTRAL,
  sculpturalStrength = 0,
  fieldThickness = INITIAL_PARTICLE.fieldThickness,
  pulseStrength = INITIAL_PARTICLE.pulseStrength,
  /** Soft white grit / accents (readable on pearlescent without dark mud). */
  tintCool = '#f4f7fb',
  tintWarm = '#eef2f7',
  tintSoft = '#ffffff',
  opacity = 0.78,
}) {
  const pointsRef = useRef(null)
  const lifeRef = useRef(life)
  const morphRef = useRef(morphStrength)
  const deformRef = useRef(deformationStrength)
  const lobeRef = useRef(lobeAmplitude)
  const sculptRef = useRef(sculpturalStrength)
  const pulseRef = useRef(pulseStrength)
  const thicknessRef = useRef(fieldThickness)
  const evaluatorRef = useRef(null)
  const seatedAgeRef = useRef(null)
  lifeRef.current = life
  morphRef.current = morphStrength
  deformRef.current = deformationStrength
  lobeRef.current = lobeAmplitude
  sculptRef.current = sculpturalStrength
  pulseRef.current = pulseStrength
  thicknessRef.current = fieldThickness

  const morphType = normalizeExp05MorphologyType(morphologyType)
  const tempValue = normalizeExp05Temperature(temperature)

  const drawCount = useMemo(
    () =>
      resolveParticleDrawCount(count, {
        explore: true,
      }),
    [count],
  )

  if (!evaluatorRef.current || evaluatorRef.current.seed !== surfaceSeed) {
    evaluatorRef.current?.dispose?.()
    evaluatorRef.current = createExp05SurfaceEvaluator({
      seed: surfaceSeed,
      morphologyType: morphType,
      temperature: tempValue,
      sculpturalStrength,
    })
  } else {
    evaluatorRef.current.setMorphologyType(morphType)
    evaluatorRef.current.setTemperature(tempValue)
    evaluatorRef.current.setSculpturalStrength(sculpturalStrength)
  }

  useEffect(
    () => () => {
      evaluatorRef.current?.dispose?.()
      evaluatorRef.current = null
    },
    [],
  )

  const samples = useMemo(
    () =>
      sampleSphereSurface({
        count: drawCount,
        seed: (Number(seed) || 1) ^ 0x44017,
        radius: 1,
        jitter: 0.42,
      }),
    [drawCount, seed],
  )

  const { geometry, material, buffers } = useMemo(() => {
    const n = samples.length
    const positions = new Float32Array(n * 3)
    const basePositions = new Float32Array(n * 3)
    const normals = new Float32Array(n * 3)
    const tangents = new Float32Array(n * 3)
    const bitangents = new Float32Array(n * 3)
    const sizes = new Float32Array(n)
    const heights = new Float32Array(n)
    const opacities = new Float32Array(n)
    const phases = new Float32Array(n)
    const accent = new Float32Array(n)
    const tints = new Float32Array(n * 3)

    const whiteA = new THREE.Color(tintCool)
    const whiteB = new THREE.Color(tintWarm)
    const whiteC = new THREE.Color(tintSoft)
    const mix = new THREE.Color()

    for (let i = 0; i < n; i += 1) {
      const u = (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296
      const v = (Math.imul(i + 7, 1597334677) >>> 0) / 4294967296
      const w = (Math.imul(i + 13, 2246822519) >>> 0) / 4294967296
      const q = (Math.imul(i + 19, 374761393) >>> 0) / 4294967296

      /*
       * ~88% micro-grit, ~12% visible accents (same total count — no density bump).
       * Accent size ~2.4–3.6× micro so they read at default camera distance.
       */
      const isAccent = w >= 0.88
      accent[i] = isAccent ? 1 : 0

      let sizeMul
      let alphaMul
      let heightBias
      if (!isAccent) {
        sizeMul = 0.5 + q * 0.32
        alphaMul = 0.18 + q * 0.16
        heightBias = 0.04 + q * 0.12
        mix.copy(whiteA)
        mix.lerp(whiteB, v * 0.35)
      } else {
        /* 2.4×–3.6× micro median (~0.66) → clearly distinct disks */
        sizeMul = 2.4 + q * 1.2
        alphaMul = 0.72 + q * 0.22
        heightBias = 0.55 + q * 0.4
        if (u < 0.34) mix.copy(whiteA)
        else if (u < 0.67) mix.copy(whiteB)
        else mix.copy(whiteC)
        mix.lerp(whiteC, v * 0.25)
      }

      tints[i * 3] = mix.r
      tints[i * 3 + 1] = mix.g
      tints[i * 3 + 2] = mix.b
      sizes[i] = sizeMul
      opacities[i] = alphaMul
      heights[i] = heightBias
      phases[i] = v * Math.PI * 2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1))
    geo.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1))
    geo.setAttribute('aAccent', new THREE.BufferAttribute(accent, 1))
    geo.setAttribute('aTint', new THREE.BufferAttribute(tints, 3))
    geo.setDrawRange(0, n)

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      toneMapped: false,
      /* Reduce z-fight with transparent membrane when lift is small. */
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      uniforms: {
        uOpacity: { value: opacity },
        uPulse: { value: 0 },
        uParticleRadius: { value: 0.0052 },
        uMaxPixelRadius: { value: 2.6 },
        uViewportHeight: { value: 1 },
        uPixelRatio: { value: 1 },
        uGlowStrength: { value: 0.22 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aHeight;
        attribute float aOpacity;
        attribute float aAccent;
        attribute vec3 aTint;
        uniform float uPulse;
        uniform float uParticleRadius;
        uniform float uMaxPixelRadius;
        uniform float uViewportHeight;
        uniform float uPixelRatio;
        varying float vAlpha;
        varying float vBright;
        varying float vAccent;
        varying vec3 vTint;

        void main() {
          vec4 mvCenter = modelViewMatrix * vec4(position, 1.0);
          float sizeMul = max(aSize, 0.4);
          float grainRadius = max(uParticleRadius, 1e-4) * sizeMul;
          float pixelWorld =
            2.0 * max(-mvCenter.z, 1e-3) /
            (projectionMatrix[1][1] * max(uViewportHeight, 1.0));
          float minRadius = 0.4 * uPixelRatio * pixelWorld;
          float maxRadius =
            max(uMaxPixelRadius * uPixelRatio * sizeMul * pixelWorld, minRadius);
          float drawRadius = clamp(grainRadius, minRadius, maxRadius);
          /*
           * Micro-grit: soft coverage when sub-pixel.
           * Accents: keep opacity — they are meant to resolve as disks.
           */
          float coverage = min(1.0, (grainRadius * grainRadius) / (drawRadius * drawRadius));
          coverage = mix(coverage, max(coverage, 0.85), aAccent);
          float pulse = 1.0 + uPulse * mix(0.04, 0.07, aAccent);

          gl_Position = projectionMatrix * mvCenter;
          gl_PointSize = max(1.0, (drawRadius / max(pixelWorld, 1e-6)) * 2.0 * pulse);

          float height = clamp(aHeight, 0.0, 1.0);
          float depthFade = mix(1.0, mix(0.5, 0.85, aAccent), smoothstep(0.12, 1.0, height));
          vAlpha = aOpacity * depthFade * coverage;
          vBright = mix(0.75, 0.92, aAccent) + height * 0.18;
          vAccent = aAccent;
          vTint = aTint;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        uniform float uGlowStrength;
        varying float vAlpha;
        varying float vBright;
        varying float vAccent;
        varying vec3 vTint;

        void main() {
          vec2 pc = gl_PointCoord * 2.0 - 1.0;
          float r = length(pc);
          if (r > 1.0) discard;
          /* Soft but defined edge — tighter for accents, softer for grit. */
          float edge = mix(0.22, 0.38, vAccent);
          float core = smoothstep(1.0, edge, r);
          float halo = pow(clamp(1.0 - r, 0.0, 1.0), mix(1.1, 1.6, vAccent));
          float shape = mix(halo * mix(0.35, 0.2, vAccent), 1.0, core);
          float alpha = uOpacity * vAlpha * shape * min(vBright, 1.05);
          if (alpha < mix(0.014, 0.03, vAccent)) discard;
          vec3 color = vTint * (0.82 + uGlowStrength * (0.2 + core * 0.35));
          color *= mix(0.88, 1.02, vBright);
          gl_FragColor = vec4(color, alpha);
          #include <colorspace_fragment>
        }
      `,
    })

    return {
      geometry: geo,
      material: mat,
      buffers: {
        positions,
        basePositions,
        normals,
        tangents,
        bitangents,
        heights,
        phases,
        accent,
      },
    }
  }, [samples, tintCool, tintWarm, tintSoft, opacity])

  const seatParticles = () => {
    const lifeState = lifeRef.current
    const evaluator = evaluatorRef.current
    if (!lifeState || !evaluator || !buffers?.positions) return
    const {
      positions,
      basePositions,
      normals,
      tangents,
      bitangents,
      heights,
      accent,
    } = buffers
    const evalOpts = {
      finiteDifferenceNormal: false,
      morphStrength: morphRef.current,
      deformationStrength: deformRef.current,
      lobeAmplitude: lobeRef.current,
      sculpturalStrength: sculptRef.current,
    }
    const thickness = Math.max(0, Number(thicknessRef.current) || 0)
    const tmpN = new THREE.Vector3()
    const tmpT = new THREE.Vector3()
    const tmpB = new THREE.Vector3()
    const refUp = new THREE.Vector3(0, 1, 0)
    const refSide = new THREE.Vector3(1, 0, 0)

    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i]
      const seated = evaluator.evaluate(sample.normal, lifeState, evalOpts)
      const o = i * 3
      if (!seated) {
        positions[o] = 0
        positions[o + 1] = -999
        positions[o + 2] = 0
        basePositions[o] = 0
        basePositions[o + 1] = -999
        basePositions[o + 2] = 0
        continue
      }

      tmpN.set(seated.normal[0], seated.normal[1], seated.normal[2]).normalize()
      const reference = Math.abs(tmpN.y) > 0.86 ? refSide : refUp
      tmpT.crossVectors(reference, tmpN).normalize()
      tmpB.crossVectors(tmpN, tmpT).normalize()

      /*
       * Accents sit farther off the membrane so depthTest against body depthWrite
       * does not erase them; grit stays close as micro-surface dust.
       */
      const isAccent = accent[i] > 0.5
      const lift = isAccent
        ? 0.028 + heights[i] * thickness * 0.55
        : 0.005 + heights[i] * thickness * 0.35

      basePositions[o] = seated.position[0] + tmpN.x * lift
      basePositions[o + 1] = seated.position[1] + tmpN.y * lift
      basePositions[o + 2] = seated.position[2] + tmpN.z * lift
      normals[o] = tmpN.x
      normals[o + 1] = tmpN.y
      normals[o + 2] = tmpN.z
      tangents[o] = tmpT.x
      tangents[o + 1] = tmpT.y
      tangents[o + 2] = tmpT.z
      bitangents[o] = tmpB.x
      bitangents[o + 1] = tmpB.y
      bitangents[o + 2] = tmpB.z
      positions[o] = basePositions[o]
      positions[o + 1] = basePositions[o + 1]
      positions[o + 2] = basePositions[o + 2]
    }
    geometry.attributes.position.needsUpdate = true
    seatedAgeRef.current = lifeState.age
  }

  const seatRef = useRef(seatParticles)
  seatRef.current = seatParticles

  useLayoutEffect(() => {
    seatRef.current()
  }, [
    life,
    samples,
    morphStrength,
    deformationStrength,
    lobeAmplitude,
    sculpturalStrength,
    morphType,
    tempValue,
    fieldThickness,
    surfaceSeed,
  ])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(({ clock, gl, size }) => {
    const pulse = Math.max(0, pulseRef.current || 0)
    material.uniforms.uPulse.value =
      Math.sin(clock.elapsedTime * (0.45 + pulse * 0.7)) * pulse * 0.5
    material.uniforms.uViewportHeight.value = Math.max(size.height, 1)
    material.uniforms.uPixelRatio.value = gl.getPixelRatio()

    const lifeState = lifeRef.current
    if (lifeState && lifeState.age !== seatedAgeRef.current) {
      seatRef.current()
    }

    const {
      positions,
      basePositions,
      normals,
      tangents,
      bitangents,
      phases,
      heights,
      accent,
    } = buffers
    if (!positions || !basePositions || !normals) return

    const t = clock.elapsedTime
    const breathAmp = 0.0025 + pulse * 0.008
    const crawlAmp = 0.01 + pulse * 0.018

    for (let i = 0; i < samples.length; i += 1) {
      const o = i * 3
      if (basePositions[o + 1] < -900) continue
      const phase = phases[i]
      const isAccent = accent[i] > 0.5

      const breath =
        (Math.sin(t * 0.55 + phase) * 0.55 +
          Math.sin(t * 0.92 + phase * 1.6) * 0.3) *
        breathAmp *
        (0.4 + heights[i] * 0.8)

      let tx = 0
      let ty = 0
      let tz = 0
      if (isAccent) {
        /* Slow organic crawl along the deformed surface (tangent frame). */
        const s =
          Math.sin(t * 0.28 + phase) * 0.65 +
          Math.sin(t * 0.41 + phase * 1.9) * 0.35
        const c =
          Math.cos(t * 0.23 + phase * 1.3) * 0.55 +
          Math.cos(t * 0.37 + phase * 0.7) * 0.3
        const crawl = crawlAmp * (0.55 + heights[i] * 0.7)
        tx = (tangents[o] * s + bitangents[o] * c) * crawl
        ty = (tangents[o + 1] * s + bitangents[o + 1] * c) * crawl
        tz = (tangents[o + 2] * s + bitangents[o + 2] * c) * crawl
      }

      positions[o] = basePositions[o] + normals[o] * breath + tx
      positions[o + 1] = basePositions[o + 1] + normals[o + 1] * breath + ty
      positions[o + 2] = basePositions[o + 2] + normals[o + 2] * breath + tz
    }
    geometry.attributes.position.needsUpdate = true
  })

  if (samples.length === 0) return null

  return (
    <points
      ref={(node) => {
        pointsRef.current = node
        if (node) seatRef.current()
      }}
      geometry={geometry}
      material={material}
      dispose={null}
      frustumCulled={false}
      renderOrder={8}
    />
  )
}
