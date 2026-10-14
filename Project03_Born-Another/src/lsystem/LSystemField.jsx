import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  buildVeinDebugSamples,
  buildVeinRibbonAttributes,
  buildVeinTopology,
} from './attachLSystemToSurface.js'
import { veinFragmentShader, veinVertexShader } from './veinShader.js'
import {
  LSYSTEM_ANGLE_MAX,
  LSYSTEM_ANGLE_MIN,
  LSYSTEM_BASE_THICKNESS_MAX,
  LSYSTEM_BASE_THICKNESS_MIN,
  LSYSTEM_BODY_SEGMENTS,
  LSYSTEM_BRANCH_ROTATION_MAX,
  LSYSTEM_BRANCH_ROTATION_MIN,
  LSYSTEM_CHILD_RATIO_MAX,
  LSYSTEM_CHILD_RATIO_MIN,
  LSYSTEM_DEPTH_MAX,
  LSYSTEM_DEPTH_MIN,
  LSYSTEM_GROWTH_LAG,
  LSYSTEM_LENGTH_MAX,
  LSYSTEM_LENGTH_MIN,
  LSYSTEM_MIN_HALF_WIDTH,
  LSYSTEM_RANDOMNESS_MAX,
  LSYSTEM_RANDOMNESS_MIN,
  LSYSTEM_SURFACE_OFFSET,
  LSYSTEM_VEIN_COLOR,
} from './lsystemParams.js'

const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * Hierarchical veins on the organism membrane.
 * Topology is built once per SEED / shape params in rest space; the vertex
 * shader deforms it every frame with the same GLSL as the body, so veins
 * follow AGE morphing, breathing and decay warp exactly.
 */
