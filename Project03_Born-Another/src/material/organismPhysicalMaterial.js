import * as THREE from 'three'
import {
  developmentDisplacementGlsl,
  macroMorphologyGlsl,
  pathGrowthGlsl,
  pathGrowthUniformsGlsl,
  PATH_GROWTH_MAX,
} from '../surfaceShader.js'
import { INITIAL_ORGANISM_MATERIAL } from './materialParams.js'

function createDeformUniforms() {
  return {
    uTime: { value: 0 },
    uAge: { value: 0.5 },
    uSeed: { value: 1 },
    uNoiseScale: { value: 1 },
    uSpeed: { value: 0.32 },
    uPulseSpeed: { value: 1.1 },
    uDisplacement: { value: 0.22 },
    uNoiseAmount: { value: 1.55 },
    uDecayScale: { value: 1.25 },
    uDecayDisplacement: { value: 0.055 },
    uLateWarp: { value: 1 },
    uPathPointCount: { value: 0 },
    uPathPoints: {
      value: Array.from({ length: PATH_GROWTH_MAX }, () => new THREE.Vector3()),
    },
    uPathPointProgress: {
      value: Array.from({ length: PATH_GROWTH_MAX }, () => 0),
    },
    uPathGrowthStrength: { value: 0 },
    uPathGrowthRadius: { value: 0.32 },
    uApplyDeform: { value: 0 },
  }
}

const vertexPrelude = /* glsl */ `
  uniform float uTime;
  uniform float uAge;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uSpeed;
  uniform float uPulseSpeed;
  uniform float uDisplacement;
  uniform float uNoiseAmount;
  uniform float uDecayScale;
  uniform float uDecayDisplacement;
  uniform float uLateWarp;
  uniform float uApplyDeform;
  ${pathGrowthUniformsGlsl}
  ${developmentDisplacementGlsl}
  ${macroMorphologyGlsl}
  ${pathGrowthGlsl}
`

const deformNormal = /* glsl */ `
  vec3 organismDisplaced = position;
  vec3 objectNormal = normal;
  if (uApplyDeform > 0.5) {
    float lifeEnvelope = smoothstep(0.0, 0.1, uAge) * (1.0 - smoothstep(0.88, 1.0, uAge));
    float noiseGain = mix(0.85, 2.1, clamp(uNoiseAmount * 0.5, 0.0, 1.0));
    float warpBias = max(uLateWarp, 0.001);
    vec3 macroPos = macroMorphologyPosition(position);
    vec3 macroN = macroMorphologyNormal(position, normal);
    float breath = developmentDisplaceAmount(macroPos);
    float decayNoise = fbm(macroPos * uDecayScale + vec3(uSeed * 0.41, uSeed * 0.17, 2.3));
    float brittle = fbm(macroPos * uDecayScale * 2.8 + vec3(uSeed * 0.11, 5.2, 1.4));
    float warpField = mix(decayNoise, abs(brittle - 0.5) * 2.0, clamp(warpBias - 0.7, 0.0, 1.0));
    float instability = smoothstep(0.65, 1.0, uAge);
    float lateWarp = (warpField * 2.0 - 1.0) * uDecayDisplacement * instability * warpBias;
    organismDisplaced = macroPos + macroN * (breath + lateWarp);
    float slopeE = 0.05;
    vec3 slopeTangent = normalize(cross(macroN, abs(macroN.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 slopeBitangent = normalize(cross(macroN, slopeTangent));
    float dT = (formField(macroPos + slopeTangent * slopeE) - formField(macroPos - slopeTangent * slopeE)) * 0.5;
    float dB = (formField(macroPos + slopeBitangent * slopeE) - formField(macroPos - slopeBitangent * slopeE)) * 0.5;
    float slope = clamp(uDisplacement * lifeEnvelope * noiseGain + uDecayDisplacement * instability * warpBias, 0.0, 0.4);
    vec3 perturbed = normalize(macroN - (slopeTangent * dT + slopeBitangent * dB) * slope);
    objectNormal = normalize(mix(macroN, perturbed, 0.5));
    organismDisplaced = applyPathGrowth(position, organismDisplaced, objectNormal);
  }
`

function bindUniforms(shader, uniforms) {
  for (const [key, uniform] of Object.entries(uniforms)) {
    shader.uniforms[key] = uniform
  }
}

