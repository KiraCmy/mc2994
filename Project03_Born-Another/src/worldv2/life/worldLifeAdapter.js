import {
  bakedCrystalId,
  crystalDissolveProgress,
  crystalDissolveScale,
} from '../crystalDissolution.js'

function smootherstep(edge0, edge1, value) {
  const t = Math.min(
    1,
    Math.max(0, (value - edge0) / Math.max(1e-8, edge1 - edge0)),
  )
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function copyPositions(geometry) {
  return new Float32Array(geometry.attributes.position.array)
}

function captureGrowthGeometry(geometry) {
  return {
    positions: copyPositions(geometry),
    origins: geometry.attributes.growthOrigin.array,
    directions: geometry.attributes.growthDirection.array,
    phases: geometry.attributes.growthPhase.array,
  }
}

/** Uniform cool teal used while the newborn body is still a smooth sphere. */
const BIRTH_SURFACE_COLOR = [0.157, 0.443, 0.478]

export function captureWorldRestState(world) {
  return {
    surface: copyPositions(world.surface),
    surfaceColors: world.surface.attributes.color
      ? new Float32Array(world.surface.attributes.color.array)
      : null,
    outside: captureGrowthGeometry(world.outside),
    inside: captureGrowthGeometry(world.inside),
    minerals: captureGrowthGeometry(world.minerals),
  }
}

/**
 * Shared radial influence field used by the membrane and every crystal anchor.
 */
export function localField(direction, regions, valueKey) {
  let influence = 0
  for (const region of regions) {
    const source = region.direction
    const dot =
      direction[0] * source[0] +
      direction[1] * source[1] +
      direction[2] * source[2]
    const distance = 1 - Math.max(-1, Math.min(1, dot))
    const width = region.radius ?? 0.28
    const falloff = Math.exp(-(distance * distance) / (width * width))
    influence += falloff * (region[valueKey] ?? 0)
  }
  return influence
}

/** Small spherical birth radius before growth differentiates the body. */
export const ORGANISM_BIRTH_RADIUS = 1.12

/**
 * 0 = compact sphere, 1 = full mature rest shape.
 * Driven by Life Engine `growth` (visual adapter only).
 */
export function formMorphAmount(growth = 0) {
  return smootherstep(0.02, 0.58, Math.min(1, Math.max(0, Number(growth) || 0)))
}

/**
 * Lerp a mature rest-space point toward a small sphere as morph → 0.
 */
export function morphRestPoint(x, y, z, morph = 1) {
  const restRadius = Math.hypot(x, y, z) || 1
  const amount = Math.min(1, Math.max(0, Number(morph) || 0))
  const direction = [x / restRadius, y / restRadius, z / restRadius]
  const radius =
    ORGANISM_BIRTH_RADIUS + (restRadius - ORGANISM_BIRTH_RADIUS) * amount
  return [
    direction[0] * radius,
    direction[1] * radius,
    direction[2] * radius,
  ]
}

export function morphRestRadius(restRadius, morph = 1) {
  const amount = Math.min(1, Math.max(0, Number(morph) || 0))
  const mature = Number(restRadius) || ORGANISM_BIRTH_RADIUS
  return ORGANISM_BIRTH_RADIUS + (mature - ORGANISM_BIRTH_RADIUS) * amount
}

/**
 * One deformation formula for membrane vertices and crystal roots:
 * push the rest-space point along its radial direction by localField(...).
 */
export function deformRadialPoint(x, y, z, deformations = []) {
  const radius = Math.hypot(x, y, z) || 1
  const direction = [x / radius, y / radius, z / radius]
  const nextRadius =
    radius + localField(direction, deformations, 'deformation')
  return [
    direction[0] * nextRadius,
    direction[1] * nextRadius,
    direction[2] * nextRadius,
  ]
}

/**
 * World-space distance along the parent prism for a secondary crystal.
 * `attachDistance` is in simulation length units, not organism radius.
 */
export function branchAttachAlong(
  attachDistance,
  parentSimLength,
  parentWorldLength,
) {
  const sim = Math.max(0, Number(attachDistance) || 0)
  const parent = Math.max(1e-8, Number(parentSimLength) || 0)
  const world = Math.max(0, Number(parentWorldLength) || 0)
  return (Math.min(sim, parent) / parent) * world
}

export function secondaryCrystalAttachPoint(
  parentRoot,
  parentDirection,
  along,
) {
  return [
    parentRoot[0] + parentDirection[0] * along,
    parentRoot[1] + parentDirection[1] * along,
    parentRoot[2] + parentDirection[2] * along,
  ]
}

/**
 * Rest-space surface attachment for a Life Engine primary crystal.
 * Simulation stores only the unit rest direction; rendering recomputes origin
 * from the current deformed radius with the same field as the membrane.
 */
export function primaryCrystalAnchor(
  site,
  restRadius,
  deformations = [],
  lift = 0,
  morph = 1,
) {
  const direction = site.direction
  const radius = morphRestRadius(restRadius, morph)
  const rest = [
    direction[0] * radius,
    direction[1] * radius,
    direction[2] * radius,
  ]
  const deformed = deformRadialPoint(rest[0], rest[1], rest[2], deformations)
  if (!lift) return deformed
  return [
    deformed[0] + direction[0] * lift,
    deformed[1] + direction[1] * lift,
    deformed[2] + direction[2] * lift,
  ]
}

function applySurface(
  surface,
  restPositions,
  restColors,
  outputs,
  morph,
  { updateNormals = true } = {},
) {
  const position = surface.attributes.position
  const target = position.array
  const deformations = outputs.form.localDeformations
  const colorAttr = surface.attributes.color
  const colorTarget = colorAttr?.array
  // Reveal mottled vertex color only as the body leaves the birth sphere.
  const colorMorph = smootherstep(0.12, 0.72, morph)
  for (let index = 0; index < position.count; index += 1) {
    const offset = index * 3
    const shaped = morphRestPoint(
      restPositions[offset],
      restPositions[offset + 1],
      restPositions[offset + 2],
      morph,
    )
    const deformed = deformRadialPoint(
      shaped[0],
      shaped[1],
      shaped[2],
      deformations,
    )
    target[offset] = deformed[0]
    target[offset + 1] = deformed[1]
    target[offset + 2] = deformed[2]

    if (colorTarget && restColors) {
      colorTarget[offset] =
        BIRTH_SURFACE_COLOR[0] +
        (restColors[offset] - BIRTH_SURFACE_COLOR[0]) * colorMorph
      colorTarget[offset + 1] =
        BIRTH_SURFACE_COLOR[1] +
        (restColors[offset + 1] - BIRTH_SURFACE_COLOR[1]) * colorMorph
      colorTarget[offset + 2] =
        BIRTH_SURFACE_COLOR[2] +
        (restColors[offset + 2] - BIRTH_SURFACE_COLOR[2]) * colorMorph
    }
  }
  position.needsUpdate = true
  if (colorAttr) colorAttr.needsUpdate = true
  if (updateNormals) surface.computeVertexNormals()
  surface.computeBoundingSphere()
}

/**
 * Grow crystals in rest space from their root origin, then translate the whole
 * crystal with the deformed origin so clusters ride the membrane rigidly.
 */
function applyGrowthGeometry(
  geometry,
  rest,
  outputs,
  morph,
  life,
  { updateNormals = true } = {},
) {
  const position = geometry.attributes.position
  const target = position.array
  const sites = outputs.surface.mineralSites
  const deformations = outputs.form.localDeformations
  const minScale = 0.04
  const bodyScale = 0.55 + morph * 0.45
  const seed = life.seed
  const age = life.age
  const decay = life.variables.decay
  for (let index = 0; index < position.count; index += 1) {
    const offset = index * 3
    const originX = rest.origins[offset]
    const originY = rest.origins[offset + 1]
    const originZ = rest.origins[offset + 2]
    const direction = [
      rest.directions[offset],
      rest.directions[offset + 1],
      rest.directions[offset + 2],
    ]
    const boost = localField(direction, sites, 'boost')
    const growth = Math.min(1, outputs.surface.mineralGrowth + boost)
    const amount = smootherstep(
      rest.phases[index],
      Math.min(1, rest.phases[index] + 0.22),
      growth,
    )
    const dissolve = crystalDissolveProgress(
      seed,
      bakedCrystalId(originX, originY, originZ),
      age,
      decay,
    )
    const display =
      Math.max(minScale, amount) * bodyScale * crystalDissolveScale(dissolve)
    const localX = (rest.positions[offset] - originX) * display
    const localY = (rest.positions[offset + 1] - originY) * display
    const localZ = (rest.positions[offset + 2] - originZ) * display
    const shapedOrigin = morphRestPoint(originX, originY, originZ, morph)
    const deformedOrigin = deformRadialPoint(
      shapedOrigin[0],
      shapedOrigin[1],
      shapedOrigin[2],
      deformations,
    )
    target[offset] = deformedOrigin[0] + localX
    target[offset + 1] = deformedOrigin[1] + localY
    target[offset + 2] = deformedOrigin[2] + localZ
  }
  position.needsUpdate = true
  if (updateNormals) geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
}

/**
 * Rendering adapter only. The Life Engine remains unaware of Three.js geometry.
 * Exterior and interior are updated from the same lifecycle output.
 */
export function applyLifeToWorld(world, rest, life, { updateNormals = true } = {}) {
  const morph = formMorphAmount(life.variables.growth)
  applySurface(
    world.surface,
    rest.surface,
    rest.surfaceColors,
    life.outputs,
    morph,
    { updateNormals },
  )
  applyGrowthGeometry(world.outside, rest.outside, life.outputs, morph, life, {
    updateNormals,
  })
  applyGrowthGeometry(world.inside, rest.inside, life.outputs, morph, life, {
    updateNormals,
  })
  applyGrowthGeometry(world.minerals, rest.minerals, life.outputs, morph, life, {
    updateNormals,
  })
}
