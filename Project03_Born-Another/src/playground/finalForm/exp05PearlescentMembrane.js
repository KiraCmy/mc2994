/**
 * Exp05-only Pearlescent Membrane body material study.
 *
 * Custom ShaderMaterial — same Explore vertex contract (CPU-owned silhouette).
 * Soft glossy sculptural pastels on the existing light gray-blue page backdrop.
 * No MeshPhysical / bloom / World post stack. Does not change clear color.
 */
import * as THREE from 'three'
import { noiseFunctions } from '../../surfaceShader.js'

/** Same pass-through vertex as ExploreWorldBody — morph stays on CPU. */
export const pearlescentMembraneVertexShader = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vPosition = position;
    vViewPosition = viewPosition.xyz;
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewPosition;
  }
`

/**
 * Glossy translucent membrane — opaque enough to read on a light backdrop,
 * with orientation-driven pastel iridescence and sculptural speculars.
 */
export const pearlescentMembraneFragmentShader = /* glsl */ `
  uniform float uSeed;
  uniform float uTime;
  uniform float uAge;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform float uBodyAlpha;
  uniform float uEdgeAlpha;
  uniform float uFresnelPower;
  uniform float uIridescence;
  uniform float uThicknessContrast;
  uniform float uSoftLight;
  uniform float uGloss;
  uniform float uInteriorDepth;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 worldNormal = normalize(vWorldNormal);
    if (!gl_FrontFacing) {
      normal = -normal;
      worldNormal = -worldNormal;
    }

    vec3 viewDirection = normalize(-vViewPosition);
    float NdotV = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - NdotV, max(uFresnelPower, 0.7));
    float softFresnel = pow(1.0 - NdotV, max(uFresnelPower * 0.5, 0.45));

    float curvature = clamp(length(fwidth(worldNormal)) * 16.0, 0.0, 1.0);

    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);
    float ageScale = mix(0.9, 1.15, clamp(uAge, 0.0, 1.0));
    vec3 samplePos =
      vPosition * uNoiseScale * 0.7 * ageScale +
      seedOffset +
      vec3(0.0, uTime * uSpeed * 0.06, 0.0);

    float thickNoise = fbm(samplePos * 1.08);
    float veil = fbm(samplePos * 2.2 + vec3(1.7, 0.4, 2.1));
    float filament = fbm(samplePos * 3.5 + vec3(uSeed * 0.05, 2.8, 0.9));
    float valleyNoise = fbm(samplePos * 1.6 + vec3(4.2, 0.8, 1.1));

    /* Dense membrane body — soft translucency without smoke. */
    float thickness = mix(0.42, 1.0, smoothstep(0.2, 0.78, thickNoise));
    thickness = mix(thickness, veil, 0.14);
    thickness = mix(thickness, mix(thickness, 0.95, curvature), 0.2);

    /* Recess contrast via color/sat — not muddy darkening. */
    float recess =
      (1.0 - NdotV) * 0.28 +
      (1.0 - valleyNoise) * 0.42 +
      curvature * 0.3;
    recess = clamp(recess * clamp(uInteriorDepth, 0.0, 1.35), 0.0, 1.0);

    vec3 keyDir = normalize(vec3(-0.15, 0.58, 0.82));
    vec3 fillDir = normalize(vec3(0.68, 0.22, -0.22));
    vec3 rimDir = normalize(vec3(-0.5, 0.3, -0.7));
    float wrap = dot(worldNormal, keyDir) * 0.5 + 0.5;
    float keyLit = max(dot(worldNormal, keyDir), 0.0);
    float fillLit = max(dot(worldNormal, fillDir), 0.0);
    float rimLit = max(dot(worldNormal, rimDir), 0.0);

    float ambient = 0.54;
    float diffuse =
      ambient +
      mix(0.16, 0.42, wrap) * uSoftLight +
      keyLit * 0.28 +
      fillLit * 0.12 * uSoftLight +
      rimLit * 0.07;
    /* Soft sculptural dip in valleys — stay luminous. */
    diffuse *= mix(1.0, 0.62, recess * 0.85);
    diffuse *= mix(0.86, 1.06, thickness * clamp(uThicknessContrast, 0.0, 1.0));

    /* Dual specular — local variation from curvature / veil (less uniform soft). */
    vec3 halfKey = normalize(keyDir + viewDirection);
    float NdotH = max(dot(normal, halfKey), 0.0);
    float glossAmt = clamp(uGloss, 0.0, 1.0);
    float glossMask = mix(0.55, 1.15, curvature) * mix(0.85, 1.12, veil);
    float broadSpec = pow(NdotH, 6.2) * 0.26 * glossMask;
    float sharpSpec =
      pow(NdotH, mix(30.0, 58.0, glossAmt)) *
      (0.14 + 0.28 * glossAmt) *
      mix(0.7, 1.25, curvature);
    float softSheen = pow(max(0.0, 1.0 - NdotV), 1.7) * 0.09 * wrap;
    float foldSpec = pow(NdotH, 24.0) * curvature * 0.34;
    float specular =
      (broadSpec + sharpSpec + softSheen + foldSpec) * mix(1.0, 0.42, recess);

    /* Orientation + lighting iridescence. */
    float hueA = worldNormal.x * 0.6 + worldNormal.y * 0.22;
    float hueB = worldNormal.z * 0.7 - worldNormal.x * 0.18;
    float film =
      sin((1.0 - NdotV) * 8.2 + hueA * 3.8 + veil * 1.5) * 0.5 + 0.5;
    float litHue = smoothstep(0.18, 0.88, wrap);
    float iriAmt = clamp(uIridescence, 0.0, 1.4);

    /* Bright pastel palette — readable on light gray-blue. */
    vec3 pink = vec3(0.95, 0.62, 0.74);
    vec3 cyan = vec3(0.42, 0.86, 0.92);
    vec3 lavender = vec3(0.72, 0.64, 0.92);
    vec3 peach = vec3(0.98, 0.76, 0.58);
    vec3 pearlBase = vec3(0.88, 0.86, 0.9);
    vec3 recessTint = vec3(0.62, 0.52, 0.72);
    vec3 recessCool = vec3(0.48, 0.62, 0.72);

    vec3 pearl = mix(lavender, cyan, smoothstep(-0.5, 0.55, hueA));
    pearl = mix(pearl, pink, smoothstep(-0.35, 0.55, hueB));
    pearl = mix(pearl, peach, litHue * 0.62);
    pearl = mix(pearl, cyan, film * 0.48 * iriAmt);
    pearl = mix(pearl, pink, (1.0 - film) * softFresnel * 0.4);

    vec3 bodyColor = mix(pearlBase, pearl, 0.68 + iriAmt * 0.4);
    bodyColor = mix(bodyColor, peach, litHue * 0.22 * iriAmt);
    bodyColor = mix(bodyColor, pink, (1.0 - litHue) * 0.22 * iriAmt);
    /* Recess: denser pastel + slight thickness cue — not gray smoke. */
    bodyColor = mix(bodyColor, recessTint, recess * 0.48);
    bodyColor = mix(bodyColor, recessCool, recess * (1.0 - litHue) * 0.26);
    bodyColor = mix(bodyColor, cyan, curvature * 0.26 * iriAmt);
    bodyColor *= mix(1.0, mix(0.9, 1.04, thickness), 0.35);

    float wisps =
      smoothstep(0.5, 0.8, filament) *
      (0.2 + 0.5 * NdotV) *
      (0.35 + curvature * 0.9);
    vec3 wispTint = mix(cyan, pink, film);
    bodyColor = mix(bodyColor, wispTint, wisps * 0.55 * iriAmt);

    /* Subtle tinted edge — avoid white Fresnel wash. */
    vec3 rim = mix(lavender, cyan, 0.4);
    rim = mix(rim, pink, 0.4);
    rim = mix(rim, peach, litHue * 0.3);

    vec3 lit = bodyColor * diffuse;
    lit += rim * fresnel * (0.1 + iriAmt * 0.08) * mix(1.0, 0.65, recess);
    /* Specular inherits pearl tint — avoids large white wash patches. */
    lit += mix(bodyColor, wispTint, 0.35) * specular * 0.85;
    lit += wispTint * wisps * 0.14;

    lit = max(lit, vec3(0.0));
    float luma = dot(lit, vec3(0.299, 0.587, 0.114));
    lit = mix(vec3(luma), lit, 1.22);
    /* Soft highlight compression — keep gloss without blowout. */
    lit = lit / (1.0 + max(lit - vec3(0.82), vec3(0.0)) * 0.55);
    lit = min(lit, vec3(0.96));
    lit *= 0.97;

    /* High body opacity; softer alpha only at glancing edges. */
    float bodyOp = uBodyAlpha * mix(0.86, 1.0, thickness);
    float edgeOp = mix(bodyOp, uEdgeAlpha * 0.78, fresnel * 0.55);
    float alpha = mix(bodyOp, edgeOp, softFresnel * 0.65);
    alpha = mix(alpha, min(1.0, alpha + 0.06), thickness * 0.5);
    alpha = clamp(alpha, 0.55, 0.96);
    if (!gl_FrontFacing) alpha *= 0.45;

    gl_FragColor = vec4(lit, alpha);
    #include <colorspace_fragment>
  }
