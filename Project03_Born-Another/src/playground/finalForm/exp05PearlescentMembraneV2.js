/**
 * Exp05-only Pearlescent Membrane V2 — optical refinement study.
 *
 * Builds on V1 (same pastel palette + vertex contract). Improves localized gloss,
 * geometric thickness, view-film iridescence, and fold depth — without bloom,
 * milky wash, or morphology changes. V1 remains available for A/B.
 */
import * as THREE from 'three'
import { noiseFunctions } from '../../surfaceShader.js'
import { pearlescentMembraneVertexShader } from './exp05PearlescentMembrane.js'

export { pearlescentMembraneVertexShader as pearlescentMembraneV2VertexShader }

/**
 * Translucent wet membrane — curvature-gated gloss, thickness-driven opacity,
 * angle-responsive pastel interference, soft fold occlusion.
 */
export const pearlescentMembraneV2FragmentShader = /* glsl */ `
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
    float fresnel = pow(1.0 - NdotV, max(uFresnelPower, 0.75));
    float softFresnel = pow(1.0 - NdotV, max(uFresnelPower * 0.48, 0.4));

    /* Screen-space curvature magnitude (fold / ridge energy). */
    float curvMag = clamp(length(fwidth(worldNormal)) * 18.0, 0.0, 1.0);
    /* Soft convex vs concave cue: facing camera + low curv ≈ stretched face;
       grazing + high curv ≈ fold. No harsh AO. */
    float foldCue = clamp(
      curvMag * 0.72 + (1.0 - NdotV) * 0.38,
      0.0,
      1.0
    );
    float ridgeCue = clamp(curvMag * (0.35 + NdotV * 0.75), 0.0, 1.0);

    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);
    float ageScale = mix(0.92, 1.12, clamp(uAge, 0.0, 1.0));
    vec3 samplePos =
      vPosition * uNoiseScale * 0.55 * ageScale +
      seedOffset +
      vec3(0.0, uTime * uSpeed * 0.035, 0.0);

    /* Low-frequency membrane field only — silhouette thickness, not color noise. */
    float membraneField = fbm(samplePos * 0.95);
    float foldField = fbm(samplePos * 1.55 + vec3(3.1, 0.6, 1.4));

    /* Radial stretch vs mean shell — thinner on elongated lobes. */
    float radial = length(vPosition);
    float stretch = clamp((radial - 0.78) * 1.55, 0.0, 1.0);

    /*
     * Thickness: dense in folds / concave cues; thinner on stretched faces.
     * Geometric signals dominate; FBM only softens transitions.
     */
    float thickness =
      mix(0.28, 0.95, foldCue) *
      mix(1.0, 0.62, stretch * 0.85) *
      mix(0.88, 1.08, membraneField);
    thickness = mix(thickness, mix(thickness, 1.0, foldField), 0.18);
    thickness = clamp(
      mix(0.5, thickness, clamp(uThicknessContrast, 0.0, 1.25)),
      0.22,
      1.0
    );
    float thinness = 1.0 - thickness;

    float recess = clamp(
      foldCue * 0.7 +
        (1.0 - foldField) * 0.22 +
        (1.0 - NdotV) * 0.18,
      0.0,
      1.0
    );
    recess *= clamp(uInteriorDepth, 0.0, 1.35);

    vec3 keyDir = normalize(vec3(-0.12, 0.62, 0.78));
    vec3 fillDir = normalize(vec3(0.72, 0.18, -0.18));
    vec3 rimDir = normalize(vec3(-0.55, 0.28, -0.65));
    float wrap = dot(worldNormal, keyDir) * 0.5 + 0.5;
    float keyLit = max(dot(worldNormal, keyDir), 0.0);
    float fillLit = max(dot(worldNormal, fillDir), 0.0);
    float rimLit = max(dot(worldNormal, rimDir), 0.0);

    float ambient = mix(0.48, 0.58, thinness * 0.55);
    float diffuse =
      ambient +
      mix(0.12, 0.34, wrap) * uSoftLight +
      keyLit * 0.24 +
      fillLit * 0.1 * uSoftLight +
      rimLit * 0.055;
    /* Soft fold depth — sat/luma dip, never near-black. */
    diffuse *= mix(1.0, 0.72, recess * 0.78);
    diffuse *= mix(0.9, 1.05, thickness);

    float glossAmt = clamp(uGloss, 0.0, 1.0);
    /* Gloss concentrates on ridges / fold lips — not uniform sheen. */
    float glossGate =
      mix(0.12, 1.0, ridgeCue) *
      mix(0.55, 1.15, thickness) *
      mix(1.0, 0.45, recess * 0.55);

    vec3 halfKey = normalize(keyDir + viewDirection);
    vec3 halfFill = normalize(fillDir + viewDirection);
    float NdotHk = max(dot(normal, halfKey), 0.0);
    float NdotHf = max(dot(normal, halfFill), 0.0);

    float sharpPow = mix(48.0, 96.0, glossAmt);
    float midPow = mix(18.0, 36.0, glossAmt);
    float sharpSpec =
      pow(NdotHk, sharpPow) * (0.22 + 0.45 * glossAmt) * glossGate;
    float midSpec =
      pow(NdotHk, midPow) * 0.12 * mix(0.4, 1.0, curvMag) * glossAmt;
    float fillSpec =
      pow(NdotHf, mix(28.0, 52.0, glossAmt)) *
      0.08 *
      glossGate *
      glossAmt;
    /* Tiny wet micro-highlight on stretched thin regions only. */
    float wetPin =
      pow(NdotHk, 120.0) *
      thinness *
      (0.06 + 0.1 * glossAmt) *
      (0.2 + NdotV * 0.8);
    float specular = (sharpSpec + midSpec + fillSpec + wetPin) *
      mix(1.0, 0.55, recess);

    /* View-dependent thin-film phase — thickness + angle, not flat tint wash. */
    float iriAmt = clamp(uIridescence, 0.0, 1.4);
    float path =
      thickness * (1.15 + 1.65 / max(NdotV, 0.08)) +
      worldNormal.x * 0.55 +
      worldNormal.y * 0.28 +
      worldNormal.z * 0.4;
    float filmA = sin(path * 5.6 + membraneField * 1.2) * 0.5 + 0.5;
    float filmB = sin(path * 8.1 - foldField * 1.4 + 1.7) * 0.5 + 0.5;
    float filmC = sin(path * 3.4 + worldNormal.z * 2.2) * 0.5 + 0.5;
    float angleGate = mix(0.35, 1.0, softFresnel) * mix(0.55, 1.05, thinness);

    vec3 pink = vec3(0.95, 0.62, 0.74);
    vec3 cyan = vec3(0.42, 0.86, 0.92);
    vec3 lavender = vec3(0.72, 0.64, 0.92);
    vec3 peach = vec3(0.98, 0.76, 0.58);
    vec3 pearlBase = vec3(0.86, 0.84, 0.88);
    vec3 foldTint = vec3(0.66, 0.54, 0.74);
    vec3 foldCool = vec3(0.5, 0.62, 0.72);

    /* Base membrane: restrained; iridescence layered by film lobes. */
    vec3 pearl = mix(pearlBase, lavender, 0.42);
    pearl = mix(pearl, pink, filmA * 0.55 * iriAmt * angleGate);
    pearl = mix(pearl, cyan, filmB * 0.5 * iriAmt * angleGate);
    pearl = mix(pearl, peach, filmC * wrap * 0.4 * iriAmt);
    pearl = mix(pearl, lavender, softFresnel * 0.22 * iriAmt);

    vec3 bodyColor = mix(pearlBase, pearl, 0.72 + iriAmt * 0.22);
    /* Dense folds: more saturated, cooler; thin stretch: airier pastels. */
    bodyColor = mix(bodyColor, foldTint, recess * 0.42);
    bodyColor = mix(bodyColor, foldCool, recess * (1.0 - wrap) * 0.22);
    bodyColor = mix(bodyColor, mix(cyan, pink, filmA), thinness * 0.18 * iriAmt);
    float satBoost = mix(0.92, 1.12, thickness);
    float luma0 = dot(bodyColor, vec3(0.299, 0.587, 0.114));
    bodyColor = mix(vec3(luma0), bodyColor, satBoost);

    vec3 rim = mix(lavender, cyan, filmB * 0.55);
    rim = mix(rim, pink, filmA * 0.35);
    rim = mix(rim, peach, wrap * 0.25);

    vec3 lit = bodyColor * diffuse;
    lit += rim * fresnel * (0.08 + iriAmt * 0.07) * mix(1.0, 0.7, recess);
    /* Specular carries pearl tint — avoids white clipping. */
    vec3 specTint = mix(bodyColor, mix(cyan, pink, filmA), 0.4);
    lit += specTint * specular * 0.92;
    /* Thin regions transmit a soft fill of cool pastel (not glow). */
    lit += mix(cyan, lavender, filmB) * thinness * softFresnel * 0.06 * iriAmt;

    lit = max(lit, vec3(0.0));
    float luma = dot(lit, vec3(0.299, 0.587, 0.114));
    lit = mix(vec3(luma), lit, 1.18);
    /* Stronger highlight compression than V1 — protect wet pins. */
    lit = lit / (1.0 + max(lit - vec3(0.78), vec3(0.0)) * 0.72);
    lit = min(lit, vec3(0.94));
    lit *= 0.96;

    /* Opacity tracks thickness: stretched thinner, folds denser. */
    float bodyOp = uBodyAlpha * mix(0.72, 0.98, thickness);
    float edgeOp = mix(bodyOp, uEdgeAlpha * 0.72, fresnel * 0.5);
    float alpha = mix(bodyOp, edgeOp, softFresnel * 0.55);
    alpha = mix(alpha, min(1.0, alpha + 0.05), thickness * 0.45);
    alpha = clamp(alpha, 0.48, 0.95);
    if (!gl_FrontFacing) alpha *= 0.42;

    gl_FragColor = vec4(lit, alpha);
    #include <colorspace_fragment>
  }
`

