/**
 * World Final — shaded seabed material (M2A lighting, M2B sediment).
 *
 * Sediment: world-space procedural relief perturbs the normal (fine grain the
 * mesh can't hold), while slope / height / low-frequency patch fields vary
 * the pearl-gray ↔ lavender albedo and the roughness. Every noise octave fades
 * by pixel footprint, so detail is crisp up close, still present in
 * Overview, and never shimmers or tiles.
 *
 * Light: soft key / fill / hemisphere; the key is filtered through the
 * water — slow, very low-frequency light pools and dimmer, cooler light on
 * the deep floor. No caustics, rays, or volumetrics.
 *
 * Haze tints toward the Exp04 horizon color, then fades to alpha so the
 * page background takes over (no seam). Terrain itself is opaque in look.
 */
import * as THREE from 'three'
import { atmosphereParams, FILL_DIRECTION, KEY_DIRECTION } from './atmosphere.js'
import { edgeFadeRadii } from './terrainFade.js'

const vertexShader = /* glsl */ `
attribute vec2 aTerrain;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vViewDepth;
varying vec2 vTerrain;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vTerrain = aTerrain;
  vec4 mvPosition = viewMatrix * worldPos;
  vViewDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}
`

const fragmentShader = /* glsl */ `
uniform vec3 uPearl;
uniform vec3 uLavender;
uniform vec3 uDeep;
uniform vec3 uBank;
uniform vec3 uHigh;
uniform vec3 uCrest;
uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
uniform vec3 uFillDir;
uniform vec3 uFillColor;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uHaze;
uniform vec3 uValley;
uniform vec3 uGlintCool;
uniform vec3 uGlintWarm;
uniform float uLight;
uniform float uGrain;
uniform float uFiltering;
uniform float uTime;
uniform float uHazeOn;
uniform float uHazeDensity;
uniform float uHazeStart;
uniform float uHazeOffset;
uniform float uValleyHaze;
uniform vec2 uEdgeFade;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vViewDepth;
varying vec2 vTerrain;

const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/* Value noise with analytic gradient: (value in [-1, 1], d/dx, d/dy). */
vec3 noised(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  float k1 = b - a;
  float k2 = c - a;
  float k4 = a - b - c + d;
  float v = a + k1 * u.x + k2 * u.y + k4 * u.x * u.y;
  return vec3(v * 2.0 - 1.0, du * vec2(k1 + k4 * u.y, k2 + k4 * u.x) * 2.0);
}

/* Fades an octave out once a pixel covers ~half its wavelength. */
float octaveFade(float footprint, float wavelength) {
  return 1.0 - smoothstep(0.2, 0.5, footprint / wavelength);
}

/*
 * Fine sediment relief in world units: x = height, yz = d/dx, d/dz.
 * Rotated, non-integer lacunarity octaves avoid visible repetition.
 */
vec3 sedimentRelief(vec2 p, float footprint) {
  vec3 acc = vec3(0.0);
  mat2 m = mat2(1.0);
  float wavelength = 9.0;
  float amp = 0.34;
  for (int i = 0; i < 4; i++) {
    float freq = 1.0 / wavelength;
    vec3 n = noised(m * p * freq + float(i) * 17.31);
    float w = amp * octaveFade(footprint, wavelength);
    acc.x += n.x * w;
    acc.yz += (transpose(m) * n.yz) * freq * w;
    m = ROT * m;
    wavelength /= 2.13;
    amp *= 0.45;
  }
  return acc;
}

void main() {
  vec2 p = vWorldPos.xz;
  float footprint = max(length(fwidth(p)), 1e-3);
  vec3 Ng = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float basin = vTerrain.x;
  float crest = smoothstep(0.05, 0.6, vTerrain.y);
  float trough = 1.0 - smoothstep(-0.6, -0.05, vTerrain.y);
  float slope = 1.0 - clamp(Ng.y, 0.0, 1.0);

  /* --- Material fields ------------------------------------------------- */
  vec3 relief = sedimentRelief(p, footprint);
  vec3 N = normalize(Ng - vec3(relief.y, 0.0, relief.z) * uGrain);
  float hollow = clamp(-relief.x * 1.6, 0.0, 1.0) * uGrain;

  float patchBroad = noised(p / 150.0 + 3.7).x * 0.65 + noised(ROT * p / 71.0 - 8.2).x * 0.35;
  float patchFine = noised(ROT * ROT * p / 23.0 + 11.1).x * octaveFade(footprint, 23.0);
  float grain = noised(p / 1.1 + 5.3).x * octaveFade(footprint, 1.1);

  /* Albedo: pearl-gray ↔ lavender patches; steep banks expose a mauve
     layer; the deep floor and troughs hold cooler, denser silt; the rim
     highlands are paler and faintly warm; ridge crests are bleached. */
  vec3 albedo = mix(uPearl, uLavender, smoothstep(-0.55, 0.55, patchBroad + patchFine * 0.25));
  albedo = mix(albedo, uBank, smoothstep(0.08, 0.36, slope) * 0.6);
  albedo = mix(albedo, uDeep, (1.0 - smoothstep(0.0, 0.45, basin)) * 0.25 + trough * 0.3);
  albedo = mix(albedo, uHigh, smoothstep(0.7, 1.15, basin) * 0.5);
  albedo = mix(albedo, uCrest, crest * 0.3);
  albedo *= 1.0 + (grain * 0.05 + patchFine * 0.035) * uGrain;
  albedo *= 1.0 - hollow * 0.07;

  /* Roughness: compacted crests are a little smoother, troughs dusty. */
  float rough = clamp(
    0.8 + trough * 0.1 - crest * 0.14 + patchFine * 0.07 + grain * 0.05,
    0.55,
    0.98
  );

  /* --- Light through a dense medium ------------------------------------ */
  vec2 drift = vec2(0.009, 0.006) * uTime;
  float pools = 0.5 + 0.5 * (
    noised(p / 260.0 + drift).x * 0.6 +
    noised(ROT * p / 170.0 - drift * 1.4 + 4.1).x * 0.4
  );
  float filtered = mix(1.0, mix(0.84, 1.12, pools), uFiltering);
  float deepFloor = 1.0 - smoothstep(0.0, 0.85, basin);
  float depthAtten = 1.0 - deepFloor * 0.1 * uFiltering;
  vec3 keyColor = mix(uKeyColor, uFillColor, deepFloor * 0.22 * uFiltering);

  /* Macro shape is lit by the mesh normal so basin and ridges keep their
     definition; the fine relief only modulates it around that value. */
  float keyWrap = clamp((dot(Ng, uKeyDir) + 0.22) / 1.22, 0.0, 1.0);
  keyWrap = keyWrap * keyWrap * (3.0 - 2.0 * keyWrap);
  keyWrap = clamp(keyWrap + (dot(N, uKeyDir) - dot(Ng, uKeyDir)) * 0.55, 0.0, 1.0);
  float fillWrap = clamp((dot(N, uFillDir) + 0.5) / 1.5, 0.0, 1.0);
  vec3 hemi = mix(uGround, uSky, Ng.y * 0.5 + 0.5);
  float cavity = mix(1.0, 0.8, trough) * (1.0 - hollow * 0.12);

  vec3 light = hemi * 0.5 * cavity
    + keyColor * keyWrap * 0.96 * uLight * filtered * depthAtten
    + uFillColor * fillWrap * 0.2 * uLight;
  light *= mix(0.9, 1.06, crest);
  vec3 col = albedo * light;

  /* Broad, low sediment glint tinted cool / warm by patch — no mirror spec. */
  vec3 H = normalize(uKeyDir + V);
  float NdotH = max(dot(N, H), 0.0);
  float glint = pow(NdotH, mix(40.0, 8.0, rough)) * (1.0 - rough) * 0.3;
  glint *= uLight * keyWrap * filtered;
  col += mix(uGlintCool, uGlintWarm, smoothstep(-0.5, 0.5, patchBroad)) * glint;
  /* Fine-silt backscatter at grazing angles: a dusty lift from the macro
     normal (keeps distant slopes separating from the shaded middle
     ground), tinted by the water, not a pearl film. */
  float grazing = pow(1.0 - max(dot(Ng, V), 0.0), 3.0);
  col += mix(uSky, mix(uGlintCool, uGlintWarm, 0.5), 0.25) * grazing * 0.08 * (0.4 + 0.6 * uLight);

  /* Middle ground: at a few hundred units the mesh-normal shading of ridges
     gets too subtle, so crests and troughs get a gentle tonal accent there. */
  float midBand = smoothstep(60.0, 220.0, vViewDepth) * (1.0 - smoothstep(520.0, 900.0, vViewDepth));
  col *= 1.0 + midBand * (crest * 0.08 - trough * 0.09);

  /* Highlights roll off just under the atmosphere: never overexposed. */
  vec3 ceiling = uHaze;
  col = col / (1.0 + max(col - ceiling, vec3(0.0)) * 1.5);

  /* --- Atmosphere ------------------------------------------------------ */
  float valley = uHazeOn * uValleyHaze * (1.0 - smoothstep(0.0, 0.55, basin))
    * smoothstep(60.0, 420.0, vViewDepth);
  col = mix(col, uValley, valley * 0.45);

  float d = max(vViewDepth - uHazeStart - uHazeOffset, 0.0);
  float k = uHazeDensity * d;
  float haze = uHazeOn * (1.0 - exp(-(0.6 * k + k * k)));
  col = mix(col, uHaze, haze * 0.88);
  float alpha = 1.0 - smoothstep(0.42, 0.98, haze);
  alpha *= 1.0 - smoothstep(uEdgeFade.x, uEdgeFade.y, length(vWorldPos.xz));

  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`