`

export function createPearlescentMembraneUniforms({
  seed = 1,
  age = 0.5,
  speed = 0.32,
  noiseScale = 2.4,
  bodyAlpha = 0.88,
  edgeAlpha = 0.82,
  fresnelPower = 2.4,
  iridescence = 1.08,
  thicknessContrast = 0.7,
  softLight = 1,
  gloss = 0.72,
  interiorDepth = 0.9,
} = {}) {
  return {
    uSeed: { value: Number(seed) || 1 },
    uTime: { value: 0 },
    uAge: { value: Number(age) || 0 },
    uSpeed: { value: Number(speed) || 0.32 },
    uNoiseScale: { value: Number(noiseScale) || 2.4 },
    uBodyAlpha: { value: Number(bodyAlpha) || 0.88 },
    uEdgeAlpha: { value: Number(edgeAlpha) || 0.82 },
    uFresnelPower: { value: Number(fresnelPower) || 2.4 },
    uIridescence: { value: Number(iridescence) || 1.08 },
    uThicknessContrast: { value: Number(thicknessContrast) || 0.7 },
    uSoftLight: { value: Number(softLight) || 1 },
    uGloss: { value: Number(gloss) || 0.72 },
    uInteriorDepth: { value: Number(interiorDepth) || 0.9 },
  }
}

export function createPearlescentMembraneMaterial(uniforms, { depthWrite = true } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: pearlescentMembraneVertexShader,
    fragmentShader: pearlescentMembraneFragmentShader,
    uniforms,
    transparent: true,
    depthWrite,
    side: THREE.FrontSide,
    toneMapped: false,
    extensions: { derivatives: true },
  })
}
