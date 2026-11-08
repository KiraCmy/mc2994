/**
 * World Final — the water volume seen in every direction (M3C look).
 *
 * One direction → color function, shared by the backdrop (WaterBackdrop),
 * the seabed haze and the light shafts, so distant terrain dissolves into
 * exactly the water behind it. Lavender water: deeper violet looking down,
 * paler toward the surface, with a soft pink-white glow around the sun
 * (the scene key light, filtered down through the water).
 *
 * Colors are linear sRGB; the GLSL chunk is generated from the same values.
 */
import * as THREE from 'three'
import { KEY_DIRECTION, WATER } from './atmosphere.js'

/** Sunlight enters from the key light's direction. */
export const SUN_DIRECTION = KEY_DIRECTION

const v3 = ([r, g, b]) => `vec3(${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)})`

/** `vec3 wfWater(vec3 dir)` (dir normalized, world space) + `wfSunDir`. */
export const WATER_GLSL = /* glsl */ `
const vec3 wfSunDir = vec3(${SUN_DIRECTION.x.toFixed(5)}, ${SUN_DIRECTION.y.toFixed(5)}, ${SUN_DIRECTION.z.toFixed(5)});
vec3 wfWater(vec3 dir) {
  vec3 col = mix(${v3(WATER.horizon)}, ${v3(WATER.zenith)}, smoothstep(0.0, 0.75, dir.y));
  col = mix(col, ${v3(WATER.deep)}, smoothstep(0.0, -0.65, dir.y));
  float g = max(dot(dir, wfSunDir), 0.0);
  float glow = pow(g, 6.0) * 0.55 + pow(g, 30.0) * 0.4;
  return mix(col, ${v3(WATER.sun)}, clamp(glow, 0.0, 1.0));
}
`

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** JS mirror of wfWater (linear THREE.Color). */
export function waterColor(dir) {
  const d = dir.clone().normalize()
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
  let col = lerp(WATER.horizon, WATER.zenith, smoothstep(0, 0.75, d.y))
  col = lerp(col, WATER.deep, smoothstep(0, -0.65, d.y))
  const g = Math.max(d.dot(SUN_DIRECTION), 0)
  col = lerp(col, WATER.sun, Math.min(1, g ** 6 * 0.55 + g ** 30 * 0.4))
  return new THREE.Color().setRGB(col[0], col[1], col[2], THREE.LinearSRGBColorSpace)
}
