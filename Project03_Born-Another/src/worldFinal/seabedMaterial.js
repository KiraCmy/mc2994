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
 * the deep floor. M3C adds wind ripples, drifting caustic filaments, a satin
 * sheen on lit shoulders, sun-backlit dune edges and sparse glitter; M3D a
 * glassy thin-film glaze that mirrors the water with a soft rainbow shift.
 *
 * Haze tints toward the water color in the view direction (waterVolume.js),
 * then fades to alpha over the identical WaterBackdrop (no seam). Terrain
 * itself is opaque in look.
 */
import * as THREE from 'three'
import { atmosphereParams, FILL_DIRECTION, KEY_DIRECTION } from './atmosphere.js'
import { edgeFadeRadii } from './terrainFade.js'
import { WATER_GLSL } from './waterVolume.js'

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
uniform vec4 uOrganism;
uniform float uOrganismShade;
uniform float uCaustics;
uniform float uSparkle;
uniform float uIridescence;

${WATER_GLSL}

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

/* Caustic web: two drifting ridged-noise layers; their product leaves thin
   bright filaments. Fades to its mean once the filaments go sub-pixel. */
float caustics(vec2 p, float t, float footprint) {
  const float WAVELENGTH = 7.0;
  vec2 q = p / WAVELENGTH;
  float a = 1.0 - abs(noised(q + vec2(0.11, 0.07) * t).x);
  float b = 1.0 - abs(noised(ROT * q * 1.37 - vec2(0.08, -0.12) * t + 5.2).x);
  return mix(0.09, pow(a * b, 7.0), octaveFade(footprint, WAVELENGTH * 0.5));
}

/* Sparse glitter: one possible flake per cell, lit only when its random
   facet turns toward the half vector. Fades before it can alias. */
