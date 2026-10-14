import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js'
import {
  particleFlowSimShader,
  particleSurfaceFragmentShader,
  particleSurfaceVertexShader,
  particleTrailFragmentShader,
  particleTrailVertexShader,
} from '../surfaceShader.js'
import {
  PARTICLE_TRAIL_SAMPLES,
  createTrailGeometry,
  useParticleTrailHistory,
} from './particleTrails.js'
import {
  PARTICLE_COUNT_MAX,
  PARTICLE_COUNT_MIN,
  PARTICLE_FIELD_COMPLEXITY_MAX,
  PARTICLE_FIELD_COMPLEXITY_MIN,
  PARTICLE_FIELD_THICKNESS_MAX,
  PARTICLE_FIELD_THICKNESS_MIN,
  PARTICLE_TRAIL_LENGTH_MAX,
  PARTICLE_TRAIL_LENGTH_MIN,
  PARTICLE_TRAIL_SPAN_MAX,
} from './particleParams.js'

function mulberry32(seed) {
  let t = seed >>> 0
  return function next() {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Non-uniform height in [0, 1]: dense near the surface, sparse outward.
 * ~70% stay very close, ~25% moderate, ~5% near the outer fringe.
 */
function sampleFieldHeight(rand) {
  const roll = rand()
  if (roll < 0.7) {
    return Math.pow(rand(), 1.35) * 0.16
  }
  if (roll < 0.95) {
    return 0.16 + Math.pow(rand(), 0.9) * 0.44
  }
  return 0.55 + Math.pow(rand(), 0.75) * 0.45
}

/** Rest samples on the unit sphere + per-particle field height. */
function sampleParticleField(count, seed) {
  const n = Math.max(0, Math.floor(count))
  const rand = mulberry32(Math.floor(seed) || 1)
  const rests = new Array(n)
  const heights = new Float32Array(n)
  const golden = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < n; i += 1) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2
    const rAtY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i + (rand() - 0.5) * 0.55
    const x = Math.cos(theta) * rAtY
    const z = Math.sin(theta) * rAtY
    const len = Math.hypot(x, y, z) || 1
    rests[i] = [x / len, y / len, z / len]
    heights[i] = sampleFieldHeight(rand)
  }
  return { rests, heights }
}

/**
 * Stable per-particle appearance (size, brightness, tint, pulse phase) from
 * its own seed stream, so the sampled field itself is unchanged.
 */
