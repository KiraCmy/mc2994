import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleSphereSurface } from '../../scatter/sampleSurface.js'
import { resolveParticleDrawCount } from '../../renderBudget.js'
import { INITIAL_PARTICLE } from '../../particle/particleParams.js'
import { createExp05SurfaceEvaluator } from './exp05SurfaceEvaluator.js'

/**
 * Explore-tint grit seated on the C1 World surface.
 * Stays mounted across AGE / composition toggles — only positions update.
 */
export default function ExploreWorldParticles({
  life,
  count = INITIAL_PARTICLE.count,
  seed = INITIAL_PARTICLE.seed,
  surfaceSeed = 884731,
  morphStrength = 1,
  deformationStrength = 1,
  lobeAmplitude = 1,
  fieldThickness = INITIAL_PARTICLE.fieldThickness,
  pulseStrength = INITIAL_PARTICLE.pulseStrength,
  tintCool = '#a8feff',
  tintWarm = '#ff8800',
  tintSoft = '#e7b6c2',
  opacity = 0.78,
}) {
  const pointsRef = useRef(null)
  const lifeRef = useRef(life)
  const morphRef = useRef(morphStrength)
  const deformRef = useRef(deformationStrength)
  const lobeRef = useRef(lobeAmplitude)
  const pulseRef = useRef(pulseStrength)
  const thicknessRef = useRef(fieldThickness)
  const evaluatorRef = useRef(null)
  const seatedAgeRef = useRef(null)
  lifeRef.current = life
  morphRef.current = morphStrength
  deformRef.current = deformationStrength
  lobeRef.current = lobeAmplitude
  pulseRef.current = pulseStrength
  thicknessRef.current = fieldThickness

  const drawCount = useMemo(
    () =>
      resolveParticleDrawCount(count, {
        explore: true,
      }),
    [count],
  )

  if (!evaluatorRef.current || evaluatorRef.current.seed !== surfaceSeed) {
    evaluatorRef.current?.dispose?.()
    evaluatorRef.current = createExp05SurfaceEvaluator({ seed: surfaceSeed })
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
    const sizes = new Float32Array(n)
    const heights = new Float32Array(n)
    const tints = new Float32Array(n * 3)
    const cool = new THREE.Color(tintCool)
    const warm = new THREE.Color(tintWarm)
    const soft = new THREE.Color(tintSoft)
    const mix = new THREE.Color()

    for (let i = 0; i < n; i += 1) {
      const u = (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296
      const v = (Math.imul(i + 7, 1597334677) >>> 0) / 4294967296
      const w = (Math.imul(i + 13, 2246822519) >>> 0) / 4294967296
      if (u < 0.42) mix.copy(cool)
      else if (u < 0.62) mix.copy(warm)
      else if (u < 0.88) mix.copy(soft)
      else mix.setRGB(0.96, 0.98, 1)
      mix.lerp(cool, v * 0.2)
      tints[i * 3] = mix.r
      tints[i * 3 + 1] = mix.g
      tints[i * 3 + 2] = mix.b
      sizes[i] = 0.85 + w * w * 0.55
      heights[i] = w * w
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1))
    geo.setAttribute('aTint', new THREE.BufferAttribute(tints, 3))
    geo.setDrawRange(0, n)

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uOpacity: { value: opacity },
        uPulse: { value: 0 },
        uParticleRadius: { value: 0.0042 },
        uMaxPixelRadius: { value: 1.25 },
        uViewportHeight: { value: 1 },
        uPixelRatio: { value: 1 },
        uGlowStrength: { value: 0.8 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aHeight;
        attribute vec3 aTint;
        uniform float uPulse;
        uniform float uParticleRadius;
        uniform float uMaxPixelRadius;
        uniform float uViewportHeight;
        uniform float uPixelRatio;
        varying float vAlpha;
        varying float vBright;
        varying vec3 vTint;

        void main() {
          vec4 mvCenter = modelViewMatrix * vec4(position, 1.0);
          float sizeMul = max(aSize, 0.5);
          float grainRadius = max(uParticleRadius, 1e-4);
          float pixelWorld =
            2.0 * max(-mvCenter.z, 1e-3) /
            (projectionMatrix[1][1] * max(uViewportHeight, 1.0));
          float radius = grainRadius * sizeMul;
          float minRadius = 0.55 * uPixelRatio * pixelWorld;
          float maxRadius =
            max(uMaxPixelRadius * uPixelRatio * sizeMul * pixelWorld, minRadius);
          float drawRadius = clamp(radius, minRadius, maxRadius);
          float coverage = min(1.0, (radius * radius) / (drawRadius * drawRadius));
          float pulse = 1.0 + uPulse * 0.08;

          gl_Position = projectionMatrix * mvCenter;
          gl_PointSize = max(1.0, (drawRadius / max(pixelWorld, 1e-6)) * 2.0 * pulse);

          float height = clamp(aHeight, 0.0, 1.0);
          float depthFade = mix(1.0, 0.28, smoothstep(0.12, 1.0, height));
          vAlpha = 0.72 * depthFade * coverage;
          vBright = 0.85 + height * 0.35;
          vTint = aTint;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        uniform float uGlowStrength;
        varying float vAlpha;
        varying float vBright;
        varying vec3 vTint;

        void main() {
          vec2 pc = gl_PointCoord * 2.0 - 1.0;
          float r = length(pc);
          if (r > 1.0) discard;
          float core = smoothstep(1.0, 0.12, r);
          float halo = pow(clamp(1.0 - r, 0.0, 1.0), 0.55);
          float glow = mix(halo * 0.55, 1.0, core);
          float alpha = uOpacity * vAlpha * glow * min(vBright, 1.0);
          if (alpha < 0.012) discard;
          vec3 color = vTint * (0.55 + uGlowStrength * (0.7 + core * 1.35));
          color *= max(vBright, 1.0);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    })

    return { geometry: geo, material: mat, buffers: { positions } }
  }, [samples, tintCool, tintWarm, tintSoft, opacity])

  const seatParticles = () => {
    const lifeState = lifeRef.current
    const evaluator = evaluatorRef.current
    if (!lifeState || !evaluator || !buffers?.positions) return
    const positions = buffers.positions
    const evalOpts = {
      finiteDifferenceNormal: false,
      morphStrength: morphRef.current,
      deformationStrength: deformRef.current,
      lobeAmplitude: lobeRef.current,
    }
    const thickness = Math.max(0, Number(thicknessRef.current) || 0)
    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i]
      const seated = evaluator.evaluate(sample.normal, lifeState, evalOpts)
      const o = i * 3
      if (!seated) {
        /* Park far away instead of origin (origin sits inside the body depth). */
        positions[o] = 0
        positions[o + 1] = -999
        positions[o + 2] = 0
        continue
      }
      const lift =
        0.008 +
        ((Math.imul(i + 29, 2246822519) >>> 0) / 4294967296) * thickness
      positions[o] = seated.position[0] + seated.normal[0] * lift
      positions[o + 1] = seated.position[1] + seated.normal[1] * lift
      positions[o + 2] = seated.position[2] + seated.normal[2] * lift
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
      Math.sin(clock.elapsedTime * (0.7 + pulse * 1.4)) * pulse
    material.uniforms.uViewportHeight.value = Math.max(size.height, 1)
    material.uniforms.uPixelRatio.value = gl.getPixelRatio()
    const lifeState = lifeRef.current
    if (lifeState && lifeState.age !== seatedAgeRef.current) {
      seatRef.current()
    }
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
      renderOrder={6}
    />
  )
}
