/**
 * Exp03 Study 01 — static mature crystal clusters on the Exp05 Explore membrane.
 * No Growth Time / dissolve. Seats via shared Exp05 surface evaluator.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  createExp05RadiusAt,
  evaluateExp05SurfacePoint,
} from '../finalForm/exp05SurfaceEvaluator.js'
import { estimateRadiusAtMean } from '../finalForm/exp05MorphologyCalibration.js'
import {
  createClusterShardGeometrySet,
  planCrystalCluster,
} from './crystalClusterGeometry.js'
import {
  createExp03CrystalMaterial,
  updateExp03CrystalMaterial,
} from './crystalClusterMaterial.js'
import { buildStaticMatureSites } from './staticCrystalPlan.js'

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

function buildStaticTransforms(
  life,
  sites,
  {
    clusterDensity = 0.85,
    branching = 0.72,
    lengthVariation = 0.55,
    lobeAmplitude = 1,
    morphologyType,
  } = {},
) {
  if (!life || !sites?.length) return []

  const seed = life.seed ?? 1
  const radiusAt = createExp05RadiusAt(seed, morphologyType)
  const restMean = estimateRadiusAtMean(radiusAt)

  const yUp = new THREE.Vector3(0, 1, 0)
  const out = []

  for (const site of sites) {
    const crystal = site.crystal
    if (!crystal) continue

    const sample = evaluateExp05SurfacePoint(site.direction, life, radiusAt, {
      finiteDifferenceNormal: true,
      morphStrength: 1,
      deformationStrength: 0,
      lobeAmplitude,
      restMean,
      temperature: 0.5,
      sculpturalStrength: 0,
    })
    if (!sample?.position) continue

    const surface = new THREE.Vector3().fromArray(sample.position)
    const faceOut = sample.normal
      ? new THREE.Vector3().fromArray(sample.normal).normalize()
      : new THREE.Vector3().fromArray(site.direction).normalize()
    const growthAxis = new THREE.Vector3()
      .fromArray(crystal.growthDirection ?? site.direction)
      .normalize()
    /* Keep growth in the outward hemisphere. */
    if (growthAxis.dot(faceOut) < 0.15) {
      growthAxis.copy(faceOut)
    }

    const shards = planCrystalCluster(site, {
      seed,
      clusterDensity,
      branching,
      lengthVariation,
      dissolve: 0,
    })

    const embed = 0.04
    const primaryRoot = surface
      .clone()
      .addScaledVector(faceOut, -embed)
    const primaryLength = Math.max(0.02, Number(crystal.length) || 0.2)

    const basisHelper =
      Math.abs(faceOut.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0)
    const tangent = new THREE.Vector3()
      .crossVectors(basisHelper, faceOut)
      .normalize()
    const bitangent = new THREE.Vector3()
      .crossVectors(faceOut, tangent)
      .normalize()

    for (const shard of shards) {
      let axis = new THREE.Vector3().fromArray(shard.axis).normalize()
      if (axis.dot(faceOut) < 0.05) {
        axis = axis.add(faceOut).normalize()
      }

      let root = primaryRoot.clone()
      if (shard.role === 'secondary' && shard.attachAlong != null) {
        const along = primaryLength * clamp01(shard.attachAlong)
        root = primaryRoot
          .clone()
          .addScaledVector(growthAxis, along)
          .addScaledVector(axis, -(shard.nest || 0.008))
      } else {
        const radial = shard.radial || 0
        if (radial > 0) {
          root = root
            .clone()
            .addScaledVector(
              tangent,
              Math.cos(shard.radialAngle || 0) * radial,
            )
            .addScaledVector(
              bitangent,
              Math.sin(shard.radialAngle || 0) * radial,
            )
        }
        root.addScaledVector(faceOut, -(shard.nest || 0.01))
      }

      const quaternion = new THREE.Quaternion().setFromUnitVectors(yUp, axis)
      quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(yUp, shard.roll || 0),
      )

      out.push({
        key: `static-${shard.id}`,
        profileIndex: shard.profileIndex,
        position: root,
        quaternion,
        scale: new THREE.Vector3(shard.width, shard.length, shard.depth),
        tint: shard.tint,
        opacity: 1,
      })
    }
  }

  return out
}

export default function StaticCrystalClusterField({
  life,
  clusterDensity = 0.85,
  branching = 0.72,
  lengthVariation = 0.55,
  lobeAmplitude = 1,
  morphologyType,
}) {
  const geometries = useMemo(() => createClusterShardGeometrySet(), [])
  const materialPoolRef = useRef(new Map())

  const sites = useMemo(
    () => buildStaticMatureSites(life?.seed ?? 1),
    [life?.seed],
  )

  const transforms = useMemo(
    () =>
      buildStaticTransforms(life, sites, {
        clusterDensity,
        branching,
        lengthVariation,
        lobeAmplitude,
        morphologyType,
      }),
    [
      life,
      sites,
      clusterDensity,
      branching,
      lengthVariation,
      lobeAmplitude,
      morphologyType,
    ],
  )

  const pool = materialPoolRef.current
  for (const entry of transforms) {
    let material = pool.get(entry.key)
    if (!material) {
      material = createExp03CrystalMaterial({
        tint: entry.tint,
        opacity: entry.opacity,
      })
      pool.set(entry.key, material)
    } else {
      updateExp03CrystalMaterial(material, {
        tint: entry.tint,
        opacity: entry.opacity,
      })
    }
  }

  useEffect(
    () => () => {
      for (const geometry of geometries) geometry.dispose()
      for (const material of materialPoolRef.current.values()) {
        material.dispose()
      }
      materialPoolRef.current.clear()
    },
    [geometries],
  )

  return (
    <group name="exp03-static-crystal-clusters">
      {transforms.map((entry) => {
        const material = pool.get(entry.key)
        const geometry = geometries[entry.profileIndex % geometries.length]
        if (!material || !geometry) return null
        return (
          <mesh
            key={entry.key}
            geometry={geometry}
            material={material}
            position={entry.position}
            quaternion={entry.quaternion}
            scale={entry.scale}
            frustumCulled={false}
            renderOrder={4}
          />
        )
      })}
    </group>
  )
}
