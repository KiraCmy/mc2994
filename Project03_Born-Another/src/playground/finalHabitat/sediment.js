import * as THREE from 'three'

/** Sand the remains turn into. */
export const SEDIMENT_SAND = new THREE.Color('#8c839d')

/*
 * Sediment: the remains merge into the seabed. A sand line rises up the body
 * (ragged with noise), up-facing surfaces gather sediment first, and covered
 * parts take the sand's colour, grain and roughness — the form stays legible
 * as relief, like a fossil weathering out of the floor.
 */
export function patchSediment(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSedPos;\nvarying float vSedUp;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 sedWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          sedWp = instanceMatrix * sedWp;
        #endif
        vSedPos = (modelMatrix * sedWp).xyz;
        vSedUp = normalize(mat3(modelMatrix) * objectNormal).y;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSedPos;
        varying float vSedUp;
        uniform float uBury;
        uniform float uGround;
        uniform float uHeight;
        uniform vec3 uSand;
        float sedHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float sedNoise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(sedHash(i), sedHash(i + vec3(1, 0, 0)), f.x), mix(sedHash(i + vec3(0, 1, 0)), sedHash(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(sedHash(i + vec3(0, 0, 1)), sedHash(i + vec3(1, 0, 1)), f.x), mix(sedHash(i + vec3(0, 1, 1)), sedHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float sedN = sedNoise(vSedPos * 2.6) * 0.65 + sedNoise(vSedPos * 9.0) * 0.35;
        float sedH = vSedPos.y - uGround;
        float sedLine = uBury * uHeight * 1.05 + (sedN - 0.5) * 0.45 * uHeight;
        float sedCover = 1.0 - smoothstep(sedLine - 0.12 * uHeight, sedLine + 0.08 * uHeight, sedH);
        sedCover = max(sedCover, smoothstep(0.55, 0.95, vSedUp) * smoothstep(0.1, 0.9, uBury) * smoothstep(0.35, 0.65, sedN));
        sedCover *= smoothstep(0.0, 0.08, uBury);
        float sedGrain = 0.88 + 0.24 * sedNoise(vSedPos * 40.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, uSand * sedGrain, sedCover);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.85, sedCover);`,
      )
  }
  material.customProgramCacheKey = () => `exp07-sediment-${material.type}`
}

export function sedimentUniforms(ground, height) {
  return {
    uBury: { value: 0 },
    uGround: { value: ground },
    uHeight: { value: Math.max(0.2, height) },
    uSand: { value: SEDIMENT_SAND.clone() },
  }
}