float glitter(vec2 p, vec3 H, float cellSize, float footprint) {
  vec2 cell = floor(p / cellSize);
  vec2 f = fract(p / cellSize) - 0.5;
  vec2 jitter = vec2(hash12(cell + 1.7), hash12(cell + 9.2)) - 0.5;
  float flake = step(0.88, hash12(cell));
  vec3 facet = normalize(vec3(hash12(cell + 7.1) - 0.5, 0.55, hash12(cell + 3.3) - 0.5));
  float dotMask = 1.0 - smoothstep(0.06, 0.2, length(f - jitter * 0.5));
  return flake * dotMask * pow(max(dot(facet, H), 0.0), 70.0)
    * octaveFade(footprint, cellSize * 0.6);
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
  /* Wind ripples: long, softly meandering lines that catch the key light. */
  const float RIPPLE = 2.4;
  vec2 rippleDir = vec2(0.8, 0.6);
  float rippleWarp = noised(p / 9.0 + 2.0).x * 3.2 + noised(ROT * p / 3.7 - 6.0).x * 1.1;
  float ripplePhase = dot(p, rippleDir) * (6.2832 / RIPPLE) + rippleWarp;
  float ripplePatch = smoothstep(-0.4, 0.6, noised(ROT * p / 21.0 + 9.0).x);
  vec2 rippleSlope = rippleDir * cos(ripplePhase) * 0.12 * (0.25 + 0.75 * ripplePatch)
    * octaveFade(footprint, RIPPLE);
  N = normalize(N - vec3(rippleSlope.x, 0.0, rippleSlope.y) * uGrain);
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
    noised(p / 220.0 + drift).x * 0.4 +
    noised(ROT * p / 80.0 - drift * 1.4 + 4.1).x * 0.38 +
    noised(p / 36.0 + drift * 2.2 + 9.0).x * 0.22
  );
  /* Light that has passed through moving water: the bright patches run warm,
     the gaps run cool, and a patch fits inside one view instead of one wash. */
  float filtered = mix(1.0, mix(0.55, 1.5, pools), uFiltering);
  float deepFloor = 1.0 - smoothstep(0.0, 0.85, basin);
  float depthAtten = 1.0 - deepFloor * 0.12 * uFiltering;
  vec3 keyColor = mix(uKeyColor, uFillColor, deepFloor * 0.22 * uFiltering);
  keyColor = mix(keyColor, mix(uFillColor, uKeyColor * vec3(1.08, 0.97, 0.92), pools), 0.45 * uFiltering);

  /* Macro shape is lit by the mesh normal so basin and ridges keep their
     definition; the fine relief only modulates it around that value. */
  float keyWrap = clamp((dot(Ng, uKeyDir) + 0.1) / 1.1, 0.0, 1.0);
  keyWrap = keyWrap * keyWrap * (3.0 - 2.0 * keyWrap);
  keyWrap = clamp(keyWrap + (dot(N, uKeyDir) - dot(Ng, uKeyDir)) * 0.55, 0.0, 1.0);
  float fillWrap = clamp((dot(N, uFillDir) + 0.5) / 1.5, 0.0, 1.0);
  vec3 hemi = mix(uGround, uSky, Ng.y * 0.5 + 0.5);
  float cavity = mix(1.0, 0.8, trough) * (1.0 - hollow * 0.12);

  /* Organism presence (M3B): a soft key shadow along the light, widening
     with distance, plus contact darkening of the ambient right beneath. */
  vec3 toBody = uOrganism.xyz - vWorldPos;
  float bodyR = max(uOrganism.w, 1e-3);
  float along = dot(toBody, uKeyDir);
  float offRay = length(toBody - uKeyDir * along);
  float penumbra = bodyR * (1.2 + max(along, 0.0) * 0.035);
  float bodyShadow = step(0.0, along) * (1.0 - smoothstep(bodyR * 0.25, penumbra, offRay));
  float gap = max(toBody.y - bodyR, 0.0);
  float bodyContact = (1.0 - smoothstep(bodyR * 0.4, bodyR * 2.4 + gap * 0.6, length(toBody.xz)))
    * exp(-gap / (bodyR * 3.0));
  keyWrap *= 1.0 - bodyShadow * 0.38 * uOrganismShade;
  cavity *= 1.0 - bodyContact * 0.16 * uOrganismShade;

  vec3 light = hemi * 0.5 * cavity
    + keyColor * keyWrap * 1.2 * uLight * filtered * depthAtten
    + uFillColor * fillWrap * 0.32 * uLight;
  light *= mix(0.88, 1.08, crest);
  vec3 col = albedo * light;

  /* Caustic filaments on sunlit sediment, dimmer on the deep floor. */
  float caustic = caustics(p, uTime, footprint) * keyWrap * filtered * (1.0 - deepFloor * 0.4);
  col += albedo * keyColor * caustic * 1.2 * uCaustics * uLight;

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
  /* Satin sheen along lit dune shoulders (macro normal: broad, silky). */
  vec3 Hg = normalize(uKeyDir + V);
  float sheen = pow(max(dot(Ng, Hg), 0.0), 14.0) * (0.35 + 0.65 * crest);
  col += uKeyColor * sheen * 0.16 * uLight * filtered;
  /* Dune edges glow when seen against the sun (forward scatter in silt). */
  float towardSun = pow(max(dot(-V, wfSunDir), 0.0), 2.0);
  col += wfWater(wfSunDir) * grazing * towardSun * 0.3 * uLight;
  /* Glassy iridescent glaze (M3D): sediment wears a thin film that mirrors
     the bright water at grazing angles, its tint drifting through a soft
     rainbow across dune patches; strongest on shoulders and crests. */
  float glazeFres = pow(1.0 - max(dot(N, V), 0.0), 3.5);
  float glazeMask = mix(0.4, 1.0, crest) * (0.55 + 0.45 * ripplePatch) * uIridescence;
  /* Bands follow the dune relief (ridge cue + fine relief), not broad patches. */
  float filmPhase = glazeFres * 1.1 + vTerrain.y * 1.6 + relief.x * 1.4 + patchBroad * 0.3 + uTime * 0.006;
  vec3 film = mix(vec3(1.0), 0.5 + 0.5 * cos(6.2832 * (filmPhase + vec3(0.0, 0.33, 0.67))), 0.6);
  col += wfWater(reflect(-V, N)) * film * glazeFres * 0.32 * glazeMask;
  float glazeSpec = pow(max(dot(N, H), 0.0), 56.0) * keyWrap * filtered;
  col += uKeyColor * film * glazeSpec * 0.45 * glazeMask * uLight;
  /* Glitter: fine flakes up close, a sparser coarse layer further out. */
  float sparkle = glitter(p, H, 0.45, footprint) + glitter(ROT * p + 31.0, H, 1.7, footprint) * 0.8;
  col += vec3(1.0, 0.95, 1.0) * sparkle * keyWrap * uSparkle * uLight * 1.1;

  /* Middle ground: at a few hundred units the mesh-normal shading of ridges
     gets too subtle, so crests and troughs get a gentle tonal accent there. */
  float midBand = smoothstep(60.0, 220.0, vViewDepth) * (1.0 - smoothstep(520.0, 900.0, vViewDepth));
  col *= 1.0 + midBand * (crest * 0.08 - trough * 0.09);
  /* Foreground (M3B): near sediment sits a little deeper and shows more of
     the key relief, so value — not only haze — separates near from far. */
  float nearField = 1.0 - smoothstep(15.0, 240.0, vViewDepth);
  col *= mix(1.0, 0.9 + 0.22 * keyWrap * filtered, nearField);

  /* Highlights roll off a little above the horizon water: bright, never clipped. */
  vec3 ceiling = uHaze * 1.2;
  col = col / (1.0 + max(col - ceiling, vec3(0.0)) * 1.5);

  /* --- Atmosphere ------------------------------------------------------ */
  float valley = uHazeOn * uValleyHaze * (1.0 - smoothstep(0.0, 0.55, basin))
    * smoothstep(60.0, 420.0, vViewDepth);
  col = mix(col, uValley, valley * 0.45);

  float d = max(vViewDepth - uHazeStart - uHazeOffset, 0.0);
  float k = uHazeDensity * d;
  float haze = uHazeOn * (1.0 - exp(-(0.6 * k + k * k)));
  /* Same direction → color as the backdrop, so terrain melts into it. */
  col = mix(col, wfWater(-V), haze * 0.88);
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
    /** Organism centre (xyz) + membrane radius (w), written per frame. */
    uOrganism: { value: new THREE.Vector4(0, -1e5, 0, 1) },
    uOrganismShade: { value: 0 },
    uCaustics: { value: 1 },
    uSparkle: { value: 1 },
    uIridescence: { value: 1 },
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
  u.uCaustics.value = config.caustics
  u.uSparkle.value = config.sedimentSparkle
  u.uIridescence.value = config.basinIridescence
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
