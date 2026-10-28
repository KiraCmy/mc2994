/**
 * Exp05-only Biological Membrane V2 — sculptural fold depth study.
 *
 * Biological (V1) stays unchanged as the washed-pastel A/B baseline.
 * V2 prioritizes convex / concave readability, soft cavity occlusion, and
 * thickness-linked optical density — same pastel palette, no bloom / noise.
 *
 * Same Explore pass-through vertex; no morphology / Life / clear-color changes.
 */
import * as THREE from 'three'
import { noiseFunctions } from '../../surfaceShader.js'
import { pearlescentMembraneVertexShader } from './exp05PearlescentMembrane.js'

export { pearlescentMembraneVertexShader as biologicalMembraneV2VertexShader }

/**
 * Living tissue with readable folds: thin faces stay translucent; recessed
 * valleys soften with cavity occlusion; convex ridges carry localized gloss.
 */
export const biologicalMembraneV2FragmentShader = /* glsl */ `
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
  uniform float uOpticalDensity;
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

    /*
     * Screen-space curvature magnitude from normal derivatives.
     * High = folded / overlapping; low = open convex face.
     */
    float curvX = length(dFdx(worldNormal));
    float curvY = length(dFdy(worldNormal));
    float curvMag = clamp((curvX + curvY) * 11.5, 0.0, 1.0);

    /* Concave / recessed valleys vs open convex surfaces. */
    float foldCue = clamp(
      curvMag * 0.92 + (1.0 - NdotV) * 0.38,
      0.0,
      1.0
    );
    float convexCue = clamp(
      (1.0 - curvMag) * mix(0.55, 1.0, NdotV) ,
      0.0,
      1.0
    );
    float stretchFace = clamp(NdotV * (1.0 - curvMag * 0.85), 0.0, 1.0);

    float radial = length(vPosition);
    float stretch = clamp((radial - 0.76) * 1.65, 0.0, 1.0);
    /* Longer optical path at grazing angles. */
    float viewPath = clamp(1.05 / max(NdotV, 0.12), 0.85, 2.45);

    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);
    float ageScale = mix(0.94, 1.08, clamp(uAge, 0.0, 1.0));
    vec3 samplePos =
      vPosition * uNoiseScale * 0.36 * ageScale +
      seedOffset +
      vec3(0.0, uTime * uSpeed * 0.012, 0.0);

    /* Very low-frequency tissue field — softens only, no color noise. */
    vec3 warp =
      vec3(
        fbm(samplePos * 0.42 + vec3(1.1, 0.3, 2.4)),
        fbm(samplePos * 0.42 + vec3(3.7, 1.9, 0.6)),
        fbm(samplePos * 0.42 + vec3(0.8, 4.2, 1.5))
      ) - 0.5;
    vec3 tissueP = samplePos + warp * 0.12;
    float tissue = fbm(tissueP * 0.7);
    float mottling = smoothstep(0.28, 0.72, tissue);

    /*
     * Thickness proxy: folds denser, elongated faces thinner.
     * Geometry dominates; mottling is a light soften only.
     */
    float thicknessRaw =
      mix(0.12, 1.0, foldCue) *
      mix(1.0, 0.38, stretch * 0.95) *
      mix(0.94, 1.05, mottling) *
      mix(0.9, 1.14, clamp((viewPath - 1.0) * 0.4, 0.0, 1.0));

    float contrast = clamp(uThicknessContrast, 0.0, 2.0);
    float thickness = clamp(
      0.5 + (thicknessRaw - 0.5) * mix(0.7, 1.85, contrast / 1.25),
      0.06,
      1.0
    );
    float thinness = 1.0 - thickness;

    /*
     * Soft cavity occlusion in recessed / overlapping regions.
     * Darkens valleys relative to midtones — does not lift overall brightness.
     */
    float cavity = clamp(
      foldCue * 0.78 +
        curvMag * 0.35 +
        (1.0 - NdotV) * 0.28 +
        (1.0 - mottling) * 0.08,
      0.0,
      1.0
    );
    cavity = pow(cavity, 0.85) * clamp(uInteriorDepth, 0.0, 1.45);

    float density = clamp(uOpticalDensity, 0.15, 2.5);
    float opticalDepth = density * thickness * viewPath;
    float absorb = 1.0 - exp(-opticalDepth * 1.35);
    float transmit = exp(-opticalDepth * 0.62);

    vec3 keyDir = normalize(vec3(-0.08, 0.58, 0.8));
    vec3 fillDir = normalize(vec3(0.72, 0.26, -0.1));
    vec3 rimDir = normalize(vec3(-0.5, 0.32, -0.6));
    float wrap = dot(worldNormal, keyDir) * 0.5 + 0.5;
    float keyLit = max(dot(worldNormal, keyDir), 0.0);
    float fillLit = max(dot(worldNormal, fillDir), 0.0);
    float rimLit = max(dot(worldNormal, rimDir), 0.0);

    /* Lower ambient overall; valleys darker, convex faces mid — not brighter wash. */
    float ambient = mix(0.28, 0.46, thinness * 0.65 + convexCue * 0.2);
    float softWrap = pow(wrap, 0.9);
    float diffuse =
      ambient +
      mix(0.08, 0.2, softWrap) * uSoftLight +
      keyLit * 0.2 +
      fillLit * 0.08 * uSoftLight +
      rimLit * 0.035;

    /* Soft occlusion in cavities; slight relative lift only on open convex. */
    diffuse *= mix(1.0, 0.48, cavity * 0.95);
    diffuse *= mix(0.94, 1.06, convexCue * (1.0 - cavity) * 0.55);
    diffuse *= mix(0.9, 1.04, thickness * absorb * 0.5);

    /*
     * Localized gloss — ridge / fold peaks only, not broad surface sheen.
     */
    float glossAmt = clamp(uGloss, 0.0, 1.0);
    float ridgeGate =
      mix(0.0, 1.0, smoothstep(0.35, 0.85, foldCue)) *
      mix(0.35, 1.0, convexCue) *
      mix(0.55, 1.1, thickness) *
      mix(1.0, 0.35, cavity * 0.55);

    vec3 halfKey = normalize(keyDir + viewDirection);
    float NdotH = max(dot(normal, halfKey), 0.0);
    float ridgeGloss =
      pow(NdotH, mix(28.0, 48.0, glossAmt)) *
      (0.06 + 0.1 * glossAmt) *
      ridgeGate;
    float tipGloss =
      pow(NdotH, mix(56.0, 72.0, glossAmt)) *
      thinness *
      stretchFace *
      convexCue *
      (0.025 + 0.035 * glossAmt);
    float specular = (ridgeGloss + tipGloss) * mix(1.0, 0.4, cavity);

    float iriAmt = clamp(uIridescence, 0.0, 1.2);
    float path =
      thickness * (1.0 + 1.2 / max(NdotV, 0.1)) +
      worldNormal.x * 0.28 +
      worldNormal.y * 0.18 +
      worldNormal.z * 0.22;
    float filmA = sin(path * 3.2 + mottling * 0.35) * 0.5 + 0.5;
    float filmB = sin(path * 4.6 - mottling * 0.3 + 1.4) * 0.5 + 0.5;
    float angleGate = mix(0.3, 1.0, softFresnel) * mix(0.5, 1.0, thinness);

    /* Pastel palette — same family as V1 / page atmosphere. */
    vec3 tissueBase = vec3(0.8, 0.72, 0.76);
    vec3 pink = vec3(0.88, 0.6, 0.7);
    vec3 lavender = vec3(0.68, 0.6, 0.84);
    vec3 cyan = vec3(0.46, 0.76, 0.82);
    vec3 foldWarm = vec3(0.62, 0.44, 0.54);
    vec3 foldCool = vec3(0.44, 0.5, 0.68);
    vec3 denseCore = vec3(0.52, 0.42, 0.58);

    vec3 membrane = mix(tissueBase, lavender, 0.3);
    membrane = mix(membrane, pink, filmA * 0.28 * iriAmt * angleGate);
    membrane = mix(membrane, cyan, filmB * 0.22 * iriAmt * angleGate);
    membrane = mix(membrane, lavender, softFresnel * 0.12 * iriAmt);

    vec3 bodyColor = mix(tissueBase, membrane, 0.68 + iriAmt * 0.12);
    /* Thick folds: denser / slightly richer; thin: airy pastel. */
    float satBoost = mix(0.92, mix(1.02, 1.32, absorb), thickness);
    float luma0 = dot(bodyColor, vec3(0.299, 0.587, 0.114));
    bodyColor = mix(vec3(luma0), bodyColor, satBoost);
    bodyColor = mix(bodyColor, foldWarm, cavity * absorb * 0.58);
    bodyColor = mix(bodyColor, foldCool, cavity * (1.0 - wrap) * absorb * 0.36);
    bodyColor = mix(bodyColor, denseCore, cavity * absorb * thickness * 0.34);
    bodyColor = mix(
      bodyColor,
      mix(pink, cyan, filmB),
      thinness * transmit * 0.12 * iriAmt
    );

    vec3 rim = mix(lavender, cyan, filmB * 0.4);
    rim = mix(rim, pink, filmA * 0.28);

    vec3 lit = bodyColor * diffuse;
    lit += rim * fresnel * (0.03 + iriAmt * 0.028) * mix(1.0, 0.55, cavity);
    vec3 glossTint = mix(bodyColor, mix(pink, cyan, filmA), 0.18);
    lit += glossTint * specular * 0.85;
    /* Thin-face transmission only — no cloud glow. */
    lit += mix(cyan, lavender, filmB) * thinness * transmit * softFresnel * 0.04 * iriAmt;

    lit = max(lit, vec3(0.0));
    float luma = dot(lit, vec3(0.299, 0.587, 0.114));
    lit = mix(vec3(luma), lit, mix(1.02, 1.16, thickness));
    /* Compress highlights — localized gloss, no white wash. */
    lit = lit / (1.0 + max(lit - vec3(0.62), vec3(0.0)) * 1.25);
    lit = min(lit, vec3(0.8));
    lit *= mix(0.97, 0.88, cavity * absorb * 0.45);

    /*
     * Alpha: thin delicate (more translucent); thick optically dense.
     * Wider span than V1 — folds hold mass without uniform opacity.
     */
    float bodyOp =
      uBodyAlpha *
      mix(0.32, 0.62, thinness) *
      mix(0.48, 1.0, absorb);
    bodyOp = mix(
      bodyOp,
      min(0.98, bodyOp + 0.16 * density * thickness),
      thickness
    );
    /* Soften alpha slightly in deep cavities so overlaps read layered. */
    bodyOp *= mix(1.0, 0.9, cavity * 0.35);
    float edgeOp = mix(bodyOp, uEdgeAlpha * mix(0.45, 0.72, absorb), fresnel * 0.4);
    float alpha = mix(bodyOp, edgeOp, softFresnel * 0.38);
    alpha = clamp(alpha, 0.22, 0.97);
    if (!gl_FrontFacing) alpha *= 0.36;

    gl_FragColor = vec4(lit, alpha);
    #include <colorspace_fragment>
  }
`

