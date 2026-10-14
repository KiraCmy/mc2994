import { noiseFunctions } from '../surfaceShader.js'

/**
 * Organism material. The deformed surface reflects and refracts a studio
 * environment: sharp ribbons follow the folds, and a spatial mask blends
 * dense reflective regions with refractive glass. The page behind the canvas
 * is not scene geometry, so transmission is of this environment rather than
 * a background photograph.
 *
 * Vertex deformation is unchanged. The stage vertex shaders still supply
 * vPosition, vViewPosition, vNormal and vWorldNormal.
 */
export const organismSpatialMaterialFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRimColor;
  uniform float uLow;
  uniform float uHigh;
  uniform float uSeed;
  uniform float uCoreOpacity;
  uniform float uShellTransmission;
  uniform float uRoughness;
  uniform float uIor;
  uniform float uShowMaterialMask;
  uniform samplerCube uEnvSharp;
  uniform samplerCube uEnvSoft;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}

  vec3 decodeEnv(vec3 color) {
    return pow(max(color, vec3(0.0)), vec3(2.2));
  }

  vec3 sampleEnv(vec3 dir, float rough) {
    vec3 sharp = decodeEnv(textureCube(uEnvSharp, dir).rgb);
    vec3 soft = decodeEnv(textureCube(uEnvSoft, dir).rgb);
    return mix(sharp, soft, clamp(rough, 0.0, 1.0));
  }

  float materialField(vec3 p) {
    vec3 q = p * 1.5 + vec3(uSeed * 0.071, uSeed * 0.113, uSeed * 0.157);
    vec3 warp = vec3(
      fbm(q + vec3(4.1, 0.0, 1.3)),
      fbm(q + vec3(0.0, 7.3, 2.2)),
      fbm(q + vec3(5.2, 1.7, 0.0))
    ) - 0.47;
    return fbm(q + warp * 1.6);
  }

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 viewDir = normalize((vec4(normalize(-vViewPosition), 0.0) * viewMatrix).xyz);
    float facing = clamp(dot(n, viewDir), 0.0, 1.0);

    float relief = smoothstep(0.04, 0.3, 1.0 - dot(n, normalize(vPosition)));
    float field = smoothstep(0.42, 0.62, materialField(vPosition));
    float solid = smoothstep(0.0, 1.0, clamp(field * 0.85 + relief * 0.28, 0.0, 1.0));

    if (uShowMaterialMask > 0.5) {
      gl_FragColor = vec4(vec3(solid), 1.0);
      return;
    }

    float rough = mix(uRoughness * 0.25, uRoughness, solid);
    float eta = 1.0 / max(uIor, 1.001);
    vec3 reflected = reflect(-viewDir, n);
    vec3 transmitted = refract(-viewDir, n, eta);
    if (dot(transmitted, transmitted) < 1e-5) transmitted = reflected;
    vec3 bounced = reflect(transmitted, -n);

    // Soft shoulder of each band, plus the sharp core above it. A flow
    // field turns the core up and down so a reflection widens and softens
    // instead of staying a constant wire.
    vec3 sharpRefl = sampleEnv(reflected, rough * 0.08);
    vec3 softRefl = sampleEnv(reflected, mix(0.16, 0.4, rough));
    vec3 ribbon = max(sharpRefl - softRefl, vec3(0.0));
    float flow = fbm(reflected * 1.35 + vPosition * 2.05 + vec3(uSeed * 0.017));
    float ribbonGain = mix(0.28, 1.05, smoothstep(0.3, 0.78, flow));
    vec3 refl = softRefl + ribbon * ribbonGain * (1.0 - rough * 0.35);
    float peak = max(refl.r, max(refl.g, refl.b));
    refl *= mix(0.5, 1.0, smoothstep(0.2, 0.7, peak));

    vec3 refrRaw = mix(
      sampleEnv(transmitted, rough * 0.55),
      sampleEnv(bounced, rough * 0.75),
      0.38
    );

    float height = smoothstep(uLow, uHigh, vPosition.y);
    vec3 tint = mix(uColorA, uColorB, height);
    float thick = mix(0.55, 2.4, pow(1.0 - facing, 1.15));

    // Sparse openings in the dark mass. They stay out of the densest regions.
    float clearField = materialField(vPosition * 1.15 + vec3(8.2, 1.4, 3.7));
    float clear = smoothstep(0.74, 0.92, clearField);
    clear *= 1.0 - smoothstep(0.42, 0.82, solid);

    float absorbAmt = mix(mix(0.85, 1.45, solid), 0.2, clear);
    vec3 absorb = exp(-(vec3(1.0) - tint) * thick * absorbAmt);
    vec3 through = sampleEnv(transmitted, 0.32);
    vec3 volume = mix(refrRaw * absorb, through * tint * 0.85, clear);

    float f0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
    float fresnel = f0 + (1.0 - f0) * pow(1.0 - facing, 5.0);
    // Clear glass still carries the reflection, at a lower weight, so the
    // volume reads behind the flow instead of replacing it.
    float mirrorAmt = mix(fresnel, mix(fresnel, 0.4, 0.7), clear);

    vec3 glass = mix(volume, refl, mirrorAmt);
    glass = mix(refl, glass, uShellTransmission);

    vec3 solidColor = tint * (0.16 + 0.2 * facing) + refl * (0.72 + 0.28 * fresnel);
    float density = solid * mix(0.25, 1.0, uCoreOpacity) * (1.0 - clear);
    vec3 color = mix(glass, solidColor, density);

    float film = 1.2 + 2.4 * fbm(vPosition * 1.7 + vec3(uSeed * 0.01));
    vec3 irid = 0.5 + 0.5 * cos(6.28318 * (facing * film + vec3(0.0, 0.18, 0.42)));
    irid = mix(tint, irid, 0.45);
    color += irid * pow(1.0 - facing, 2.2) * 0.16 * uRimColor;

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`