export function createPearlescentMembraneV2Uniforms({
  seed = 1,
  age = 0.5,
  speed = 0.32,
  noiseScale = 2.4,
  bodyAlpha = 0.86,
  edgeAlpha = 0.78,
  fresnelPower = 2.55,
  iridescence = 1.12,
  thicknessContrast = 0.85,
  softLight = 0.95,
  gloss = 0.82,
  interiorDepth = 0.95,
} = {}) {
  return {
    uSeed: { value: Number(seed) || 1 },
    uTime: { value: 0 },
    uAge: { value: Number(age) || 0 },
    uSpeed: { value: Number(speed) || 0.32 },
    uNoiseScale: { value: Number(noiseScale) || 2.4 },
    uBodyAlpha: { value: Number(bodyAlpha) || 0.86 },
    uEdgeAlpha: { value: Number(edgeAlpha) || 0.78 },
    uFresnelPower: { value: Number(fresnelPower) || 2.55 },
    uIridescence: { value: Number(iridescence) || 1.12 },
    uThicknessContrast: { value: Number(thicknessContrast) || 0.85 },
    uSoftLight: { value: Number(softLight) || 0.95 },
    uGloss: { value: Number(gloss) || 0.82 },
    uInteriorDepth: { value: Number(interiorDepth) || 0.95 },
  }
}

export function createPearlescentMembraneV2Material(
  uniforms,
  { depthWrite = true } = {},
) {
  return new THREE.ShaderMaterial({
    vertexShader: pearlescentMembraneVertexShader,
    fragmentShader: pearlescentMembraneV2FragmentShader,
    uniforms,
    transparent: true,
    depthWrite,
    side: THREE.FrontSide,
    toneMapped: false,
    extensions: { derivatives: true },
  })
}
