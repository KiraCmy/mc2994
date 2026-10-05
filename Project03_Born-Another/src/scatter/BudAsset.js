import * as THREE from 'three'

/**
 * Procedural bud asset for Scatter.
 * Local space: origin at surface attachment, +Y = growth outward.
 * Simple stalk + droplet bulb — reusable; variation comes later.
 */
export function createBudGeometry({
  stalkHeight = 0.055,
  stalkRadiusBase = 0.0065,
  stalkRadiusTip = 0.0032,
  bulbRadius = 0.016,
  bulbElongation = 1.25,
  radialSegments = 12,
} = {}) {
  // Profile in XY (lathed around Y): x = radius, y = height along growth.
  const bulbCenterY = stalkHeight + bulbRadius * 0.55
  const tipY = bulbCenterY + bulbRadius * bulbElongation * 0.95
  const points = []

  // Base flare sitting on the membrane.
  points.push(new THREE.Vector2(stalkRadiusBase * 1.15, 0))
  points.push(new THREE.Vector2(stalkRadiusBase, stalkHeight * 0.12))

  // Tapered stalk.
  const stalkSteps = 5
  for (let i = 1; i <= stalkSteps; i += 1) {
    const t = i / stalkSteps
    const y = stalkHeight * t
    const r = THREE.MathUtils.lerp(stalkRadiusBase, stalkRadiusTip, t * t)
    points.push(new THREE.Vector2(r, y))
  }

  // Smooth blend into droplet bulb (wider mid, tapered tip).
  const bulbSteps = 10
  for (let i = 0; i <= bulbSteps; i += 1) {
    const t = i / bulbSteps
    // 0 at stalk join → 1 at tip
    const angle = t * Math.PI
    const soft = Math.sin(angle)
    const y =
      stalkHeight +
      (tipY - stalkHeight) * (0.5 - 0.5 * Math.cos(angle * 0.92))
    const r =
      stalkRadiusTip * (1.0 - t) +
      bulbRadius * soft * (0.55 + 0.45 * Math.sin(t * Math.PI))
    // Slight elongation: keep radius modest near tip.
    const tipTaper = 1.0 - Math.pow(Math.max(0, t - 0.55) / 0.45, 1.4) * 0.85
    points.push(new THREE.Vector2(Math.max(0.0008, r * tipTaper), y))
  }

  points.push(new THREE.Vector2(0, tipY))

  const geometry = new THREE.LatheGeometry(points, radialSegments)
  geometry.computeVertexNormals()
  return geometry
}

export const BUD_DEFAULTS = {
  stalkHeight: 0.055,
  stalkRadiusBase: 0.0065,
  stalkRadiusTip: 0.0032,
  bulbRadius: 0.016,
  bulbElongation: 1.25,
}
