/**
 * Exp05-only Biological Membrane body material.
 *
 * Soft translucent living tissue — delicate thickness variation, gentle pastel
 * iridescence, fold-gated wet highlights. Same Explore vertex contract as
 * Pearlescent (CPU-owned silhouette). No MeshPhysical / bloom / clear-color
 * change. Pearlescent remains available for A/B.
 */
import * as THREE from 'three'
import { noiseFunctions } from '../../surfaceShader.js'
import { pearlescentMembraneVertexShader } from './exp05PearlescentMembrane.js'

export { pearlescentMembraneVertexShader as biologicalMembraneVertexShader }

/**
 * Fragile living membrane — soft wrap lighting, subtle optical depth in folds,
 * localized wetness; avoids glass speculars and noisy procedural grain.
 */
export const biologicalMembraneFragmentShader = /* glsl */ `
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
    float fresnel = pow(1.0 - NdotV, max(uFresnelPower, 0.65));
    float softFresnel = pow(1.0 - NdotV, max(uFresnelPower * 0.42, 0.35));

    /* Fold / stretch cues from geometry — primary structure signal. */
    float curvMag = clamp(length(fwidth(worldNormal)) * 16.5, 0.0, 1.0);
    float foldCue = clamp(
      curvMag * 0.68 + (1.0 - NdotV) * 0.42,
      0.0,
      1.0
    );
    float stretchFace = clamp(NdotV * (1.0 - curvMag * 0.85), 0.0, 1.0);

    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);
    float ageScale = mix(0.94, 1.08, clamp(uAge, 0.0, 1.0));
    vec3 samplePos =
      vPosition * uNoiseScale * 0.42 * ageScale +
      seedOffset +
      vec3(0.0, uTime * uSpeed * 0.018, 0.0);

    /*
     * Tissue field: very low-frequency, lightly domain-warped.
     * Amplitude kept low so microstructure reads as soft mottling, not grain.
     */
    vec3 warp =
      vec3(
        fbm(samplePos * 0.55 + vec3(1.1, 0.3, 2.4)),
        fbm(samplePos * 0.55 + vec3(3.7, 1.9, 0.6)),
        fbm(samplePos * 0.55 + vec3(0.8, 4.2, 1.5))
      ) - 0.5;
    vec3 tissueP = samplePos + warp * 0.22;
    float tissue = fbm(tissueP * 0.85);
    float tissueFine = fbm(tissueP * 2.05 + vec3(2.2, 0.7, 1.1));
    /* Soft blend — kill high-contrast noise edges. */
    float mottling = mix(tissue, tissueFine, 0.28);
    mottling = smoothstep(0.22, 0.78, mottling);

    float radial = length(vPosition);
    float stretch = clamp((radial - 0.78) * 1.45, 0.0, 1.0);

    /*
     * Thickness: denser in folds / compression; thinner on elongated faces.
     * Geometric cues dominate; tissue field only softens transitions.
     */
    float thickness =
      mix(0.32, 0.92, foldCue) *
      mix(1.0, 0.58, stretch * 0.9) *
      mix(0.9, 1.06, mottling);
    thickness = clamp(
      mix(0.52, thickness, clamp(uThicknessContrast, 0.0, 1.25)),
      0.26,
      0.98
    );
    float thinness = 1.0 - thickness;

    /* Optical depth in compressed / overlapping regions. */
    float recess = clamp(
      foldCue * 0.78 +
        (1.0 - mottling) * 0.16 +
        (1.0 - NdotV) * 0.2,
      0.0,
      1.0
    );
    recess *= clamp(uInteriorDepth, 0.0, 1.35);

    vec3 keyDir = normalize(vec3(-0.1, 0.55, 0.82));
    vec3 fillDir = normalize(vec3(0.7, 0.28, -0.12));
    vec3 rimDir = normalize(vec3(-0.48, 0.35, -0.62));
    float wrap = dot(worldNormal, keyDir) * 0.5 + 0.5;
    float keyLit = max(dot(worldNormal, keyDir), 0.0);
    float fillLit = max(dot(worldNormal, fillDir), 0.0);
    float rimLit = max(dot(worldNormal, rimDir), 0.0);

    /* Soft SSS-like wrap — living tissue, not hard Lambert. */
    float softWrap = pow(wrap, 0.85);
    float ambient = mix(0.5, 0.6, thinness * 0.45);
    float diffuse =
      ambient +
      mix(0.14, 0.3, softWrap) * uSoftLight +
      keyLit * 0.16 +
      fillLit * 0.12 * uSoftLight +
      rimLit * 0.05;
    diffuse *= mix(1.0, 0.78, recess * 0.82);
    diffuse *= mix(0.92, 1.04, thickness);

    float glossAmt = clamp(uGloss, 0.0, 1.0);
    /*
     * Wet highlights only — folds / stretch lips. No hard glass pins,
     * no uniform plastic sheen.
     */
    float wetGate =
      mix(0.08, 1.0, foldCue) *
      mix(0.35, 1.05, thickness) *
      mix(0.55, 1.15, stretchFace * thinness * 0.65 + foldCue * 0.55) *
      mix(1.0, 0.5, recess * 0.4);

    vec3 halfKey = normalize(keyDir + viewDirection);
    float NdotH = max(dot(normal, halfKey), 0.0);
    float broadWet =
      pow(NdotH, mix(10.0, 18.0, glossAmt)) *
      (0.1 + 0.14 * glossAmt) *
      wetGate;
    float foldWet =
      pow(NdotH, mix(28.0, 44.0, glossAmt)) *
      (0.05 + 0.1 * glossAmt) *
      foldCue *
      (0.35 + stretch * 0.65);
    float stretchWet =
      pow(NdotH, 56.0) *
      thinness *
      stretchFace *
      (0.035 + 0.05 * glossAmt);
    float specular = (broadWet + foldWet + stretchWet) * mix(1.0, 0.62, recess);

    /* Gentle pastel interference — low amplitude, thickness + angle. */
    float iriAmt = clamp(uIridescence, 0.0, 1.2);
    float path =
      thickness * (0.95 + 1.15 / max(NdotV, 0.1)) +
      worldNormal.x * 0.35 +
      worldNormal.y * 0.22 +
      worldNormal.z * 0.28;
    float filmA = sin(path * 3.8 + mottling * 0.7) * 0.5 + 0.5;
    float filmB = sin(path * 5.2 - mottling * 0.55 + 1.4) * 0.5 + 0.5;
    float angleGate = mix(0.4, 1.0, softFresnel) * mix(0.65, 1.0, thinness);

    /* Living tissue palette — soft pink / lavender / cyan, muted base. */
    vec3 tissueBase = vec3(0.86, 0.78, 0.8);
    vec3 pink = vec3(0.92, 0.68, 0.76);
    vec3 lavender = vec3(0.76, 0.7, 0.88);
    vec3 cyan = vec3(0.55, 0.82, 0.86);
    vec3 foldWarm = vec3(0.72, 0.56, 0.64);
    vec3 foldCool = vec3(0.58, 0.62, 0.74);

    vec3 membrane = mix(tissueBase, lavender, 0.28);
    membrane = mix(membrane, pink, filmA * 0.32 * iriAmt * angleGate);
    membrane = mix(membrane, cyan, filmB * 0.26 * iriAmt * angleGate);
    membrane = mix(membrane, lavender, softFresnel * 0.14 * iriAmt);

    vec3 bodyColor = mix(tissueBase, membrane, 0.62 + iriAmt * 0.18);
    /* Compressed regions: richer optical depth (sat + cool/warm), not black. */
    bodyColor = mix(bodyColor, foldWarm, recess * 0.38);
    bodyColor = mix(bodyColor, foldCool, recess * (1.0 - wrap) * 0.2);
    bodyColor = mix(bodyColor, mix(pink, cyan, filmB), thinness * 0.12 * iriAmt);
    float luma0 = dot(bodyColor, vec3(0.299, 0.587, 0.114));
    bodyColor = mix(vec3(luma0), bodyColor, mix(0.94, 1.08, thickness));

    vec3 rim = mix(lavender, cyan, filmB * 0.4);
    rim = mix(rim, pink, filmA * 0.28);

    vec3 lit = bodyColor * diffuse;
    lit += rim * fresnel * (0.05 + iriAmt * 0.04) * mix(1.0, 0.72, recess);
    /* Specular stays tinted — never hot white glass. */
    vec3 wetTint = mix(bodyColor, mix(pink, cyan, filmA), 0.28);
    lit += wetTint * specular * 0.78;
    /* Soft transmitted fill in thin stretched tissue. */
    lit += mix(cyan, lavender, filmB) * thinness * softFresnel * 0.045 * iriAmt;

    lit = max(lit, vec3(0.0));
    float luma = dot(lit, vec3(0.299, 0.587, 0.114));
    lit = mix(vec3(luma), lit, 1.1);
    /* Aggressive highlight compression — prioritize softness over sparkle. */
    lit = lit / (1.0 + max(lit - vec3(0.72), vec3(0.0)) * 0.95);
    lit = min(lit, vec3(0.88));
    lit *= 0.94;

    /* Opacity tracks thickness: delicate overall, denser in folds. */
    float bodyOp = uBodyAlpha * mix(0.68, 0.94, thickness);
    float edgeOp = mix(bodyOp, uEdgeAlpha * 0.68, fresnel * 0.48);
    float alpha = mix(bodyOp, edgeOp, softFresnel * 0.5);
    alpha = mix(alpha, min(1.0, alpha + 0.04), thickness * 0.4);
    alpha = clamp(alpha, 0.42, 0.9);
    if (!gl_FrontFacing) alpha *= 0.4;

    gl_FragColor = vec4(lit, alpha);
    #include <colorspace_fragment>
  }
`

