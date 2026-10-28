/**
 * Exp03 Study 01 — procedural crystal clusters seated on the frozen membrane.
 * Receives WorldViewport organismOverlay context; growth from Life sites only.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { crystalDissolveProgress } from '../../worldv2/crystalDissolution.js'
import {
  crystalRootAndLength,
  secondaryFacingDirection,
  surfaceGrowthAxes,
} from '../../worldv2/crystalOrientation.js'
import {
  formMorphAmount,
  morphRestRadius,
  primaryCrystalAnchor,
} from '../../worldv2/life/worldLifeAdapter.js'
import { sampleTurbulenceFromLife } from '../../worldv2/turbulenceField.js'
import {
  createClusterShardGeometrySet,
  planCrystalCluster,
} from './crystalClusterGeometry.js'
import {
  createExp03CrystalMaterial,
  updateExp03CrystalMaterial,
} from './crystalClusterMaterial.js'

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function collectVisibleSites(life, visibleGrowthSiteIds) {
  const sites = life?.outputs?.surface?.spatialGrowthSites ?? []
  if (!Array.isArray(visibleGrowthSiteIds) || !visibleGrowthSiteIds.length) {
    return sites
  }
  const allow = new Set(visibleGrowthSiteIds)
  return sites.filter((site) => allow.has(site.id))
}

function buildTransforms(
  world,
  life,
  sites,
  {
    clusterDensity = 0.72,
    branching = 0.55,
    lengthVariation = 0.45,
  } = {},
) {
  if (!world || !life || !sites?.length) return []

  const deformations = life.outputs?.form?.localDeformations ?? []
  const morph = formMorphAmount(life?.variables?.growth ?? 1)
  const seed = life.seed ?? 0
  const age = life.age ?? 0
  const decay = life.variables?.decay ?? 0
  const yUp = new THREE.Vector3(0, 1, 0)
  const out = []

  for (const site of sites) {
    const crystal = site.crystal
    if (!crystal) continue

    const outwardNormal = new THREE.Vector3()
      .fromArray(site.direction)
      .normalize()
    const { exteriorAxis, outwardNormal: outward } = surfaceGrowthAxes(
      crystal.growthDirection ?? crystal.direction,
      outwardNormal.toArray(),
    )
    const restRadius = world.radiusAt(outwardNormal)
    const shapedRadius = morphRestRadius(restRadius, morph)
    const restPoint = [
      site.direction[0] * shapedRadius,
      site.direction[1] * shapedRadius,
      site.direction[2] * shapedRadius,
    ]
    const extra = sampleTurbulenceFromLife(
      restPoint[0],
      restPoint[1],
      restPoint[2],
      life,
    )
    const surface = new THREE.Vector3().fromArray(
      primaryCrystalAnchor(site, restRadius, deformations, 0, morph, extra),
    )

    const dissolve = crystalDissolveProgress(seed, crystal.id, age, decay)
    const shards = planCrystalCluster(site, {
      seed,
      clusterDensity,
      branching,
      lengthVariation,
      dissolve,
    })

    const primaryPlacement = crystalRootAndLength({
      surface: surface.toArray(),
      facingNormal: outward,
      growthAxis: exteriorAxis,
      length: Math.max(0.01, Number(crystal.length) || 0.01),
      embed: 0.045,
    })
    const primaryRoot = new THREE.Vector3().fromArray(primaryPlacement.root)
    const primaryAxis = new THREE.Vector3().fromArray(exteriorAxis)
    const faceOut = new THREE.Vector3().fromArray(outward)
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
      if (shard.parentPrimary) {
        axis = new THREE.Vector3().fromArray(
          secondaryFacingDirection(shard.axis, exteriorAxis, outward),
        )
      }

      let root = primaryRoot.clone()
      if (shard.role === 'secondary' && shard.attachAlong != null) {
        const along =
          primaryPlacement.visualLength * clamp01(shard.attachAlong)
        root = primaryRoot
          .clone()
          .addScaledVector(primaryAxis, along)
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

      const shrink = 1 - dissolve * 0.55
      out.push({
        key: shard.id,
        profileIndex: shard.profileIndex,
        position: root,
        quaternion,
        scale: new THREE.Vector3(
          shard.width * shrink,
          shard.length * shrink,
          shard.depth * shrink,
        ),
        tint: shard.tint,
        opacity: Math.max(0, 1 - dissolve),
      })
    }
  }

  return out
}

export default function CrystalClusterField({
  world,
  life,
  visibleGrowthSiteIds = null,
  clusterDensity = 0.72,
  branching = 0.55,
  lengthVariation = 0.45,
}) {
  const geometries = useMemo(() => createClusterShardGeometrySet(), [])
  const materialPoolRef = useRef(new Map())

  const sites = useMemo(
    () => collectVisibleSites(life, visibleGrowthSiteIds),
    [life, visibleGrowthSiteIds],
  )

  const transforms = useMemo(
    () =>
      buildTransforms(world, life, sites, {
        clusterDensity,
        branching,
        lengthVariation,
      }),
    [world, life, sites, clusterDensity, branching, lengthVariation],
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
    <group name="exp03-crystal-clusters">
      {transforms.map((entry) => {
        if (entry.opacity < 0.02) return null
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