function sampleParticleVariants(count, seed) {
  const rand = mulberry32(((Math.floor(seed) || 1) ^ 0x51ed27) >>> 0)
  const variants = new Float32Array(count * 4)
  for (let i = 0; i < variants.length; i += 1) variants[i] = rand()
  return variants
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

/** Seconds a particle rides a current before it is re-seeded. */
const PARTICLE_LIFE_MIN = 7
const PARTICLE_LIFE_MAX = 16

/** Rest-space current speed (radians / s) for a Study 03 speed value. */
function flowSpeedFor(speed) {
  return 0.06 + 0.12 * Math.min(1, Math.max(0, speed))
}

/** Square state texture: xyz = rest point, w = staggered life progress. */
function fillParticleState(data, rests, seed) {
  const rand = mulberry32((Math.floor(seed) || 1) ^ 0x9e3779b9)
  const texels = data.length / 4
  for (let i = 0; i < texels; i += 1) {
    const r = rests[i % Math.max(1, rests.length)] ?? [0, 1, 0]
    data[i * 4] = r[0]
    data[i * 4 + 1] = r[1]
    data[i * 4 + 2] = r[2]
    data[i * 4 + 3] = rand()
  }
}

/**
 * Advects particle rest points along the live surface flow on the GPU.
 * Falls back to a static state texture when float render targets are missing.
 */
function particleStateSize(count) {
  return Math.max(1, Math.ceil(Math.sqrt(count)))
}

function useParticleCurrents(gl, rests, seed) {
  const size = particleStateSize(rests.length)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDelta: { value: 0 },
      uAge: { value: 0.5 },
      uSeed: { value: 884731 },
      uNoiseScale: { value: 2.8 },
      uSpeed: { value: 0.32 },
      uPulseSpeed: { value: 1.1 },
      uDisplacement: { value: 0.22 },
      uNoiseAmount: { value: 1.55 },
      uFieldComplexity: { value: 0.45 },
      uFlowSpeed: { value: flowSpeedFor(0.32) },
      uLifeMin: { value: PARTICLE_LIFE_MIN },
      uLifeMax: { value: PARTICLE_LIFE_MAX },
    }),
    [],
  )
  const ref = useRef(null)

  // Render targets hold the only copy of the state, so they are created and
  // disposed by the same effect (a disposed target comes back empty).
  useLayoutEffect(() => {
    const gpu = new GPUComputationRenderer(size, size, gl)
    const initial = gpu.createTexture()
    fillParticleState(initial.image.data, rests, seed)

    const variable = gpu.addVariable('textureParticleState', particleFlowSimShader, initial)
    gpu.setVariableDependencies(variable, [variable])
    Object.assign(variable.material.uniforms, uniforms)

    const densityVariable = gpu.addVariable('textureParticleDensity', particleFlowSimShader, gpu.createTexture())
    gpu.setVariableDependencies(densityVariable, [variable])
    densityVariable.material.defines.PARTICLE_DENSITY = 1
    Object.assign(densityVariable.material.uniforms, uniforms)

    const fullDensity = new THREE.DataTexture(new Float32Array([1, 1, 1, 1]), 1, 1, THREE.RGBAFormat, THREE.FloatType)
    fullDensity.needsUpdate = true

    const error = gl.extensions.has('EXT_color_buffer_float') ? gpu.init() : 'float targets unsupported'
    if (error) {
      gpu.dispose()
      const fallback = new THREE.DataTexture(initial.image.data, size, size, THREE.RGBAFormat, THREE.FloatType)
      fallback.needsUpdate = true
      ref.current = { uniforms, gpu: null, variable: null, densityVariable: null, staticTexture: fallback, fullDensity }
    } else {
      ref.current = { uniforms, gpu, variable, densityVariable, staticTexture: null, fullDensity }
    }
    return () => {
      ref.current?.gpu?.dispose()
      ref.current?.staticTexture?.dispose()
      ref.current?.fullDensity?.dispose()
      ref.current = null
    }
  }, [gl, rests, seed, size, uniforms])

  return ref
}

const _dummy = new THREE.Object3D()

/**
 * Near-surface volumetric particle field riding living currents.
 * Rest points are advected each frame by a flow built from the body's own
 * relief (contours, downhill, regional heading, eddies), then placed on the
 * deformed surface in the vertex shader exactly like the body mesh.
 */
