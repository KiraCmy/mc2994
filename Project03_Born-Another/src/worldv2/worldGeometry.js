import * as THREE from 'three'
import {
  mergeGeometries,
  mergeVertices,
} from 'three/addons/utils/BufferGeometryUtils.js'
import {
  CRYSTAL_INNER_OFFSET,
  CRYSTAL_SURFACE_EMBED,
  createPrimaryCrystalGeometry,
} from './primaryCrystalGeometry.js'

export const WORLD_V2_SEED = 7319

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomDirection(random) {
  const z = random() * 2 - 1
  const angle = random() * Math.PI * 2
  const radius = Math.sqrt(1 - z * z)
  return new THREE.Vector3(
    radius * Math.cos(angle),
    radius * Math.sin(angle),
    z,
  )
}

function makeField(seed) {
  const random = mulberry32(seed)
  const phase = Array.from({ length: 7 }, () => random() * Math.PI * 2)
  const lobes = Array.from({ length: 9 }, () => ({
    direction: randomDirection(random),
    width: THREE.MathUtils.lerp(2.8, 5.2, random()),
    strength: THREE.MathUtils.lerp(-0.14, 0.27, random()),
  }))

  function radiusAt(direction) {
    const { x, y, z } = direction
    const broad =
      Math.sin(x * 2.4 + phase[0]) *
        Math.cos(y * 2.05 + phase[1]) *
        Math.sin(z * 2.7 + phase[2]) +
      0.55 * Math.sin((x + y) * 4.2 + phase[3]) +
      0.32 * Math.cos((y - z) * 7.1 + phase[4]) +
      0.15 * Math.sin((x + z) * 12.5 + phase[5])

    let local = 0
    for (const lobe of lobes) {
      const distance = 1 - direction.dot(lobe.direction)
      local += Math.exp(-distance * lobe.width) * lobe.strength
    }

    return 2.02 * (1 + broad * 0.12 + local) * (1 + y * 0.055)
  }

  return { random, radiusAt }
}

function buildBodyGeometry(field) {
  let geometry = new THREE.IcosahedronGeometry(1, 28)
  geometry.deleteAttribute('normal')
  geometry.deleteAttribute('uv')
  geometry = mergeVertices(geometry)

  const positions = geometry.attributes.position
  const colors = new Float32Array(positions.count * 3)
  const direction = new THREE.Vector3()
  const color = new THREE.Color()
  const deep = new THREE.Color('#102b31')
  const cool = new THREE.Color('#28717a')
  const warm = new THREE.Color('#613448')
  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize()
    const radius = field.radiusAt(direction)
    const variation =
      Math.sin(direction.x * 8.4 + direction.z * 3.1) *
        Math.cos(direction.y * 7.2 - direction.z * 2.6) *
        0.5 +
      0.5
    color.copy(deep).lerp(cool, THREE.MathUtils.smoothstep(variation, 0.16, 0.82))
    const warmth = Math.max(
      0,
      Math.sin(direction.x * 4.2 - direction.y * 5.8 + direction.z * 3.4) *
        0.5 +
        0.22,
    )
    color.lerp(warm, warmth * 0.48)
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
    direction.multiplyScalar(radius)
    positions.setXYZ(index, direction.x, direction.y, direction.z)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  positions.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  geometry.name = 'WORLD V2 shared living surface'
  return geometry
}

function tangentBasis(normal) {
  const tangent = new THREE.Vector3()
    .crossVectors(
      Math.abs(normal.y) > 0.85
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0),
      normal,
    )
    .normalize()
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize()
  return { tangent, bitangent }
}

function crystalTransform(position, axis, radius, length, roll, depth = radius) {
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    axis,
  )
  quaternion.multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll),
  )
  return new THREE.Matrix4().compose(
    position,
    quaternion,
    new THREE.Vector3(radius, length, depth),
  )
}

function addGrowthAttributes(geometry, origin, direction, phase) {
  const count = geometry.attributes.position.count
  const origins = new Float32Array(count * 3)
  const directions = new Float32Array(count * 3)
  const phases = new Float32Array(count)
  for (let index = 0; index < count; index += 1) {
    origins[index * 3] = origin.x
    origins[index * 3 + 1] = origin.y
    origins[index * 3 + 2] = origin.z
    directions[index * 3] = direction.x
    directions[index * 3 + 1] = direction.y
    directions[index * 3 + 2] = direction.z
    phases[index] = phase
  }
  geometry.setAttribute('growthOrigin', new THREE.BufferAttribute(origins, 3))
  geometry.setAttribute(
    'growthDirection',
    new THREE.BufferAttribute(directions, 3),
  )
  geometry.setAttribute('growthPhase', new THREE.BufferAttribute(phases, 1))
}

