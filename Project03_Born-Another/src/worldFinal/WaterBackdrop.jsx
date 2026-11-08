/**
 * World Final — the water behind and around everything (M3C).
 *
 *   backdrop  opaque full-screen quad drawn first: wfWater(view direction),
 *             so the sky glow stays anchored to the world as the camera turns
 *             and the seabed haze (same function) meets it without a seam.
 *   shafts    additive full-screen quad drawn after the terrain, before the
 *             organism: soft rays fanning out from the sun direction, slowly
 *             shifting. Analytic (angular noise around the sun axis) — no
 *             depth texture, no post-processing.
 *
 * Both quads cost one cheap fragment per pixel.
 */
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WATER } from './atmosphere.js'
import { WATER_GLSL } from './waterVolume.js'

export const BACKDROP_RENDER_ORDER = -10
/** Between the terrain (0) and the organism (3+). */
export const SHAFTS_RENDER_ORDER = 1

const vertexShader = /* glsl */ `
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
varying vec3 vDir;
void main() {
  vec4 view = uInvProj * vec4(position.xy, 1.0, 1.0);
  vDir = (uCamWorld * vec4(view.xyz / view.w, 0.0)).xyz;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
`

const backdropFragment = /* glsl */ `
varying vec3 vDir;
${WATER_GLSL}
${NOISE_GLSL}
void main() {
  vec3 dir = normalize(vDir);
  vec3 col = wfWater(dir);
  /* Distant ranges (虚影): two soft layers standing on the horizon. They
     live only in the backdrop, so the seabed dissolves into them. */
  vec2 horiz = normalize(dir.xz + vec2(1e-5));
  /* Several peaks across one view. The hero sky only opens above the far
     dunes (dir.y ~ 0.09) and closes near 0.28, so tops live in that band. */
  float near = vnoise(horiz * 4.2 + 1.7) * 0.65 + vnoise(horiz * 9.0 + 3.3) * 0.35;
  float farR = vnoise(horiz * 2.1 + 6.2);
  float y = dir.y;
  float topNear = 0.055 + near * 0.2;
  float topFar = 0.04 + farR * 0.12;
  float nearBody = (1.0 - smoothstep(topNear - 0.045, topNear + 0.015, y)) * smoothstep(-0.15, 0.03, y);
  float farBody = (1.0 - smoothstep(topFar - 0.07, topFar + 0.02, y)) * smoothstep(-0.25, 0.02, y);
  vec3 shadow = vec3(0.26, 0.29, 0.36);
  float lit = smoothstep(-0.2, 0.7, dot(normalize(vec3(horiz, 0.15)), wfSunDir));
  col = mix(col, mix(shadow, col, 0.55), farBody * 0.5);
  col = mix(col, mix(shadow, col, 0.15), nearBody * 0.78);
  col += vec3(1.0, 0.96, 0.97) * nearBody * lit * 0.05;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`

const shaftFragment = /* glsl */ `
uniform float uTime;
uniform float uStrength;
uniform vec3 uSunColor;
varying vec3 vDir;
${WATER_GLSL}

${NOISE_GLSL}

void main() {
  vec3 dir = normalize(vDir);
  float g = dot(dir, wfSunDir);
  /* Angle around the sun axis, as a point on a circle (no wrap seam). */
  vec3 a = normalize(cross(wfSunDir, vec3(0.0, 1.0, 0.0)));
  vec3 b = cross(a, wfSunDir);
  vec2 around = normalize(vec2(dot(dir, a), dot(dir, b)) + 1e-5);
  vec2 drift = vec2(0.012, -0.008) * uTime;
  /* A slow veil decides where light gets through the water at all, so the
     fan is broken into patches instead of a regular set of stripes. */
  float veil = vnoise(around * 1.6 + drift * 0.35);
  veil = smoothstep(0.4, 0.72, veil);
  float rays = vnoise(around * 4.5 + drift) * 0.6 + vnoise(around * 11.0 - drift * 1.4 + 3.1) * 0.4;
  rays = smoothstep(0.32, 0.82, rays) * veil;
  float reach = pow(clamp(g * 0.5 + 0.5, 0.0, 1.0), 2.4);
  float above = mix(0.08, 1.0, smoothstep(-0.16, 0.2, dir.y));
  float core = 1.0 - smoothstep(0.985, 0.999, g) * 0.6;
  vec3 col = uSunColor * (rays * 0.22 + veil * reach * 0.03) * reach * above * core * uStrength;
  gl_FragColor = vec4(col, 1.0);
}
`

export default function WaterBackdrop({ lightShafts = 1 }) {
  const quad = useMemo(() => new THREE.PlaneGeometry(2, 2), [])
  const shared = useMemo(
    () => ({ uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() } }),
    [],
  )
  const backdrop = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'WorldFinalWaterBackdrop',
        vertexShader,
        fragmentShader: backdropFragment,
        uniforms: shared,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [shared],
  )
  const shafts = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'WorldFinalLightShafts',
        vertexShader,
        fragmentShader: shaftFragment,
        uniforms: {
          ...shared,
          uTime: { value: 0 },
          uStrength: { value: 1 },
          uSunColor: { value: new THREE.Color().setRGB(...WATER.sun, THREE.LinearSRGBColorSpace) },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [shared],
  )
  shafts.uniforms.uStrength.value = lightShafts
  useEffect(
    () => () => {
      quad.dispose()
      backdrop.dispose()
      shafts.dispose()
    },
    [quad, backdrop, shafts],
  )

  useFrame(({ camera, clock }) => {
    camera.updateMatrixWorld()
    shared.uInvProj.value.copy(camera.projectionMatrixInverse)
    shared.uCamWorld.value.copy(camera.matrixWorld)
    shafts.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <group name="world-final-water">
      <mesh geometry={quad} material={backdrop} renderOrder={BACKDROP_RENDER_ORDER} frustumCulled={false} />
      {lightShafts > 0 && (
        <mesh geometry={quad} material={shafts} renderOrder={SHAFTS_RENDER_ORDER} frustumCulled={false} />
      )}
    </group>
  )
}