const COLOR_UNIFORMS = {
  uPearl: 'pearl',
  uLavender: 'lavender',
  uDeep: 'deep',
  uBank: 'bank',
  uHigh: 'high',
  uCrest: 'crest',
  uKeyColor: 'key',
  uFillColor: 'fill',
  uSky: 'sky',
  uGround: 'ground',
  uHaze: 'haze',
  uValley: 'valley',
  uGlintCool: 'glintCool',
  uGlintWarm: 'glintWarm',
}

export function createSeabedMaterial() {
  const uniforms = {
    uKeyDir: { value: KEY_DIRECTION.clone() },
    uFillDir: { value: FILL_DIRECTION.clone() },
    uLight: { value: 1 },
    uGrain: { value: 1 },
    uFiltering: { value: 0 },
    uTime: { value: 0 },
    uHazeOn: { value: 1 },
    uHazeDensity: { value: 0 },
    uHazeStart: { value: 0 },
    uHazeOffset: { value: 0 },
    uValleyHaze: { value: 0 },
    uEdgeFade: { value: new THREE.Vector2() },
  }
  for (const name of Object.keys(COLOR_UNIFORMS)) {
    uniforms[name] = { value: new THREE.Color() }
  }
  return new THREE.ShaderMaterial({
    name: 'WorldFinalSeabed',
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    side: THREE.FrontSide,
    toneMapped: false,
  })
}

/** Copies config-derived atmosphere into the material (cheap; no recompile). */
export function updateSeabedMaterial(material, config, { hazeEnabled = true } = {}) {
  const p = atmosphereParams(config)
  const u = material.uniforms
  for (const [name, key] of Object.entries(COLOR_UNIFORMS)) {
    u[name].value.copy(p[key])
  }
  u.uLight.value = p.lightIntensity
  u.uGrain.value = p.sedimentGrain
  u.uFiltering.value = p.lightFiltering
  u.uHazeOn.value = hazeEnabled ? 1 : 0
  u.uHazeDensity.value = p.hazeDensity
  u.uHazeStart.value = p.hazeStart
  u.uValleyHaze.value = p.valleyHaze
  u.uEdgeFade.value.set(...edgeFadeRadii(config.basinRadius))
}

/**
 * Haze is measured from the camera, so lifting far above the basin (Overview,
 * or a long rise on E) would bury it; push haze back by the height above the
 * rim so the basin stays readable from altitude.
 */
export function hazeOffsetForCamera(cameraY, config) {
  return Math.max(0, cameraY - config.basinDepth) * 1.3
}
