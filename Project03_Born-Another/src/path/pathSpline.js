import * as THREE from 'three'
import { deformRestPoint } from './surfaceDisplace.js'

/**
 * Build a smoothed Catmull-Rom polyline from rest samples after deforming
 * each sample onto the living surface. Returns THREE.Vector3[].
 */
export function buildSurfaceSpline(restPoints, uniforms, surfaceOffset, divisionsPerSegment = 8) {
  if (!restPoints || restPoints.length === 0) return []

  const deformed = restPoints.map((rest) => {
    const { position } = deformRestPoint(rest, uniforms, surfaceOffset)
    return new THREE.Vector3(position[0], position[1], position[2])
  })

  if (deformed.length <= 2) return deformed

  const curve = new THREE.CatmullRomCurve3(deformed, false, 'catmullrom', 0.35)
  const segments = Math.max(deformed.length - 1, 1)
  return curve.getPoints(segments * divisionsPerSegment)
}

/**
 * Thin a freehand stroke: keep endpoints, drop near-duplicates.
 */
export function consolidateRestStroke(restPoints, minSpacing = 0.04) {
  if (!restPoints?.length) return []
  const out = [restPoints[0]]
  for (let i = 1; i < restPoints.length; i += 1) {
    const prev = out[out.length - 1]
    const cur = restPoints[i]
    const d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2])
    if (d >= minSpacing) out.push(cur)
  }
  const last = restPoints[restPoints.length - 1]
  const tip = out[out.length - 1]
  if (
    Math.hypot(last[0] - tip[0], last[1] - tip[1], last[2] - tip[2]) >
    minSpacing * 0.35
  ) {
    out.push(last)
  }
  return out
}

export function createStrokeId() {
  return `stroke-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5)}`
}