export default function ParticleField({
  count = 20000,
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
  fieldThickness = 0.14,
  fieldComplexity = 0.45,
  /** Local sphere radius before instance scale. */
  particleRadius = 0.0042,
  /**
   * Minimum clearance under the densest grit (object units). Includes the
   * former 0.0095 grain radius so the finer grains keep the original height.
   */
  floatOffset = 0.0193,
  /** 0–1 share of PARTICLE_TRAIL_SPAN_MAX seconds of recorded movement. */
  trailLength = 0,
  sizeVariation = 0.65,
  brightnessVariation = 0.55,
  colorInfluence = 0.35,
  pulseStrength = 0.4,
  /** Organism colours the faint tints are drawn from. */
  tintCool = '#a8feff',
  tintWarm = '#ff8800',
  tintSoft = '#e7b6c2',
}) {
  const gl = useThree((state) => state.gl)
  const meshRef = useRef(null)
  const materialRef = useRef(null)
  const trailMeshRef = useRef(null)
  const trailMaterialRef = useRef(null)

  const trail = Math.min(
    PARTICLE_TRAIL_LENGTH_MAX,
    Math.max(PARTICLE_TRAIL_LENGTH_MIN, trailLength),
  )

  const n = Math.min(
    PARTICLE_COUNT_MAX,
    Math.max(PARTICLE_COUNT_MIN, Math.floor(count)),
  )

  const thickness = Math.min(
    PARTICLE_FIELD_THICKNESS_MAX,
    Math.max(PARTICLE_FIELD_THICKNESS_MIN, fieldThickness),
  )

  const complexity = Math.min(
    PARTICLE_FIELD_COMPLEXITY_MAX,
    Math.max(PARTICLE_FIELD_COMPLEXITY_MIN, fieldComplexity),
  )

  const { rests, heights } = useMemo(
    () => sampleParticleField(n, seed),
    [n, seed],
  )

  const variants = useMemo(() => sampleParticleVariants(n, seed), [n, seed])

  const stateSize = particleStateSize(rests.length)
  const currentsRef = useParticleCurrents(gl, rests, seed)

  const geometry = useMemo(() => new THREE.SphereGeometry(1, 4, 3), [])

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
      uFieldThickness: { value: thickness },
      uParticleState: { value: null },
      uParticleDensity: { value: null },
      uViewportHeight: { value: 1 },
      uPixelRatio: { value: 1 },
      /** On-screen radius cap (CSS px) for a base-size grain. */
      uMaxPixelRadius: { value: 1.25 },
      uColor: { value: new THREE.Color('#f4fbff') },
      uOpacity: { value: 0.78 },
      uGlowStrength: { value: 0.8 },
      uSizeVariation: { value: 0 },
      uBrightnessVariation: { value: 0 },
      uPulseStrength: { value: 0 },
      uColorInfluence: { value: 0 },
      uTintCool: { value: new THREE.Color() },
      uTintWarm: { value: new THREE.Color() },
      uTintSoft: { value: new THREE.Color() },
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

  const trailHistoryRef = useParticleTrailHistory(gl, stateSize, rests)

  const trailGeometry = useMemo(
    () => createTrailGeometry(rests.length, stateSize, heights, variants),
    [rests, stateSize, heights, variants],
  )

  // Shares the particle uniforms, so trails follow the same deformation.
  const trailMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: particleTrailVertexShader,
        fragmentShader: particleTrailFragmentShader,
        uniforms: {
          ...uniforms,
          uTrailHistory: { value: null },
          uTrailSlots: { value: PARTICLE_TRAIL_SAMPLES - 1 },
          uTrailHead: { value: 0 },
          uTrailSamples: { value: PARTICLE_TRAIL_SAMPLES },
          uTrailWidth: { value: 0.0065 },
          uTrailOpacity: { value: 0.32 },
          uParticleRadius: { value: 0.0042 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [uniforms],
  )

  useLayoutEffect(() => {
    trailMaterialRef.current = trailMaterial
    return () => trailMaterial.dispose()
  }, [trailMaterial])

  useLayoutEffect(() => () => trailGeometry.dispose(), [trailGeometry])

  useLayoutEffect(() => {
    const mat = trailMaterialRef.current
    if (mat) mat.uniforms.uParticleRadius.value = Math.max(0.0015, particleRadius)
  }, [particleRadius, trailMaterial])

  // Instance scale + per-particle height and state-texture lookup.
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const scale = Math.max(0.0015, particleRadius)
    for (let i = 0; i < rests.length; i += 1) {
      _dummy.position.set(0, 0, 0)
      _dummy.scale.setScalar(scale)
      _dummy.rotation.set(0, 0, 0)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.count = rests.length

    const stateUvs = new Float32Array(rests.length * 2)
    for (let i = 0; i < rests.length; i += 1) {
      stateUvs[i * 2] = ((i % stateSize) + 0.5) / stateSize
      stateUvs[i * 2 + 1] = (Math.floor(i / stateSize) + 0.5) / stateSize
    }

    const geo = mesh.geometry
    for (const name of ['aHeight', 'aStateUv', 'aVariant']) {
      if (geo.getAttribute(name)) geo.deleteAttribute(name)
    }
    geo.setAttribute('aHeight', new THREE.InstancedBufferAttribute(heights.slice(), 1))
    geo.setAttribute('aStateUv', new THREE.InstancedBufferAttribute(stateUvs, 2))
    geo.setAttribute('aVariant', new THREE.InstancedBufferAttribute(variants.slice(), 4))
  }, [rests, heights, variants, particleRadius, stateSize])

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
    mat.uniforms.uFieldThickness.value = thickness
    mat.uniforms.uSizeVariation.value = clamp01(sizeVariation)
    mat.uniforms.uBrightnessVariation.value = clamp01(brightnessVariation)
    mat.uniforms.uColorInfluence.value = clamp01(colorInfluence)
    mat.uniforms.uPulseStrength.value = clamp01(pulseStrength)
    mat.uniforms.uTintCool.value.set(tintCool)
    mat.uniforms.uTintWarm.value.set(tintWarm)
    mat.uniforms.uTintSoft.value.set(tintSoft)
  }, [
    sizeVariation,
    brightnessVariation,
    colorInfluence,
    pulseStrength,
    tintCool,
    tintWarm,
    tintSoft,
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
    thickness,
  ])

  const drawSize = useMemo(() => new THREE.Vector2(), [])

  function updateTrails(live, delta) {
    const trailMesh = trailMeshRef.current
    const trailMat = trailMaterialRef.current
    const history = trailHistoryRef.current
    if (!trailMesh || !trailMat) return
    const span = trail * PARTICLE_TRAIL_SPAN_MAX
    if (!history || span <= 0) {
      trailMesh.visible = false
      if (history) history.primed = false
      return
    }
    history.sinceSnapshot += Math.min(delta, 0.05)
    if (!history.primed || history.sinceSnapshot >= span / history.slots) {
      history.record(live)
      history.sinceSnapshot = 0
    }
    trailMat.uniforms.uTrailHistory.value = history.target.texture
    trailMat.uniforms.uTrailHead.value = history.head
    trailMesh.visible = true
  }

  useFrame(({ clock }, delta) => {
    const mat = materialRef.current
    if (!mat) return
    const time = clock.getElapsedTime()
    mat.uniforms.uTime.value = time
    mat.uniforms.uAge.value = age
    gl.getDrawingBufferSize(drawSize)
    mat.uniforms.uViewportHeight.value = drawSize.y
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()

    const state = currentsRef.current
    if (!state) return
    if (state.gpu) {
      const sim = state.uniforms
      sim.uTime.value = time
      sim.uDelta.value = Math.min(delta, 0.05)
      sim.uAge.value = age
      sim.uSeed.value = surfaceSeed
      sim.uNoiseScale.value = noiseScale
      sim.uSpeed.value = speed
      sim.uPulseSpeed.value = pulseSpeed
      sim.uDisplacement.value = displacement
      sim.uNoiseAmount.value = noiseAmount
      sim.uFieldComplexity.value = complexity
      sim.uFlowSpeed.value = flowSpeedFor(speed)
      state.gpu.compute()
      const live = state.gpu.getCurrentRenderTarget(state.variable).texture
      mat.uniforms.uParticleState.value = live
      mat.uniforms.uParticleDensity.value = state.gpu.getCurrentRenderTarget(state.densityVariable).texture
      updateTrails(live, delta)
    } else {
      mat.uniforms.uParticleState.value = state.staticTexture
      mat.uniforms.uParticleDensity.value = state.fullDensity
      if (trailMeshRef.current) trailMeshRef.current.visible = false
    }
  })

  return (
    <>
      <mesh
        ref={trailMeshRef}
        geometry={trailGeometry}
        material={trailMaterial}
        frustumCulled={false}
        renderOrder={2}
      />
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, Math.max(1, rests.length)]}
        frustumCulled={false}
        renderOrder={3}
      />
    </>
  )
}