function compileOrganismPhysical(shader, uniforms) {
  bindUniforms(shader, uniforms)
  shader.vertexShader = vertexPrelude + shader.vertexShader
  shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', deformNormal)
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    'vec3 transformed = organismDisplaced;',
  )
}

/**
 * Physical glass for the MATERIAL tab. AGE displacement is injected into the
 * vertex shader. The fragment shader stays Three's MeshPhysicalMaterial.
 */
export const ORGANISM_PHYSICAL_REVISION = 'organism-physical-ab'

export function createOrganismPhysicalMaterial(params = INITIAL_ORGANISM_MATERIAL) {
  const deformUniforms = createDeformUniforms()

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: params.roughness,
    metalness: 0,
    ior: params.ior,
    transmission: params.shellTransmission,
    thickness: 1.8,
    attenuationColor: new THREE.Color(0xe4ecd9),
    attenuationDistance: 2.6,
    dispersion: 5,
    iridescence: 0.85,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [180, 820],
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    specularIntensity: 1,
    envMapIntensity: 1.25,
  })
  material.userData.deformUniforms = deformUniforms
  material.customProgramCacheKey = () => ORGANISM_PHYSICAL_REVISION
  material.onBeforeCompile = (shader) => compileOrganismPhysical(shader, deformUniforms)
  return material
}

export function syncOrganismDeformUniforms(material, { individuality, development, decay, age }) {
  const uniforms = material?.userData?.deformUniforms
  if (!uniforms) return
  uniforms.uSeed.value = individuality.seed
  uniforms.uNoiseScale.value = individuality.noiseScale
  uniforms.uAge.value = age
  uniforms.uSpeed.value = development.speed
  uniforms.uPulseSpeed.value = development.pulseSpeed
  uniforms.uDisplacement.value = development.displacement
  uniforms.uNoiseAmount.value = development.noiseAmount
  uniforms.uDecayScale.value = decay.decayScale
  uniforms.uDecayDisplacement.value = decay.decayDisplacement
  uniforms.uLateWarp.value = 1
}

const OPTICAL_PRESETS = {
  reflection: {
    color: 0x6e7480,
    roughness: 0.06,
    metalness: 0,
    ior: 1.5,
    transmission: 0,
    thickness: 0,
    attenuationColor: 0xffffff,
    attenuationDistance: Infinity,
    dispersion: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 400],
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    specularIntensity: 1,
    envMapIntensity: 1.25,
  },
  clear: {
    color: 0xffffff,
    roughness: 0.06,
    metalness: 0,
    ior: 1.62,
    transmission: 1,
    thickness: 1.8,
    attenuationColor: 0xffffff,
    attenuationDistance: Infinity,
    dispersion: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 400],
    clearcoat: 0,
    clearcoatRoughness: 0.04,
    specularIntensity: 1,
    envMapIntensity: 1.25,
  },
  claude: {
    color: 0xffffff,
    roughness: 0.06,
    metalness: 0,
    ior: 1.62,
    transmission: 1,
    thickness: 1.8,
    attenuationColor: 0xe4ecd9,
    attenuationDistance: 2.6,
    dispersion: 5,
    iridescence: 0.85,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [180, 820],
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    specularIntensity: 1,
    envMapIntensity: 1.25,
  },
}

function applyOpticalPreset(material, preset) {
  material.color.set(preset.color)
  material.roughness = preset.roughness
  material.metalness = preset.metalness
  material.ior = preset.ior
  material.transmission = preset.transmission
  material.thickness = preset.thickness
  material.attenuationColor.set(preset.attenuationColor)
  material.attenuationDistance = preset.attenuationDistance
  material.dispersion = preset.dispersion
  material.iridescence = preset.iridescence
  material.iridescenceIOR = preset.iridescenceIOR
  material.iridescenceThicknessRange = [...preset.iridescenceThicknessRange]
  material.clearcoat = preset.clearcoat
  material.clearcoatRoughness = preset.clearcoatRoughness
  material.specularIntensity = preset.specularIntensity
  material.envMapIntensity = preset.envMapIntensity
}

export function syncOrganismPhysicalMaterial(material, params) {
  if (!material?.isMeshPhysicalMaterial || !params) return
  const preset = OPTICAL_PRESETS[params.optical] ?? OPTICAL_PRESETS.reflection
  applyOpticalPreset(material, preset)
  const uniforms = material.userData.deformUniforms
  if (uniforms?.uApplyDeform) {
    uniforms.uApplyDeform.value = params.diagnostic === 'organism' ? 1 : 0
  }
}