function buildCrystalGrowths(field, seed) {
  const random = mulberry32(seed ^ 0x91a73)
  const outsideParts = []
  const insideParts = []
  const mineralParts = []
  const anchorData = []
  const baseSpike = createPrimaryCrystalGeometry({
    sides: 6,
    taper: 0.08,
    shoulder: 0.66,
  })
  const baseMineral = new THREE.DodecahedronGeometry(1, 0)

  const interiorLandmarks = [
    new THREE.Vector3(0.12, 0.08, -1).normalize(),
    new THREE.Vector3(-0.62, 0.34, -0.72).normalize(),
    new THREE.Vector3(0.68, -0.28, -0.7).normalize(),
  ]

  for (let anchorIndex = 0; anchorIndex < 19; anchorIndex += 1) {
    const normal =
      interiorLandmarks[anchorIndex]?.clone() ?? randomDirection(random)
    const surfaceRadius = field.radiusAt(normal)
    const surface = normal.clone().multiplyScalar(surfaceRadius)
    const { tangent, bitangent } = tangentBasis(normal)
    const count = 4 + Math.floor(random() * 4)
    const clusterScale = THREE.MathUtils.lerp(0.75, 1.25, random())
    const clusterPhase = Math.min(
      0.78,
      anchorIndex * 0.027 + random() * 0.16,
    )
    anchorData.push({
      direction: normal.clone(),
      radius: surfaceRadius,
      count,
      clusterScale,
    })

    const mineral = baseMineral.clone()
    const mineralPosition = surface
      .clone()
      .addScaledVector(normal, -0.045)
    const mineralScale = THREE.MathUtils.lerp(0.04, 0.07, random())
    mineral.applyMatrix4(
      new THREE.Matrix4().compose(
        mineralPosition,
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          normal,
        ),
        new THREE.Vector3(
          mineralScale * 1.05,
          mineralScale * 0.9,
          mineralScale,
        ),
      ),
    )
    addGrowthAttributes(mineral, mineralPosition, normal, clusterPhase * 0.82)
    mineralParts.push(mineral)

    for (let spikeIndex = 0; spikeIndex < count; spikeIndex += 1) {
      const angle = (spikeIndex / count) * Math.PI * 2 + random() * 0.55
      const spread = THREE.MathUtils.lerp(0.08, 0.27, random()) * clusterScale
      const offset = tangent
        .clone()
        .multiplyScalar(Math.cos(angle) * spread)
        .addScaledVector(bitangent, Math.sin(angle) * spread)
      const outwardAxis = normal
        .clone()
        .addScaledVector(tangent, Math.cos(angle) * THREE.MathUtils.lerp(0.05, 0.28, random()))
        .addScaledVector(bitangent, Math.sin(angle) * THREE.MathUtils.lerp(0.05, 0.28, random()))
        .normalize()
      const length = THREE.MathUtils.lerp(0.18, 0.42, random()) * clusterScale
      const width = length * THREE.MathUtils.lerp(0.24, 0.36, random())
      const depth = width * THREE.MathUtils.lerp(0.86, 1, random())
      const growthPhase = Math.min(0.86, clusterPhase + random() * 0.18)
      const growthOrigin = surface.clone().add(offset)
      const embed = CRYSTAL_SURFACE_EMBED
      // Seat along the membrane normal; grow along the outward axis so the
      // crystal clears the surface instead of burying along a tilted root.
      const outsideBase = growthOrigin.clone().addScaledVector(normal, -embed)
      const outsideFacing = Math.max(0, outwardAxis.dot(normal))
      const outsideLength = length + embed * outsideFacing

      const outside = baseSpike.clone()
      outside.applyMatrix4(
        crystalTransform(
          outsideBase,
          outwardAxis,
          width,
          outsideLength,
          random() * Math.PI,
          depth,
        ),
      )
      // Growth origin is the root (base), not the centroid, so AGE reveal
      // expands in place instead of swimming toward the membrane.
      addGrowthAttributes(outside, outsideBase, outwardAxis, growthPhase)
      outsideParts.push(outside)

      const inwardAxis = outwardAxis.clone().negate()
      const insideLength = length * 0.9
      const insideBase = growthOrigin
        .clone()
        .addScaledVector(normal, -CRYSTAL_INNER_OFFSET)
      const inside = baseSpike.clone()
      inside.applyMatrix4(
        crystalTransform(
          insideBase,
          inwardAxis,
          width * 1.04,
          insideLength,
          random() * Math.PI,
          depth,
        ),
      )
      addGrowthAttributes(inside, insideBase, inwardAxis, growthPhase)
      insideParts.push(inside)
    }
  }

  baseSpike.dispose()
  baseMineral.dispose()
  const outside = mergeGeometries(outsideParts, false)
  const inside = mergeGeometries(insideParts, false)
  const minerals = mergeGeometries(mineralParts, false)
  for (const part of [...outsideParts, ...insideParts, ...mineralParts]) part.dispose()
  outside.computeVertexNormals()
  inside.computeVertexNormals()
  minerals.computeVertexNormals()
  outside.name = 'WORLD V2 exterior crystalline growth'
  inside.name = 'WORLD V2 interior crystalline growth'
  minerals.name = 'WORLD V2 pyrite surface anchors'
  return { outside, inside, minerals, anchors: anchorData }
}

export function createWorldGeometry(seed = WORLD_V2_SEED) {
  const field = makeField(seed)
  const surface = buildBodyGeometry(field)
  const growths = buildCrystalGrowths(field, seed)
  return {
    seed,
    surface,
    radiusAt: field.radiusAt,
    ...growths,
  }
}

export function disposeWorldGeometry(world) {
  world.surface.dispose()
  world.outside.dispose()
  world.inside.dispose()
  world.minerals.dispose()
}
