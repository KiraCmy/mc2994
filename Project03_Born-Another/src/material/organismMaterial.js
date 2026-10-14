import * as THREE from 'three'
import { getOrganismEnvMaps } from './organismEnvironment.js'
import { INITIAL_ORGANISM_MATERIAL } from './materialParams.js'

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)))
}

/**
 * Uniforms read by `organismMaterialFragmentShader`. Body colours (uColorA,
 * uColorB, uRimColor, uLow, uHigh) come from the shared body uniforms.
 */
export function createOrganismMaterialUniforms(params = INITIAL_ORGANISM_MATERIAL) {
  const envMaps = getOrganismEnvMaps()
  return {
    uCoreOpacity: { value: params.coreOpacity },
    uShellTransmission: { value: params.shellTransmission },
    uRoughness: { value: params.roughness },
    uIor: { value: params.ior },
    uShowMaterialMask: { value: params.showMask ? 1 : 0 },
    uEnvSharp: { value: envMaps.sharp },
    uEnvSoft: { value: envMaps.soft },
    uKeyLightDir: { value: new THREE.Vector3(0.75, 0.6, 0.25).normalize() },
    uFillLightDir: { value: new THREE.Vector3(-0.45, 0.35, 0.8).normalize() },
  }
}

export function syncOrganismMaterialUniforms(material, params) {
  const uniforms = material?.uniforms
  if (!uniforms?.uCoreOpacity || !params) return
  uniforms.uCoreOpacity.value = clamp(params.coreOpacity, 0, 1)
  uniforms.uShellTransmission.value = clamp(params.shellTransmission, 0, 1)
  uniforms.uRoughness.value = clamp(params.roughness, 0.02, 1)
  uniforms.uIor.value = clamp(params.ior, 1, 2.4)
  if (uniforms.uShowMaterialMask) {
    uniforms.uShowMaterialMask.value = params.showMask ? 1 : 0
  }
}
