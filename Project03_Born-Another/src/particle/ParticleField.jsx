import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js'
import { ageClock } from '../ageClock.js'
import {
  isHeavyWebGLHost,
  isWindowsHost,
  resolveParticleDrawCount,
} from '../renderBudget.js'
import {
  baDiagIncludes,
  particleDiag,
  readBaDiagMode,
  updateDiagBadge,
} from '../particleDiag.js'
import {
  particleFlowSimShader,
  particleSurfaceFragmentShader,
  particleSurfaceVertexShader,
  particleSurfaceVertexShaderLite,
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

function useParticleCurrents(
  gl,
  rests,
  seed,
  { allowGpu = true, enabled = true } = {},
) {
  const size = particleStateSize(Math.max(1, rests.length))
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
  // Windows: skip GPUComputationRenderer entirely — float ping-pong init is
  // what freezes Chrome on click even at reduced counts.
  useLayoutEffect(() => {
    if (!enabled) {
      ref.current = null
      particleDiag('currents:layout:skipped', { enabled: false })
      return undefined
    }
    particleDiag('currents:layout:enter', {
      allowGpu,
      restCount: rests.length,
      stateSize: size,
    })

    particleDiag('currents:before:fullDensityTexture')
    const fullDensity = new THREE.DataTexture(
      new Float32Array([1, 1, 1, 1]),
      1,
      1,
      THREE.RGBAFormat,
      THREE.FloatType,
    )
    fullDensity.magFilter = THREE.NearestFilter
    fullDensity.minFilter = THREE.NearestFilter
    fullDensity.generateMipmaps = false
    fullDensity.needsUpdate = true
    particleDiag('currents:after:fullDensityTexture')

    particleDiag('currents:before:staticStateFill', {
      floats: size * size * 4,
    })
    const staticData = new Float32Array(size * size * 4)
    fillParticleState(staticData, rests, seed)
    particleDiag('currents:after:staticStateFill')

    particleDiag('currents:before:staticDataTexture')
    const staticTexture = new THREE.DataTexture(
      staticData,
      size,
      size,
      THREE.RGBAFormat,
      THREE.FloatType,
    )
    // ANGLE/NVIDIA often cannot linearly filter float textures; broken
    // samples collapse rest origins and detach grains from the body.
    staticTexture.magFilter = THREE.NearestFilter
    staticTexture.minFilter = THREE.NearestFilter
    staticTexture.generateMipmaps = false
    staticTexture.needsUpdate = true
    particleDiag('currents:after:staticDataTexture')

    if (!allowGpu) {
      ref.current = {
        uniforms,
        gpu: null,
        variable: null,
        densityVariable: null,
        staticTexture,
        fullDensity,
      }
      particleDiag('currents:layout:exit', { mode: 'static-only' })
      return () => {
        staticTexture.dispose()
        fullDensity.dispose()
        ref.current = null
      }
    }

    particleDiag('currents:before:GPUComputationRenderer', { size })
    const gpu = new GPUComputationRenderer(size, size, gl)
    particleDiag('currents:after:GPUComputationRenderer')

    particleDiag('currents:before:gpuCreateTexture+fill')
    const initial = gpu.createTexture()
    fillParticleState(initial.image.data, rests, seed)
    particleDiag('currents:after:gpuCreateTexture+fill')

    particleDiag('currents:before:addVariable:state')
    const variable = gpu.addVariable('textureParticleState', particleFlowSimShader, initial)
    gpu.setVariableDependencies(variable, [variable])
    Object.assign(variable.material.uniforms, uniforms)
    particleDiag('currents:after:addVariable:state')

    particleDiag('currents:before:addVariable:density')
    const densityVariable = gpu.addVariable(
      'textureParticleDensity',
      particleFlowSimShader,
      gpu.createTexture(),
    )
    gpu.setVariableDependencies(densityVariable, [variable])
    densityVariable.material.defines.PARTICLE_DENSITY = 1
    Object.assign(densityVariable.material.uniforms, uniforms)
    particleDiag('currents:after:addVariable:density')

    const hasFloat = gl.extensions.has('EXT_color_buffer_float')
    particleDiag('currents:before:gpu.init', {
      EXT_color_buffer_float: hasFloat,
    })
    const error = hasFloat ? gpu.init() : 'float targets unsupported'
    particleDiag('currents:after:gpu.init', { error: error || null })
    if (error) {
      gpu.dispose()
      ref.current = {
        uniforms,
        gpu: null,
        variable: null,
        densityVariable: null,
        staticTexture,
        fullDensity,
      }
      particleDiag('currents:layout:exit', { mode: 'static-fallback', error })
    } else {
      staticTexture.dispose()
      ref.current = {
        uniforms,
        gpu,
        variable,
        densityVariable,
        staticTexture: null,
        fullDensity,
      }
      particleDiag('currents:layout:exit', { mode: 'gpu' })
    }
    return () => {
      ref.current?.gpu?.dispose()
      ref.current?.staticTexture?.dispose()
      ref.current?.fullDensity?.dispose()
      ref.current = null
    }
  }, [allowGpu, enabled, gl, rests, seed, size, uniforms])

  return ref
}

/** Safe stub: proves Particle/Explore can mount without field work. */
function ParticleDiagMount({ explore = false }) {
  useLayoutEffect(() => {
    updateDiagBadge('mount')
    particleDiag('diag:mount:ok', { explore: !!explore })
  }, [explore])
  return null
}

/** CPU sampling only — no buffers, shaders, or GPGPU. */
function ParticleDiagCpu({
  count = 75000,
  explore = false,
  seed = 44017,
}) {
  useLayoutEffect(() => {
    updateDiagBadge('cpu')
    const requested = Math.min(
      PARTICLE_COUNT_MAX,
      Math.max(PARTICLE_COUNT_MIN, Math.floor(count)),
    )
    const n = resolveParticleDrawCount(requested, { explore })
    particleDiag('diag:cpu:before-sample', { requested, n, explore: !!explore })
    const field = sampleParticleField(n, seed)
    const variants = sampleParticleVariants(n, seed)
    particleDiag('diag:cpu:after-sample', {
      rests: field.rests.length,
      heights: field.heights.length,
      variants: variants.length,
    })
  }, [count, explore, seed])
  return null
}

/**
 * Near-surface volumetric particle field riding living currents.
 * Rest points are advected each frame by a flow built from the body's own
 * relief (contours, downhill, regional heading, eddies), then placed on the
 * deformed surface in the vertex shader exactly like the body mesh.
 * Grains are soft point sprites (same count / size language as the old spheres).
 *
 * @param {string|null} diagMode URL ?baDiag=geom|simple|gpu (null = production)
 */
function ParticleFieldLive({
  count = 75000,
  /** Explore stacks Scatter + particles; heavy hosts soft-cap further. */
  explore = false,
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
  /** Base grain radius in object units (drives point size + lift). */
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
  diagMode = null,
}) {
  const gl = useThree((state) => state.gl)
  const pointsRef = useRef(null)
  const materialRef = useRef(null)
  const trailMeshRef = useRef(null)
  const trailMaterialRef = useRef(null)
  const firstFrameLogged = useRef(false)
  const pathLogged = useRef(false)
  const heavyHost = useMemo(() => isHeavyWebGLHost(), [])
  const windowsHost = useMemo(() => isWindowsHost(), [])
  // Production: GPGPU off on Windows (freeze risk). Full surface VS on all
  // hosts so grains track organism deformation without enabling simulation.
  // Diag: ?baDiag=simple keeps lite VS for bisect; ?baDiag=gpu enables GPGPU.
  const allowGpu = diagMode ? baDiagIncludes(diagMode, 'gpu') : !heavyHost
  const useSimplePoints = diagMode === 'geom'
  const useLiteShader = diagMode === 'simple'
  const enableCurrents = diagMode ? baDiagIncludes(diagMode, 'simple') : true
  const drawPoints = diagMode ? baDiagIncludes(diagMode, 'geom') : true
  const vertexShaderKind = useLiteShader ? 'lite' : 'full'

  const trail = Math.min(
    PARTICLE_TRAIL_LENGTH_MAX,
    Math.max(PARTICLE_TRAIL_LENGTH_MIN, trailLength),
  )

  const requested = Math.min(
    PARTICLE_COUNT_MAX,
    Math.max(PARTICLE_COUNT_MIN, Math.floor(count)),
  )
  // MacBook: full requested count. Windows: soft-cap only.
  const n = resolveParticleDrawCount(requested, { explore })

  // Sync path log during render (once per mount), before heavy useMemo work.
  if (!pathLogged.current) {
    particleDiag('ParticleField:render:path', {
      baDiag: diagMode || 'off',
      isWindowsHost: windowsHost,
      isHeavyWebGLHost: heavyHost,
      requestedCount: requested,
      resolvedCount: n,
      explore,
      allowGpu,
      enableCurrents,
      useSimplePoints,
      drawPoints,
      vertexShader: useSimplePoints ? 'PointsMaterial' : vertexShaderKind,
    })
    pathLogged.current = true
  }

  const thickness = Math.min(
    PARTICLE_FIELD_THICKNESS_MAX,
    Math.max(PARTICLE_FIELD_THICKNESS_MIN, fieldThickness),
  )

  const complexity = Math.min(
    PARTICLE_FIELD_COMPLEXITY_MAX,
    Math.max(PARTICLE_FIELD_COMPLEXITY_MIN, fieldComplexity),
  )

  const { rests, heights, variants } = useMemo(() => {
    particleDiag('cpu:before:sampleParticleField', { n, seed })
    const field = sampleParticleField(n, seed)
    particleDiag('cpu:after:sampleParticleField', {
      rests: field.rests.length,
    })
    particleDiag('cpu:before:sampleParticleVariants', { n })
    const nextVariants = sampleParticleVariants(n, seed)
    particleDiag('cpu:after:sampleParticleVariants', {
      floats: nextVariants.length,
    })
    return {
      rests: field.rests,
      heights: field.heights,
      variants: nextVariants,
    }
  }, [n, seed])

  const stateSize = particleStateSize(Math.max(1, rests.length))
  // Windows: static field (no GPGPU). MacBook: live currents.
  // Diag geom: skip currents entirely. Diag simple/gpu: currents on; gpu enables GPGPU.
  const currentsRef = useParticleCurrents(gl, rests, seed, {
    allowGpu,
    enabled: enableCurrents && rests.length > 0,
  })

  const geometry = useMemo(() => {
    particleDiag('geometry:before:BufferGeometry', { n })
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(n * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setDrawRange(0, n)
    particleDiag('geometry:after:BufferGeometry')
    return geo
  }, [n])

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
      uParticleRadius: { value: 0.0042 },
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

  // No GPGPU + full VS: rest points live in the position attribute.
  const useAttrRest = !allowGpu && !useSimplePoints && !useLiteShader

  const material = useMemo(() => {
    if (useSimplePoints) {
      particleDiag('material:before:PointsMaterial')
      const mat = new THREE.PointsMaterial({
        color: 0xf4fbff,
        size: 2,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      })
      particleDiag('material:after:PointsMaterial')
      return mat
    }
    particleDiag('material:before:ShaderMaterial', {
      vertexShader: vertexShaderKind,
      useAttrRest,
    })
    const mat = new THREE.ShaderMaterial({
      // Production: full surface VS (Mac + Windows). Diag simple: lite VS.
      // Windows / no-GPGPU: USE_PARTICLE_ATTR_REST so rests come from attributes.
      vertexShader: useLiteShader
        ? particleSurfaceVertexShaderLite
        : particleSurfaceVertexShader,
      fragmentShader: particleSurfaceFragmentShader,
      uniforms,
      defines: useAttrRest ? { USE_PARTICLE_ATTR_REST: 1 } : {},
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    particleDiag('material:after:ShaderMaterial', {
      vertexShader: vertexShaderKind,
      useAttrRest,
    })
    return mat
  }, [useAttrRest, useLiteShader, useSimplePoints, uniforms, vertexShaderKind])

  useLayoutEffect(() => {
    materialRef.current = material
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  const trailsEnabled = !diagMode && !heavyHost && trail > 0
  const trailHistoryRef = useParticleTrailHistory(
    gl,
    stateSize,
    rests,
    trailsEnabled,
  )

  const trailGeometry = useMemo(() => {
    if (!trailsEnabled) return null
    return createTrailGeometry(rests.length, stateSize, heights, variants)
  }, [trailsEnabled, rests, stateSize, heights, variants])

  // Shares the particle uniforms, so trails follow the same deformation.
  const trailMaterial = useMemo(() => {
    if (!trailsEnabled) return null
    return new THREE.ShaderMaterial({
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
    })
  }, [trailsEnabled, uniforms])

  useLayoutEffect(() => {
    trailMaterialRef.current = trailMaterial
    return () => trailMaterial?.dispose()
  }, [trailMaterial])

  useLayoutEffect(() => () => trailGeometry?.dispose(), [trailGeometry])

  useLayoutEffect(() => {
    const grain = Math.max(0.0015, particleRadius)
    const trailMat = trailMaterialRef.current
    if (trailMat?.uniforms) trailMat.uniforms.uParticleRadius.value = grain
    const mat = materialRef.current
    if (mat?.uniforms) mat.uniforms.uParticleRadius.value = grain
  }, [particleRadius, trailMaterial])

  // Per-particle height, appearance, and rest / state-texture lookup.
  useLayoutEffect(() => {
    const points = pointsRef.current
    if (!points || !drawPoints) return

    const pos = points.geometry.getAttribute('position')
    if (useSimplePoints) {
      // Geom diag: static lifted points, no surface VS.
      for (let i = 0; i < rests.length; i += 1) {
        const r = rests[i]
        const h = heights[i] ?? 0
        const lift = floatOffset + thickness * h
        pos.setXYZ(i, r[0] * (1 + lift), r[1] * (1 + lift), r[2] * (1 + lift))
      }
      pos.needsUpdate = true
    } else if (useAttrRest) {
      // Windows / no-GPGPU: rest on unit sphere; VS applies live deformation.
      for (let i = 0; i < rests.length; i += 1) {
        const r = rests[i]
        pos.setXYZ(i, r[0], r[1], r[2])
      }
      pos.needsUpdate = true
    }

    const stateUvs = new Float32Array(rests.length * 2)
    for (let i = 0; i < rests.length; i += 1) {
      stateUvs[i * 2] = ((i % stateSize) + 0.5) / stateSize
      stateUvs[i * 2 + 1] = (Math.floor(i / stateSize) + 0.5) / stateSize
    }

    const geo = points.geometry
    for (const name of ['aHeight', 'aStateUv', 'aVariant']) {
      if (geo.getAttribute(name)) geo.deleteAttribute(name)
    }
    if (!useSimplePoints) {
      geo.setAttribute('aHeight', new THREE.BufferAttribute(heights.slice(), 1))
      geo.setAttribute('aStateUv', new THREE.BufferAttribute(stateUvs, 2))
      geo.setAttribute('aVariant', new THREE.BufferAttribute(variants.slice(), 4))
    }
    geo.setDrawRange(0, rests.length)
  }, [
    rests,
    heights,
    variants,
    stateSize,
    drawPoints,
    useSimplePoints,
    useAttrRest,
    floatOffset,
    thickness,
  ])

  useLayoutEffect(() => {
    const mat = materialRef.current
    if (!mat?.uniforms) return
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
  const simFrame = useRef(0)

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
    const liveAge = ageClock.current
    const isFirstFrame = !firstFrameLogged.current
    if (isFirstFrame) {
      particleDiag('frame:before:first', {
        baDiag: diagMode || 'off',
        allowGpu,
        enableCurrents,
        useSimplePoints,
        vertexShader: useSimplePoints ? 'PointsMaterial' : vertexShaderKind,
        resolvedCount: n,
        hasCurrents: !!currentsRef.current,
        hasGpu: !!currentsRef.current?.gpu,
      })
    }

    if (mat.uniforms) {
      mat.uniforms.uTime.value = time
      mat.uniforms.uAge.value = liveAge
      gl.getDrawingBufferSize(drawSize)
      mat.uniforms.uViewportHeight.value = drawSize.y
      mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    }

    const state = currentsRef.current
    if (!state) {
      if (isFirstFrame) {
        particleDiag('frame:first:no-currents-yet')
        firstFrameLogged.current = true
      }
      return
    }
    if (!mat.uniforms) {
      if (isFirstFrame) {
        particleDiag('frame:after:first', { material: 'PointsMaterial' })
        firstFrameLogged.current = true
      }
      return
    }
    if (state.gpu) {
      const sim = state.uniforms
      // MacBook: simulate every frame. Windows production: every other frame.
      simFrame.current += 1
      const runSim = diagMode === 'gpu' || !heavyHost || simFrame.current % 2 === 0
      if (runSim) {
        if (isFirstFrame) particleDiag('frame:before:first:gpu.compute')
        sim.uTime.value = time
        sim.uDelta.value = Math.min(delta, 0.05) * (heavyHost && diagMode !== 'gpu' ? 2 : 1)
        sim.uAge.value = liveAge
        sim.uSeed.value = surfaceSeed
        sim.uNoiseScale.value = noiseScale
        sim.uSpeed.value = speed
        sim.uPulseSpeed.value = pulseSpeed
        sim.uDisplacement.value = displacement
        sim.uNoiseAmount.value = noiseAmount
        sim.uFieldComplexity.value = complexity
        sim.uFlowSpeed.value = flowSpeedFor(speed)
        state.gpu.compute()
        if (isFirstFrame) particleDiag('frame:after:first:gpu.compute')
      }
      const live = state.gpu.getCurrentRenderTarget(state.variable).texture
      mat.uniforms.uParticleState.value = live
      mat.uniforms.uParticleDensity.value = state.gpu.getCurrentRenderTarget(state.densityVariable).texture
      if (runSim) updateTrails(live, delta)
    } else {
      if (isFirstFrame) particleDiag('frame:before:first:bindStaticTextures')
      mat.uniforms.uParticleState.value = state.staticTexture
      mat.uniforms.uParticleDensity.value = state.fullDensity
      if (trailMeshRef.current) trailMeshRef.current.visible = false
      if (isFirstFrame) particleDiag('frame:after:first:bindStaticTextures')
    }
    if (isFirstFrame) {
      particleDiag('frame:after:first', {
        drawRange: pointsRef.current?.geometry?.drawRange ?? null,
      })
      firstFrameLogged.current = true
    }
  })

  if (!drawPoints) return null

  return (
    <>
      {trailGeometry && trailMaterial ? (
        <mesh
          ref={trailMeshRef}
          geometry={trailGeometry}
          material={trailMaterial}
          frustumCulled={false}
          renderOrder={2}
        />
      ) : null}
      <points
        ref={pointsRef}
        geometry={geometry}
        material={material}
        frustumCulled={false}
        renderOrder={3}
      />
    </>
  )
}

/**
 * Entry: optional ?baDiag=mount|cpu|geom|simple|gpu isolation modes.
 * No query param → production ParticleFieldLive path unchanged.
 */
export default function ParticleField(props) {
  const diagMode = useMemo(() => readBaDiagMode(), [])

  useLayoutEffect(() => {
    updateDiagBadge(diagMode)
    particleDiag('ParticleField:wrapper', {
      baDiag: diagMode || 'off',
      explore: !!props.explore,
    })
  }, [diagMode, props.explore])

  if (diagMode === 'mount') {
    return <ParticleDiagMount explore={props.explore} />
  }
  if (diagMode === 'cpu') {
    return <ParticleDiagCpu {...props} />
  }
  return <ParticleFieldLive {...props} diagMode={diagMode} />
}
