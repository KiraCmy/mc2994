import * as THREE from 'three'

/** Visible length / width. Keeps crystals volumetric instead of needles. */
export const CRYSTAL_MIN_ASPECT = 2.6
export const CRYSTAL_MAX_ASPECT = 4.8
export const CRYSTAL_SURFACE_EMBED = 0.08
export const CRYSTAL_INNER_OFFSET = 0.03

export const CRYSTAL_PROFILES = [
  { sides: 6, taper: 0.14 },
  { sides: 5, taper: 0.2 },
  { sides: 7, taper: 0.26 },
]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function pushFace(positions, a, b, c) {
  positions.push(
    a[0], a[1], a[2],
    b[0], b[1], b[2],
    c[0], c[1], c[2],
  )
}

/**
 * Closed faceted prism. Local space: base at y = 0 (radius 1), tip at y = 1.
 * Each face is an independent triangle with outward CCW winding so FrontSide
 * stays valid under non-uniform scale.
 */
export function createPrimaryCrystalGeometry({
  sides = 6,
  taper = 0.16,
} = {}) {
  const count = Math.max(5, Math.min(8, Math.round(sides)))
  const topRadius = Math.max(0.12, taper)
  const positions = []
  const bottom = Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    return [Math.cos(angle), 0, Math.sin(angle)]
  })
  const top = Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    return [Math.cos(angle) * topRadius, 1, Math.sin(angle) * topRadius]
  })
  const bottomCenter = [0, 0, 0]
  const topCenter = [0, 1, 0]

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count
    pushFace(positions, bottomCenter, bottom[index], bottom[next])
    pushFace(positions, bottom[index], top[next], bottom[next])
    pushFace(positions, bottom[index], top[index], top[next])
    pushFace(positions, topCenter, top[next], top[index])
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.name = 'WORLD V2 primary crystal'
  return geometry
}

export function crystalProfileForSite(site) {
  return CRYSTAL_PROFILES[Math.abs(site.id | 0) % CRYSTAL_PROFILES.length]
}

/**
 * Rendering-only proportions. Simulation length / radius stay unchanged.
 */
export function primaryCrystalRenderMetrics(crystal, site = {}) {
  const length = Math.max(0.012, Number(crystal?.length) || 0)
  const rawWidth = Math.max(0.001, Number(crystal?.radius) || 0)
  const width = clamp(
    rawWidth * 2.6,
    length / CRYSTAL_MAX_ASPECT,
    length / CRYSTAL_MIN_ASPECT,
  )
  const flatten = 0.86 + ((Number(site.scale) || 1) - 0.72) * 0.18
  const profile = crystalProfileForSite(site)
  return {
    length,
    width,
    depth: width * clamp(flatten, 0.86, 1),
    embed: CRYSTAL_SURFACE_EMBED,
    innerOffset: CRYSTAL_INNER_OFFSET,
    profile,
  }
}

export function createPrimaryCrystalGeometrySet() {
  return CRYSTAL_PROFILES.map((profile) => createPrimaryCrystalGeometry(profile))
}

export function countDegenerateCrystalFaces(geometry, epsilon = 1e-8) {
  const position = geometry.attributes.position
  let degenerate = 0
  for (let index = 0; index < position.count; index += 3) {
    const ax = position.getX(index)
    const ay = position.getY(index)
    const az = position.getZ(index)
    const bx = position.getX(index + 1) - ax
    const by = position.getY(index + 1) - ay
    const bz = position.getZ(index + 1) - az
    const cx = position.getX(index + 2) - ax
    const cy = position.getY(index + 2) - ay
    const cz = position.getZ(index + 2) - az
    const nx = by * cz - bz * cy
    const ny = bz * cx - bx * cz
    const nz = bx * cy - by * cx
    if (Math.hypot(nx, ny, nz) < epsilon) degenerate += 1
  }
  return degenerate
}
