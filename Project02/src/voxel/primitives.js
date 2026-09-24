/**
 * SDF primitives (negative = inside / solid).
 * Matches Voxel_Basic.md / Inigo Quilez convention.
 * Convert to density with: density = -sdf
 */

function length3(x, y, z) {
  return Math.hypot(x, y, z)
}

/** @param {{x:number,y:number,z:number}} p @param {[number,number,number]} center @param {number} r */
export function sdSphere(p, center, r) {
  const [cx, cy, cz] = center
  return length3(p.x - cx, p.y - cy, p.z - cz) - r
}

/**
 * Axis-aligned box.
 * @param {{x:number,y:number,z:number}} p
 * @param {[number,number,number]} center
 * @param {[number,number,number]} half — half-extents
 */
export function sdBox(p, center, half) {
  const [cx, cy, cz] = center
  const [hx, hy, hz] = half
  const qx = Math.abs(p.x - cx) - hx
  const qy = Math.abs(p.y - cy) - hy
  const qz = Math.abs(p.z - cz) - hz
  const outside = length3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0))
  const inside = Math.min(Math.max(qx, qy, qz), 0)
  return outside + inside
}

/**
 * Infinite Y-axis cylinder, then finite height via ends (capsule-like slab).
 * @param {{x:number,y:number,z:number}} p
 * @param {[number,number,number]} center
 * @param {number} radius
 * @param {number} halfHeight
 */
export function sdCylinder(p, center, radius, halfHeight) {
  const [cx, cy, cz] = center
  const dXz = Math.hypot(p.x - cx, p.z - cz) - radius
  const dY = Math.abs(p.y - cy) - halfHeight
  const outside = Math.hypot(Math.max(dXz, 0), Math.max(dY, 0))
  const inside = Math.min(Math.max(dXz, dY), 0)
  return outside + inside
}