export function createBiologicalMembraneV2Uniforms({
  seed = 1,
  age = 0.5,
  speed = 0.28,
  noiseScale = 2.05,
  bodyAlpha = 0.88,
  edgeAlpha = 0.74,
  fresnelPower = 2.2,
  iridescence = 0.68,
  thicknessContrast = 1.25,
  opticalDensity = 1.35,
  softLight = 0.92,
  gloss = 0.42,
  interiorDepth = 1.28,
} = {}) {
  return {
    uSeed: { value: Number(seed) || 1 },
    uTime: { value: 0 },
    uAge: { value: Number(age) || 0 },
    uSpeed: { value: Number(speed) || 0.28 },
    uNoiseScale: { value: Number(noiseScale) || 2.05 },
    uBodyAlpha: { value: Number(bodyAlpha) || 0.88 },
    uEdgeAlpha: { value: Number(edgeAlpha) || 0.74 },
    uFresnelPower: { value: Number(fresnelPower) || 2.2 },
    uIridescence: { value: Number(iridescence) || 0.68 },
    uThicknessContrast: { value: Number(thicknessContrast) || 1.25 },
    uOpticalDensity: { value: Number(opticalDensity) || 1.35 },
    uSoftLight: { value: Number(softLight) || 0.92 },
    uGloss: { value: Number(gloss) || 0.42 },
    uInteriorDepth: { value: Number(interiorDepth) || 1.28 },
  }
}

export function createBiologicalMembraneV2Material(
  uniforms,
  { depthWrite = true } = {},
) {
  return new THREE.ShaderMaterial({
    vertexShader: pearlescentMembraneVertexShader,
    fragmentShader: biologicalMembraneV2FragmentShader,
    uniforms,
    transparent: true,
    depthWrite,
    side: THREE.FrontSide,
    toneMapped: false,
    extensions: { derivatives: true },
  })
}
