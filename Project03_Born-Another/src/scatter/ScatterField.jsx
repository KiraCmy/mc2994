import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  createGrowthClusterVariants,
  GROWTH_CLUSTER_DEFAULTS,
} from './GrowthClusterAsset.js'
import { createPlumeVariants, PLUME_DEFAULTS } from './PlumeAsset.js'
import { createPodVariants, POD_DEFAULTS } from './PodAsset.js'
import { sampleSphereSurface } from './sampleSurface.js'
import { scatterCountFromDensity } from './scatterParams.js'
import {
  scatterAttachmentFragmentShader,
  scatterAttachmentVertexShader,
} from '../surfaceShader.js'

const UP = new THREE.Vector3(0, 1, 0)
const VARIANT_COUNT = GROWTH_CLUSTER_DEFAULTS.variantCount

function resolveGrowthType(growthType) {
  if (growthType === 'plume' || growthType === 'pod') return growthType
  return 'membrane'
}

/**
 * Instanced scatter growths attached to the deforming base surface.
 * Rest samples stay on the unit sphere; the scatter shader deforms each
 * instance with the shared macro/micro pipeline. `growthType` swaps asset
 * geometry without reshuffling samples. `size` scales whole instances.
 */
export default function ScatterField({
  growthType = 'membrane',
  density = 0.35,
  size = 1,
  seed = 1,
  generation = 0,
  radius = 1,
  surfaceSeed = 884731,
  noiseScale = 2.8,
  age = 0.5,
  speed = 0.32,
  pulseSpeed = 1.1,
  displacement = 0.22,
  noiseAmount = 1.55,
  decayStart = 0.8,
  decayScale = 1.25,
  colorA = '#e7b6c2',
  colorB = '#a4e2e6',
  rimColor = '#a8feff',
}) {
  const meshRefs = useRef([])
  const type = resolveGrowthType(growthType)
  const rawCount = scatterCountFromDensity(density)
  const count =
    type === 'pod'
      ? Math.max(6, Math.round(rawCount * POD_DEFAULTS.densityScale))
      : rawCount

  const samples = useMemo(
    () =>
      sampleSphereSurface({
        count,
        seed: seed + generation * 9973,
        radius,
      }),
    [count, seed, generation, radius],
  )

  const membraneGeometries = useMemo(
    () =>
      createGrowthClusterVariants(
        VARIANT_COUNT,
        44017,
        GROWTH_CLUSTER_DEFAULTS,
      ),
    [VARIANT_COUNT],
  )

  const plumeGeometries = useMemo(
    () => createPlumeVariants(PLUME_DEFAULTS.variantCount, 55201),
    [],
  )

  const podGeometries = useMemo(
    () => createPodVariants(POD_DEFAULTS.variantCount, 66307),
    [],
  )

  const geometries =
    type === 'plume'
      ? plumeGeometries
      : type === 'pod'
        ? podGeometries
        : membraneGeometries

  const buckets = useMemo(() => {
    const groups = Array.from({ length: VARIANT_COUNT }, () => [])
    for (let i = 0; i < samples.length; i += 1) {
      const h = (Math.imul(i + 1, 2654435761) ^ (seed + generation)) >>> 0
      groups[h % VARIANT_COUNT].push({ sample: samples[i], index: i })
    }
    return groups
  }, [samples, seed, generation])

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
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uRimColor: { value: new THREE.Color(rimColor) },
      uBodyAlpha: { value: 0.78 },
      uFresnelPower: { value: 3.1 },
      uRimStrength: { value: 1.05 },
      uDecayStart: { value: decayStart },
      uDecayScale: { value: decayScale },
      uDiscardThreshold: { value: 0.025 },
    }),
    [],
  )

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: scatterAttachmentVertexShader,
        fragmentShader: scatterAttachmentFragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        // Body depthWrite is off in scatter mode; skip depth so the full
        // front hemisphere composites on top of the soft shell.
        depthTest: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [uniforms, scatterAttachmentVertexShader, scatterAttachmentFragmentShader],
  )

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    const normal = new THREE.Vector3()
    const axis = new THREE.Vector3()
    const flow = new THREE.Vector3()
    const xAxis = new THREE.Vector3()
    const zAxis = new THREE.Vector3()
    const basis = new THREE.Matrix4()
    const twistQ = new THREE.Quaternion()
    const pitchQ = new THREE.Quaternion()
    const baseQ = new THREE.Quaternion()
    const uniformScale = Math.max(0.05, size)
    const isPlume = type === 'plume'
    const isPod = type === 'pod'

    for (let v = 0; v < VARIANT_COUNT; v += 1) {
      const mesh = meshRefs.current[v]
      const bucket = buckets[v]
      if (!mesh || !bucket) continue

      for (let i = 0; i < bucket.length; i += 1) {
        const { sample, index } = bucket[i]
        const { position, normal: n } = sample
        normal.set(n[0], n[1], n[2]).normalize()
        dummy.position.set(position[0], position[1], position[2])

        if (isPlume) {
          // +Y = surface normal (grows outward). +X = spin-tangent so the
          // geometric sweep bends into the rotational flow.
          flow.set(position[2], 0, -position[0])
          flow.addScaledVector(normal, -flow.dot(normal))
          if (flow.lengthSq() < 1e-8) {
            flow.crossVectors(UP, normal)
          }
          if (flow.lengthSq() < 1e-8) {
            flow.set(1, 0, 0)
          }
          xAxis.copy(flow).normalize()
          zAxis.crossVectors(xAxis, normal).normalize()
          xAxis.crossVectors(normal, zAxis).normalize()
          basis.makeBasis(xAxis, normal, zAxis)
          baseQ.setFromRotationMatrix(basis)

          const yawJitter =
            (((Math.imul(index + 3, 1597334677) >>> 0) / 4294967296) - 0.5) *
            0.5
          twistQ.setFromAxisAngle(UP, yawJitter)
          const pitch =
            0.08 +
            ((Math.imul(index + 7, 2246822519) >>> 0) / 4294967296) * 0.16
          pitchQ.setFromAxisAngle(axis.set(0, 0, 1), pitch)
          dummy.quaternion.copy(baseQ).multiply(twistQ).multiply(pitchQ)
        } else {
          // Membrane + Pod: +Y along surface normal, spin around the normal.
          if (Math.abs(normal.y) > 0.999) {
            baseQ.setFromAxisAngle(
              axis.set(1, 0, 0),
              normal.y > 0 ? 0 : Math.PI,
            )
          } else {
            baseQ.setFromUnitVectors(UP, normal)
          }
          const twist =
            ((Math.imul(index + 3, 1597334677) >>> 0) / 4294967296) *
            Math.PI *
            2
          twistQ.setFromAxisAngle(UP, twist)
          // Lie near the tangent plane so the camera sees lobe faces across the
          // front of the body — upright lobes only read as a silhouette ring.
          const tip =
            isPod
              ? 0.12
              : 0.06 +
                ((Math.imul(index + 19, 2246822519) >>> 0) / 4294967296) * 0.1
          pitchQ.setFromAxisAngle(axis.set(0, 0, 1), tip)
          dummy.quaternion.copy(baseQ).multiply(twistQ).multiply(pitchQ)
        }

        // Per-instance size jitter (stable until Regenerate); Size slider is the base.
        const jitter = isPlume
          ? 0.78 +
            ((Math.imul(index + 11, 2246822519) >>> 0) / 4294967296) * 0.4
          : isPod
            ? 0.88 +
              ((Math.imul(index + 11, 2246822519) >>> 0) / 4294967296) * 0.28
            : 0.55 +
              ((Math.imul(index + 11, 2246822519) >>> 0) / 4294967296) * 0.95
        const s = uniformScale * jitter
        dummy.scale.set(s, s, s)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }

      mesh.count = bucket.length
      mesh.instanceMatrix.needsUpdate = true
    }
  }, [buckets, size, type])

  useLayoutEffect(() => {
    uniforms.uAge.value = age
    uniforms.uSeed.value = surfaceSeed
    uniforms.uNoiseScale.value = noiseScale
    uniforms.uSpeed.value = speed
    uniforms.uPulseSpeed.value = pulseSpeed
    uniforms.uDisplacement.value = displacement
    uniforms.uNoiseAmount.value = noiseAmount
    uniforms.uDecayStart.value = decayStart
    uniforms.uDecayScale.value = decayScale
    uniforms.uColorA.value.set(colorA)
    uniforms.uColorB.value.set(colorB)
    uniforms.uRimColor.value.set(rimColor)
  }, [
    uniforms,
    age,
    surfaceSeed,
    noiseScale,
    speed,
    pulseSpeed,
    displacement,
    noiseAmount,
    decayStart,
    decayScale,
    colorA,
    colorB,
    rimColor,
  ])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()
  })

  useLayoutEffect(
    () => () => {
      membraneGeometries.forEach((g) => g.dispose())
      plumeGeometries.forEach((g) => g.dispose())
      podGeometries.forEach((g) => g.dispose())
      material.dispose()
    },
    [membraneGeometries, plumeGeometries, podGeometries, material],
  )

  if (samples.length === 0) return null

  return (
    <>
      {geometries.map((geometry, v) => {
        const capacity = Math.max(buckets[v].length, 1)
        return (
          <instancedMesh
            key={`${type}-${v}-${capacity}-surface-growth`}
            ref={(node) => {
              meshRefs.current[v] = node
            }}
            args={[geometry, material, capacity]}
            frustumCulled={false}
            renderOrder={10}
          />
        )
      })}
    </>
  )
}