export default function LSystemField({
  depth = 3,
  angle = 30,
  length = 0.85,
  branchRotation = 40,
  randomness = 0.32,
  baseThickness = 0.016,
  taperStrength = 0.4,
  childThicknessRatio = 0.55,
  showDebug = false,
  seed = 1,
  age = 0.5,
  noiseScale = 2.8,
  speed = 0.32,
  pulseSpeed = 1.1,
  displacement = 0.22,
  noiseAmount = 1.55,
  decayScale = 1.35,
  decayDisplacement = 0.055,
  lateWarp = 1,
}) {
  const safeDepth = clampTo(Math.round(depth), LSYSTEM_DEPTH_MIN, LSYSTEM_DEPTH_MAX)
  const safeAngle = clampTo(angle, LSYSTEM_ANGLE_MIN, LSYSTEM_ANGLE_MAX)
  const safeLength = clampTo(length, LSYSTEM_LENGTH_MIN, LSYSTEM_LENGTH_MAX)
  const safeRotation = clampTo(
    branchRotation,
    LSYSTEM_BRANCH_ROTATION_MIN,
    LSYSTEM_BRANCH_ROTATION_MAX,
  )
  const safeRandom = clampTo(randomness, LSYSTEM_RANDOMNESS_MIN, LSYSTEM_RANDOMNESS_MAX)
  const safeBase = clampTo(
    baseThickness,
    LSYSTEM_BASE_THICKNESS_MIN,
    LSYSTEM_BASE_THICKNESS_MAX,
  )
  const safeTaper = clampTo(taperStrength, 0, 1)
  const safeChild = clampTo(
    childThicknessRatio,
    LSYSTEM_CHILD_RATIO_MIN,
    LSYSTEM_CHILD_RATIO_MAX,
  )

  const topology = useMemo(
    () =>
      buildVeinTopology({
        depth: safeDepth,
        angle: safeAngle,
        length: safeLength,
        branchRotation: safeRotation,
        randomness: safeRandom,
        seed,
        childThicknessRatio: safeChild,
        taperStrength: safeTaper,
      }),
    [safeDepth, safeAngle, safeLength, safeRotation, safeRandom, seed, safeChild, safeTaper],
  )

  const veinGeo = useMemo(() => {
    const attrs = buildVeinRibbonAttributes(topology.branches, seed)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(attrs.position, 3))
    geo.setAttribute('aTangent', new THREE.BufferAttribute(attrs.tangent, 3))
    geo.setAttribute('aInfo', new THREE.BufferAttribute(attrs.info, 4))
    geo.setAttribute('aBranch', new THREE.BufferAttribute(attrs.branch, 2))
    geo.setIndex(new THREE.BufferAttribute(attrs.index, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.5)
    return geo
  }, [topology, seed])

  const veinMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: veinVertexShader,
        fragmentShader: veinFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uAge: { value: 0 },
          uSeed: { value: 1 },
          uNoiseScale: { value: 2.8 },
          uSpeed: { value: 0.32 },
          uPulseSpeed: { value: 1.1 },
          uDisplacement: { value: 0.22 },
          uNoiseAmount: { value: 1.55 },
          uDecayScale: { value: 1.35 },
          uDecayDisplacement: { value: 0.055 },
          uLateWarp: { value: 1 },
          uOffset: { value: LSYSTEM_SURFACE_OFFSET },
          uBaseThickness: { value: 0.0055 },
          uTaper: { value: 0.6 },
          uMinWidth: { value: LSYSTEM_MIN_HALF_WIDTH },
          uLag: { value: LSYSTEM_GROWTH_LAG },
          uBodySegments: { value: LSYSTEM_BODY_SEGMENTS },
          uColor: { value: new THREE.Color(LSYSTEM_VEIN_COLOR) },
          uOpacity: { value: 0.92 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        toneMapped: false,
      }),
    [],
  )

  const pointGeo = useMemo(() => new THREE.BufferGeometry(), [])
  const normalGeo = useMemo(() => new THREE.BufferGeometry(), [])
  const pointMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color('#c45c3e'),
        size: 0.028,
        sizeAttenuation: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const normalMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color('#3d6b8c'),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  useLayoutEffect(() => () => veinGeo.dispose(), [veinGeo])
  useLayoutEffect(
    () => () => {
      pointGeo.dispose()
      normalGeo.dispose()
      veinMat.dispose()
      pointMat.dispose()
      normalMat.dispose()
    },
    [pointGeo, normalGeo, veinMat, pointMat, normalMat],
  )

  const paramsRef = useRef({})
  paramsRef.current = {
    seed,
    age,
    noiseScale,
    speed,
    pulseSpeed,
    displacement,
    noiseAmount,
    decayScale,
    decayDisplacement,
    lateWarp,
    safeBase,
    safeTaper,
    showDebug,
    topology,
  }
  const debugFrameRef = useRef(0)

  useFrame(({ clock }) => {
    const p = paramsRef.current
    const time = clock.getElapsedTime()
    const u = veinMat.uniforms
    u.uTime.value = time
    u.uAge.value = Number(p.age) || 0
    u.uSeed.value = Number(p.seed) || 1
    u.uNoiseScale.value = p.noiseScale
    u.uSpeed.value = p.speed
    u.uPulseSpeed.value = p.pulseSpeed
    u.uDisplacement.value = p.displacement
    u.uNoiseAmount.value = p.noiseAmount
    u.uDecayScale.value = p.decayScale
    u.uDecayDisplacement.value = p.decayDisplacement
    u.uLateWarp.value = p.lateWarp
    u.uBaseThickness.value = p.safeBase
    u.uTaper.value = p.safeTaper

    if (!p.showDebug) return
    debugFrameRef.current += 1
    if (debugFrameRef.current % 4 !== 1) return
    const dbg = buildVeinDebugSamples(p.topology.branches, {
      time,
      age: p.age,
      seed: p.seed,
      noiseScale: p.noiseScale,
      speed: p.speed,
      pulseSpeed: p.pulseSpeed,
      displacement: p.displacement,
      noiseAmount: p.noiseAmount,
      decayScale: p.decayScale,
      decayDisplacement: p.decayDisplacement,
      lateWarp: p.lateWarp,
    })
    pointGeo.setAttribute('position', new THREE.BufferAttribute(dbg.points, 3))
    normalGeo.setAttribute('position', new THREE.BufferAttribute(dbg.normals, 3))
    pointGeo.computeBoundingSphere()
    normalGeo.computeBoundingSphere()
  })

  return (
    <group>
      <mesh geometry={veinGeo} material={veinMat} frustumCulled={false} renderOrder={4} />
      {showDebug ? (
        <>
          <points geometry={pointGeo} material={pointMat} frustumCulled={false} renderOrder={5} />
          <lineSegments
            geometry={normalGeo}
            material={normalMat}
            frustumCulled={false}
            renderOrder={5}
          />
        </>
      ) : null}
    </group>
  )
}
