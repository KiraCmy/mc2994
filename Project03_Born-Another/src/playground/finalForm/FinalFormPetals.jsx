import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  createGrowthClusterVariants,
  GROWTH_CLUSTER_DEFAULTS,
} from '../../scatter/GrowthClusterAsset.js'
import { sampleSphereSurface } from '../../scatter/sampleSurface.js'
import { scatterCountFromDensity } from '../../scatter/scatterParams.js'
import { isHeavyWebGLHost } from '../../renderBudget.js'
import { INITIAL_SURFACE } from '../../surfaceParams.js'
import { deformDirectionToSurface } from './finalFormSurface.js'
import {
  finalFormPetalFragmentShader,
  finalFormPetalVertexShader,
} from './finalFormShaders.js'

const UP = new THREE.Vector3(0, 1, 0)
const VARIANT_COUNT = GROWTH_CLUSTER_DEFAULTS.variantCount
/** Explore-like density; soft-cap on heavy hosts for transparent overdraw. */
const DENSITY_LIGHT = 0.72
const DENSITY_HEAVY = 0.48

/**
 * Dense Explore GrowthCluster layers on World's deformed membrane.
 * Samples the full surface (Scatter-style), not only growth sites.
 */
export default function FinalFormPetals({
  world,
  life,
  size = 1.35,
  colorA = INITIAL_SURFACE.colorA,
  colorB = INITIAL_SURFACE.colorB,
  rimColor = INITIAL_SURFACE.rimColor,
}) {
  const meshRefs = useRef([])
  const dummyRef = useRef(new THREE.Object3D())
  const heavy = useMemo(() => isHeavyWebGLHost(), [])
  const density = heavy ? DENSITY_HEAVY : DENSITY_LIGHT
  const count = scatterCountFromDensity(density)

  const samples = useMemo(
    () =>
      sampleSphereSurface({
        count,
        seed: (life?.seed ?? 7319) + 9973,
        radius: 1,
      }),
    [count, life?.seed],
  )

  const geometries = useMemo(
    () =>
      createGrowthClusterVariants(
        VARIANT_COUNT,
        (life?.seed ?? 7319) ^ 0x44017,
        {
          ...GROWTH_CLUSTER_DEFAULTS,
          /* Slightly larger lobes so layered translucency reads like Explore. */
          height: 0.092,
          spread: 0.128,
        },
      ),
    [life?.seed],
  )

  const buckets = useMemo(() => {
    const groups = Array.from({ length: VARIANT_COUNT }, () => [])
    const seed = life?.seed ?? 7319
    for (let i = 0; i < samples.length; i += 1) {
      const h = (Math.imul(i + 1, 2654435761) ^ seed) >>> 0
      groups[h % VARIANT_COUNT].push({ sample: samples[i], index: i })
    }
    /* Bias a few extra instances near live growth sites for Life Engine link. */
    const sites = life?.outputs?.surface?.spatialGrowthSites ?? []
    for (let s = 0; s < sites.length; s += 1) {
      const site = sites[s]
      if (!site?.direction) continue
      const h = (Math.imul(site.id + 91, 1597334677) ^ seed) >>> 0
      groups[h % VARIANT_COUNT].push({
        sample: {
          position: site.direction,
          normal: site.direction,
        },
        index: 10_000 + site.id,
        fromSite: true,
        length: Number(site.crystal?.length) || 0,
      })
    }
    return groups
  }, [samples, life?.seed, life?.outputs?.surface?.spatialGrowthSites])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAge: { value: life?.age ?? 0 },
      uSeed: { value: life?.seed ?? 7319 },
      uNoiseScale: { value: 2.8 },
      uSpeed: { value: 0.32 },
      uPulseSpeed: { value: 1.1 },
      uDisplacement: { value: 0.22 },
      uNoiseAmount: { value: 1.55 },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uRimColor: { value: new THREE.Color(rimColor) },
      uBodyAlpha: { value: 0.72 },
      uFresnelPower: { value: 3.1 },
      uRimStrength: { value: 1.05 },
      uDecayStart: { value: 0.88 },
      uDecayScale: { value: 1.25 },
      uDiscardThreshold: { value: 0.02 },
    }),
    [],
  )

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: finalFormPetalVertexShader,
        fragmentShader: finalFormPetalFragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        /* Match Explore Scatter: soft composite over ethereal body. */
        depthTest: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [uniforms],
  )

  useLayoutEffect(() => {
    uniforms.uColorA.value.set(colorA)
    uniforms.uColorB.value.set(colorB)
    uniforms.uRimColor.value.set(rimColor)
  }, [uniforms, colorA, colorB, rimColor])

  useLayoutEffect(
    () => () => {
      geometries.forEach((g) => g.dispose())
      material.dispose()
    },
    [geometries, material],
  )

  const scratch = useMemo(
    () => ({
      normal: new THREE.Vector3(),
      axis: new THREE.Vector3(),
      twistQ: new THREE.Quaternion(),
      pitchQ: new THREE.Quaternion(),
      baseQ: new THREE.Quaternion(),
    }),
    [],
  )

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()
    uniforms.uAge.value = life?.age ?? 0
    uniforms.uSeed.value = life?.seed ?? 7319
    if (!world || !life) return

    const dummy = dummyRef.current
    const { normal, axis, twistQ, pitchQ, baseQ } = scratch

    for (let v = 0; v < VARIANT_COUNT; v += 1) {
      const mesh = meshRefs.current[v]
      const bucket = buckets[v]
      if (!mesh || !bucket) continue
      let written = 0
      for (let i = 0; i < bucket.length; i += 1) {
        const { sample, index, fromSite, length } = bucket[i]
        const dir = sample.normal ?? sample.position
        const anchored = deformDirectionToSurface(world, life, dir)
        if (!anchored) continue
        normal
          .set(anchored.normal[0], anchored.normal[1], anchored.normal[2])
          .normalize()
        dummy.position.set(
          anchored.position[0],
          anchored.position[1],
          anchored.position[2],
        )
        if (Math.abs(normal.y) > 0.999) {
          baseQ.setFromAxisAngle(axis.set(1, 0, 0), normal.y > 0 ? 0 : Math.PI)
        } else {
          baseQ.setFromUnitVectors(UP, normal)
        }
        const twist =
          ((Math.imul(index + 3, 1597334677) >>> 0) / 4294967296) * Math.PI * 2
        twistQ.setFromAxisAngle(UP, twist)
        const tip =
          0.05 +
          ((Math.imul(index + 19, 2246822519) >>> 0) / 4294967296) * 0.14
        pitchQ.setFromAxisAngle(axis.set(0, 0, 1), tip)
        dummy.quaternion.copy(baseQ).multiply(twistQ).multiply(pitchQ)

        const layer =
          0.45 +
          ((Math.imul(index + 41, 2246822519) >>> 0) / 4294967296) * 1.35
        const siteBoost = fromSite
          ? 0.85 + Math.min(1, (length || 0) * 1.6) * 0.55
          : 1
        const jitter =
          0.5 +
          ((Math.imul(index + 11, 2246822519) >>> 0) / 4294967296) * 1.05
        const s = size * layer * siteBoost * jitter
        dummy.scale.set(s, s, s)
        dummy.updateMatrix()
        mesh.setMatrixAt(written, dummy.matrix)
        written += 1
      }
      mesh.count = written
      mesh.instanceMatrix.needsUpdate = true
      mesh.visible = written > 0
    }
  })

  const capacity = Math.max(
    ...buckets.map((b) => b.length),
    1,
  )

  return (
    <>
      {geometries.map((geometry, v) => (
        <instancedMesh
          key={`final-form-petal-${v}-${capacity}`}
          ref={(node) => {
            meshRefs.current[v] = node
          }}
          args={[geometry, material, capacity]}
          frustumCulled={false}
          renderOrder={4}
        />
      ))}
    </>
  )
}