export function createBiologicalMembraneUniforms({
  seed = 1,
  age = 0.5,
  speed = 0.28,
  noiseScale = 2.1,
  bodyAlpha = 0.78,
  edgeAlpha = 0.7,
  fresnelPower = 2.15,
  iridescence = 0.78,
  thicknessContrast = 0.92,
  softLight = 1.05,
  gloss = 0.38,
  interiorDepth = 1.05,
} = {}) {
  return {
    uSeed: { value: Number(seed) || 1 },
    uTime: { value: 0 },
    uAge: { value: Number(age) || 0 },
    uSpeed: { value: Number(speed) || 0.28 },
    uNoiseScale: { value: Number(noiseScale) || 2.1 },
    uBodyAlpha: { value: Number(bodyAlpha) || 0.78 },
    uEdgeAlpha: { value: Number(edgeAlpha) || 0.7 },
    uFresnelPower: { value: Number(fresnelPower) || 2.15 },
    uIridescence: { value: Number(iridescence) || 0.78 },
    uThicknessContrast: { value: Number(thicknessContrast) || 0.92 },
    uSoftLight: { value: Number(softLight) || 1.05 },
    uGloss: { value: Number(gloss) || 0.38 },
    uInteriorDepth: { value: Number(interiorDepth) || 1.05 },
  }
}

export function createBiologicalMembraneMaterial(
  uniforms,
  { depthWrite = true } = {},
) {
  return new THREE.ShaderMaterial({
    vertexShader: pearlescentMembraneVertexShader,
    fragmentShader: biologicalMembraneFragmentShader,
    uniforms,
    transparent: true,
    depthWrite,
    side: THREE.FrontSide,
    toneMapped: false,
    extensions: { derivatives: true },
  })
}
