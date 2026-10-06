export const vertexShader = /* glsl */ `
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

// Classic 3D value noise — pattern is sampled in object space so it stays on the form.
export const noiseFunctions = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float valueNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(hash31(i + vec3(0.0, 0.0, 0.0)), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * valueNoise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 2.3);
      amp *= 0.5;
    }
    return sum;
  }
`

/**
 * AGE-driven low-frequency body morphology — applied before Study 03 noise.
 * Requires: noiseFunctions (valueNoise), uniforms uAge + uSeed.
 *
 * A seed-locked set of 3–6 spatial regions push/pull the shell into large
 * bulges and indentations so silhouettes differ structurally between seeds —
 * not only tall / wide / compressed spheres. uSeed also locks X/Y/Z proportions,
 * each region's falloff radius, and which 1–2 regions dominate. Calm surface
 * patches remain where no region is strong. Fixed for one life.
 */
export const macroMorphologyGlsl = /* glsl */ `
  vec3 macroSeedDir(float channel) {
    float s = uSeed * 0.00137 + channel * 17.23;
    vec3 d = vec3(
      sin(s * 1.7 + 0.4),
      cos(s * 1.3 + 1.1),
      sin(s * 2.1 + 2.6)
    );
    float len = length(d);
    return len > 1e-5 ? d / len : vec3(0.0, 1.0, 0.0);
  }

  /** Soft spatial falloff around a region center on the unit sphere. */
  float macroRegion(vec3 n, vec3 center, float width) {
    float d = 1.0 - max(0.0, dot(n, center));
    float w = max(width, 0.08);
    return exp(-(d * d) / (w * w));
  }

  /** Seed-locked anisotropic body proportions (volume soft-normalized). */
  vec3 macroBodyScale() {
    float ux = sin(uSeed * 0.0113) * 0.5 + 0.5;
    float uy = cos(uSeed * 0.0147 + 1.7) * 0.5 + 0.5;
    float uz = sin(uSeed * 0.0091 + 2.3) * 0.5 + 0.5;
    vec3 s = vec3(
      mix(0.9, 1.12, ux),
      mix(0.88, 1.14, uy),
      mix(0.9, 1.12, uz)
    );
    float vol = max(s.x * s.y * s.z, 1e-4);
    s *= pow(1.0 / vol, 0.333333);
    float overall = mix(0.97, 1.04, sin(uSeed * 0.0077 + 0.9) * 0.5 + 0.5);
    return s * overall;
  }

  /** Seed-locked region radius (falloff width) for channel 0–5. */
  float macroRegionWidth(float channel) {
    float t = sin(uSeed * (0.041 + channel * 0.013) + channel * 2.17) * 0.5 + 0.5;
    // Tight vs broad — wider span so some lobes are local, others span a hemisphere.
    float lo = mix(0.22, 0.38, channel * 0.12);
    float hi = mix(0.55, 0.95, channel * 0.14);
    return mix(lo, hi, t);
  }

  /** Seed-locked signed amplitude for region channel (before dominant boost). */
  float macroRegionAmp(float channel) {
    float phase = uSeed * (0.017 + channel * 0.0073) + channel * 1.91;
    float unit = sin(phase) * 0.5 + 0.5;
    // Prefer a mix of push and pull; avoid near-zero limp regions.
    float signBit = step(0.5, fract(sin(phase * 1.7 + 0.3) * 43758.5453));
    float mag = mix(0.28, 0.62, unit);
    return mix(-mag, mag, signBit);
  }

  /**
   * Object-space offset for rest position p (typically on the unit sphere).
   * Birth ≈ 0; development elongates; maturity opens large regions; decay collapses.
   * Region count / radii / dominance and proportions are seed-only (stable per life).
   */
  vec3 macroMorphologyOffsetAt(vec3 p, float age) {
    float a = clamp(age, 0.0, 1.0);
    float rad = max(length(p), 1e-4);
    vec3 n = p / rad;

    // Smooth overlapping stage envelopes (not hard cuts).
    float develop = smoothstep(0.02, 0.28, a) * (1.0 - smoothstep(0.72, 0.96, a));
    float mature = smoothstep(0.12, 0.4, a) * (1.0 - smoothstep(0.68, 0.92, a));
    float collapse = smoothstep(0.52, 0.78, a);
    float present = max(develop, mature);

    // Seed-locked active region count in {3,4,5,6}.
    float countUnit = fract(sin(uSeed * 0.0129 + 4.1) * 43758.5453);
    float regionCount = floor(3.0 + countUnit * 3.999);

    // Up to six seed-locked centers — well separated large zones, not grain.
    vec3 c0 = macroSeedDir(0.0);
    vec3 c1 = macroSeedDir(1.0);
    vec3 c2 = normalize(cross(c0, c1) + c1 * 0.38 + c0 * 0.22);
    vec3 c3 = normalize(c0 * -0.55 + c1 * 0.35 + c2 * 0.75);
    vec3 c4 = normalize(macroSeedDir(4.0) * 0.65 + c2 * -0.45 + c3 * 0.4);
    vec3 c5 = normalize(macroSeedDir(5.0) * 0.7 + c0 * 0.35 + c3 * -0.5);

    // 1–2 dominant regions get a stronger push/pull.
    float dualDom = step(0.42, fract(sin(uSeed * 0.0211 + 2.6) * 43758.5453));
    float domA = floor(fract(sin(uSeed * 0.0337 + 0.8) * 43758.5453) * regionCount);
    float domB = floor(fract(sin(uSeed * 0.0283 + 5.2) * 43758.5453) * regionCount);
    // Ensure second dominant differs when two are active.
    domB = mix(domB, mod(domA + 1.0 + floor(regionCount * 0.5), regionCount), step(0.5, 1.0 - abs(domA - domB)));

    float amp0 = macroRegionAmp(0.0);
    float amp1 = macroRegionAmp(1.0);
    float amp2 = macroRegionAmp(2.0);
    float amp3 = macroRegionAmp(3.0);
    float amp4 = macroRegionAmp(4.0);
    float amp5 = macroRegionAmp(5.0);

    float boost = 1.72;
    amp0 *= 1.0 + boost * step(0.5, 1.0 - abs(domA - 0.0)) + boost * dualDom * step(0.5, 1.0 - abs(domB - 0.0));
    amp1 *= 1.0 + boost * step(0.5, 1.0 - abs(domA - 1.0)) + boost * dualDom * step(0.5, 1.0 - abs(domB - 1.0));
    amp2 *= 1.0 + boost * step(0.5, 1.0 - abs(domA - 2.0)) + boost * dualDom * step(0.5, 1.0 - abs(domB - 2.0));
    amp3 *= 1.0 + boost * step(0.5, 1.0 - abs(domA - 3.0)) + boost * dualDom * step(0.5, 1.0 - abs(domB - 3.0));
    amp4 *= 1.0 + boost * step(0.5, 1.0 - abs(domA - 4.0)) + boost * dualDom * step(0.5, 1.0 - abs(domB - 4.0));
    amp5 *= 1.0 + boost * step(0.5, 1.0 - abs(domA - 5.0)) + boost * dualDom * step(0.5, 1.0 - abs(domB - 5.0));

    // Gate inactive slots (count 3→ only 0..2 live, etc.).
    float on0 = step(0.5, regionCount - 0.0);
    float on1 = step(0.5, regionCount - 1.0);
    float on2 = step(0.5, regionCount - 2.0);
    float on3 = step(0.5, regionCount - 3.0);
    float on4 = step(0.5, regionCount - 4.0);
    float on5 = step(0.5, regionCount - 5.0);

    float w0 = macroRegionWidth(0.0);
    float w1 = macroRegionWidth(1.0);
    float w2 = macroRegionWidth(2.0);
    float w3 = macroRegionWidth(3.0);
    float w4 = macroRegionWidth(4.0);
    float w5 = macroRegionWidth(5.0);

    float r0 = macroRegion(n, c0, w0) * on0;
    float r1 = macroRegion(n, c1, w1) * on1;
    float r2 = macroRegion(n, c2, w2) * on2;
    float r3 = macroRegion(n, c3, w3) * on3;
    float r4 = macroRegion(n, c4, w4) * on4;
    float r5 = macroRegion(n, c5, w5) * on5;

    // Combined radial field — distinct large bulges and dents; calm elsewhere.
    float coverage = r0 + r1 + r2 + r3 + r4 + r5;
    float radial =
      r0 * amp0
      + r1 * amp1
      + r2 * amp2
      + r3 * amp3
      + r4 * amp4
      + r5 * amp5;

    // Ultra-low-frequency mass shift — kept mild so non-region zones stay calm.
    float slow = valueNoise(n * 0.35 + vec3(uSeed * 0.061, 0.27, 1.4));
    float slow2 = valueNoise(n * 0.22 + vec3(1.9, uSeed * 0.044, 0.55));
    float mass = (slow - 0.5) * 0.16 + (slow2 - 0.5) * 0.1;
    // Fade global mass where no macro region is active.
    float calmGate = smoothstep(0.08, 0.45, coverage);
    mass *= mix(0.25, 1.0, calmGate);

    // Development: elongate along primary axis + early regional imprint.
    float along = dot(n, c0);
    vec3 developOffset =
      c0 * (along * 0.32 + (slow - 0.5) * 0.08) * develop
      + n * (radial * 0.38 + mass * 0.35) * develop
      + c1 * (slow2 - 0.5) * 0.06 * develop;

    // Maturity: region field dominates the silhouette.
    vec3 matureOffset =
      n * (radial * 0.88 + mass * 0.75) * mature
      + (c1 * (slow - 0.42) * 0.1 + c2 * (slow2 - 0.5) * 0.08) * mature
      + c0 * along * 0.08 * mature;

    // Broad residual shell asymmetry while alive (quiet in calm zones).
    vec3 shellOffset = n * mass * 0.45 * present;

    // Instability / decay: uneven compression toward the densest lobes.
    float hollow = 1.0 - max(radial, 0.0) * 0.45 + max(-radial, 0.0) * 0.55 + (slow - 0.5) * 0.4;
    float crush = pow(clamp(hollow, 0.0, 1.5), 1.2);
    vec3 collapseOffset =
      -n * crush * 0.32 * collapse
      - c0 * (slow2 - 0.5) * 0.1 * collapse
      + c1 * (slow - 0.5) * 0.07 * collapse;

    vec3 localOffset = developOffset + matureOffset + shellOffset + collapseOffset;
    // Seed-locked X/Y/Z proportions — applied to the whole body, fixed for this life.
    vec3 bodyScale = macroBodyScale();
    return (p + localOffset) * bodyScale - p;
  }

  vec3 macroMorphologyOffset(vec3 p) {
    return macroMorphologyOffsetAt(p, uAge);
  }

  vec3 macroMorphologyPosition(vec3 p) {
    return p + macroMorphologyOffset(p);
  }

  vec3 macroMorphologyPositionAt(vec3 p, float age) {
    return p + macroMorphologyOffsetAt(p, age);
  }

  /** Finite-difference normal of the macro-deformed rest surface. */
  vec3 macroMorphologyNormalAt(vec3 p, vec3 n0, float age) {
    float e = 0.07;
    vec3 t = normalize(cross(n0, abs(n0.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 b = normalize(cross(n0, t));
    vec3 c = macroMorphologyPositionAt(p, age);
    vec3 pT = macroMorphologyPositionAt(p + t * e, age);
    vec3 pB = macroMorphologyPositionAt(p + b * e, age);
    vec3 n = normalize(cross(pT - c, pB - c));
    if (dot(n, n0) < 0.0) n = -n;
    return n;
  }

  vec3 macroMorphologyNormal(vec3 p, vec3 n0) {
    return macroMorphologyNormalAt(p, n0, uAge);
  }
`

/**
 * Shared Study 03 displacement field — used by the base mesh and scatter attachment.
 * Requires uniforms: uTime, uAge, uSeed, uNoiseScale, uSpeed, uPulseSpeed,
 * uDisplacement, uNoiseAmount.
 * Noise / breath only — macro morphology lives in macroMorphologyGlsl.
 */
export const developmentDisplacementGlsl = /* glsl */ `
  ${noiseFunctions}

  float formField(vec3 p) {
    float moving = fbm(p * uNoiseScale + vec3(0.0, uTime * uSpeed, uSeed * 0.137));
    float detail = fbm(p * uNoiseScale * 2.35 + vec3(uTime * uSpeed * 0.7, uSeed * 0.29, 1.7));
    float ridges = fbm(p * uNoiseScale * 0.55 + vec3(uSeed * 0.08, 4.1, uTime * uSpeed * 0.22));
    // Bipolar field so noise pushes and pulls — clearer 3D form.
    return (moving * 2.0 - 1.0) * 0.7
         + (detail * 2.0 - 1.0) * 0.45
         + (ridges * 2.0 - 1.0) * 0.35;
  }

  float developmentDisplaceAmount(vec3 p) {
    float pulse = sin(uTime * uPulseSpeed + uSeed * 0.01) * 0.5 + 0.5;
    float lifeEnvelope = smoothstep(0.0, 0.1, uAge) * (1.0 - smoothstep(0.88, 1.0, uAge));
    float noiseGain = mix(0.85, 2.1, clamp(uNoiseAmount * 0.5, 0.0, 1.0));
    float field = formField(p);
    // Secondary surface variation — macro regions own the silhouette.
    return (field * 0.42 + (pulse - 0.5) * 0.1) * uDisplacement * lifeEnvelope * noiseGain;
  }
`

/**
 * Path growth influence — swell along deformed normal after AGE deform.
 * Rest-space chord distance to packed stroke samples; soft falloff by radius.
 * Per-sample progress (0→1 after draw) expands radius + strength from the path
 * outward up to uPathGrowthStrength / uPathGrowthRadius maxima.
 *
 * Requires: uPathPointCount, uPathPoints[], uPathPointProgress[],
 * uPathGrowthStrength, uPathGrowthRadius.
 */
export const PATH_GROWTH_MAX = 96

/**
 * Path-growth helpers only. Declare uniforms at the TOP of each vertex shader
 * that includes this block — GLSL rejects uniform declarations after functions.
 *
 *   #define PATH_GROWTH_MAX 96
 *   uniform int uPathPointCount;
 *   uniform vec3 uPathPoints[PATH_GROWTH_MAX];
 *   uniform float uPathPointProgress[PATH_GROWTH_MAX];
 *   uniform float uPathGrowthStrength;
 *   uniform float uPathGrowthRadius;
 */
export const pathGrowthUniformsGlsl = /* glsl */ `
  #define PATH_GROWTH_MAX 96
  uniform int uPathPointCount;
  uniform vec3 uPathPoints[PATH_GROWTH_MAX];
  uniform float uPathPointProgress[PATH_GROWTH_MAX];
  uniform float uPathGrowthStrength;
  uniform float uPathGrowthRadius;
`

export const pathGrowthGlsl = /* glsl */ `
  vec3 applyPathGrowth(vec3 restPos, vec3 deformedPos, vec3 deformedN) {
    if (uPathPointCount < 1 || uPathGrowthStrength < 1e-6) return deformedPos;
    vec3 n = normalize(restPos);
    float bestLift = 0.0;
    float countF = float(uPathPointCount);
    for (int i = 0; i < PATH_GROWTH_MAX; i++) {
      float slotOn = step(float(i) + 0.5, countF);
      float prog = uPathPointProgress[i];
      float live = slotOn * step(1e-5, prog);
      // Unused slots are (0,0,0) — never normalize them (NaN would kill the mesh).
      vec3 raw = uPathPoints[i];
      float plen = length(raw);
      vec3 p = plen > 1e-5 ? raw / plen : n;
      float radius = max(uPathGrowthRadius * prog, 1e-4);
      float d = length(n - p);
      float t = clamp(d / radius, 0.0, 1.0);
      float w = 1.0 - t;
      w = w * w * (3.0 - 2.0 * w);
      float lift = uPathGrowthStrength * prog * w * live;
      bestLift = max(bestLift, lift);
    }
    return deformedPos + deformedN * bestLift;
  }
`

export const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRimColor;
  uniform float uLow;
  uniform float uHigh;
  uniform float uFresnelPower;
  uniform float uRimStrength;
  uniform float uBodyAlpha;
  uniform float uEdgeAlpha;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  void main() {
    float gradient = smoothstep(uLow, uHigh, vPosition.y);
    vec3 bodyColor = mix(uColorA, uColorB, gradient);

    vec3 normal = normalize(vNormal);
    vec3 worldNormal = normalize(vWorldNormal);
    if (!gl_FrontFacing) {
      normal = -normal;
      worldNormal = -worldNormal;
    }
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);

    float iridescence = smoothstep(-0.45, 0.5, worldNormal.x);
    vec3 rimCool = vec3(0.62, 0.78, 0.78);
    vec3 rim = mix(uRimColor, rimCool, iridescence);

    vec3 key = normalize(vec3(-0.25, 0.45, 0.85));
    float wrap = dot(worldNormal, key) * 0.5 + 0.5;
    float light = 0.86 + 0.14 * wrap;

    vec3 finalColor = (bodyColor + fresnel * rim * uRimStrength) * light;
    float alpha = mix(uBodyAlpha, uEdgeAlpha, fresnel);
    if (!gl_FrontFacing) alpha *= 0.28;

    gl_FragColor = vec4(finalColor, alpha);
    #include <colorspace_fragment>
  }
`

export const individualityFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRimColor;
  uniform float uLow;
  uniform float uHigh;
  uniform float uFresnelPower;
  uniform float uRimStrength;
  uniform float uBodyAlpha;
  uniform float uEdgeAlpha;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uPatternContrast;
  uniform vec3 uAccentColor;
  uniform float uAccentStrength;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}

  void main() {
    float gradient = smoothstep(uLow, uHigh, vPosition.y);
    vec3 bodyColor = mix(uColorA, uColorB, gradient);

    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);
    vec3 samplePosition = vPosition * uNoiseScale + seedOffset;
    float identityNoise = fbm(samplePosition);
    float band = mix(0.38, 0.05, clamp(uPatternContrast, 0.0, 1.0));
    float pattern = smoothstep(0.5 - band, 0.5 + band, identityNoise);
    vec3 identityColor = mix(bodyColor, uAccentColor, pattern * uAccentStrength);

    vec3 normal = normalize(vNormal);
    vec3 worldNormal = normalize(vWorldNormal);
    if (!gl_FrontFacing) {
      normal = -normal;
      worldNormal = -worldNormal;
    }
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);

    float iridescence = smoothstep(-0.45, 0.5, worldNormal.x);
    vec3 rimCool = vec3(0.62, 0.78, 0.78);
    vec3 rim = mix(uRimColor, rimCool, iridescence);

    vec3 key = normalize(vec3(-0.25, 0.45, 0.85));
    float wrap = dot(worldNormal, key) * 0.5 + 0.5;
    float light = 0.86 + 0.14 * wrap;

    vec3 finalColor = (identityColor + fresnel * rim * uRimStrength) * light;
    float alpha = mix(uBodyAlpha, uEdgeAlpha, fresnel);
    if (!gl_FrontFacing) alpha *= 0.28;

    gl_FragColor = vec4(finalColor, alpha);
    #include <colorspace_fragment>
  }
`

export const developmentVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAge;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uSpeed;
  uniform float uPulseSpeed;
  uniform float uDisplacement;
  uniform float uNoiseAmount;
  ${pathGrowthUniformsGlsl}

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${developmentDisplacementGlsl}
  ${macroMorphologyGlsl}
  ${pathGrowthGlsl}

  void main() {
    float lifeEnvelope = smoothstep(0.0, 0.1, uAge) * (1.0 - smoothstep(0.88, 1.0, uAge));
    float noiseGain = mix(0.85, 2.1, clamp(uNoiseAmount * 0.5, 0.0, 1.0));

    // Macro morphology first (AGE + SEED), then existing micro / breath displace.
    vec3 macroPos = macroMorphologyPosition(position);
    vec3 macroN = macroMorphologyNormal(position, normal);
    float amount = developmentDisplaceAmount(macroPos);
    vec3 displacedPosition = macroPos + macroN * amount;

    // Soft normal bend from micro field on the macro surface.
    float e = 0.05;
    vec3 tangent = normalize(cross(macroN, abs(macroN.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 bitangent = normalize(cross(macroN, tangent));
    float dT = (formField(macroPos + tangent * e) - formField(macroPos - tangent * e)) * 0.5;
    float dB = (formField(macroPos + bitangent * e) - formField(macroPos - bitangent * e)) * 0.5;
    float slope = clamp(uDisplacement * lifeEnvelope * noiseGain, 0.0, 0.35);
    vec3 perturbed = normalize(macroN - (tangent * dT + bitangent * dB) * slope);
    vec3 displacedNormal = normalize(mix(macroN, perturbed, 0.5));

    // Path growth: swell along deformed normal (AGE deform stays underneath).
    displacedPosition = applyPathGrowth(position, displacedPosition, displacedNormal);

    vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vPosition = position;
    vViewPosition = viewPosition.xyz;
    vNormal = normalize(normalMatrix * displacedNormal);
    vWorldNormal = normalize(mat3(modelMatrix) * displacedNormal);
    gl_Position = projectionMatrix * viewPosition;
  }
`

/**
 * Scatter growths — same deform as Specimen at each rest sample.
 * Local membrane shape is applied in the deformed tangent frame (no footprint
 * wrap), so growths stay distributed over the whole surface instead of reading
 * as a silhouette-only ring.
 */
export const scatterAttachmentVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAge;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uSpeed;
  uniform float uPulseSpeed;
  uniform float uDisplacement;
  uniform float uNoiseAmount;

  attribute float aAttach;

  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vLocalPos;
  varying vec3 vTangent;
  varying vec3 vSurfaceRest;
  varying float vAttach;
  varying float vViewFacing;

  ${developmentDisplacementGlsl}
  ${macroMorphologyGlsl}

  void main() {
    // Attachment rest sample on the undeformed unit sphere.
    vec3 restOrigin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float instScale = max(length(instanceMatrix[1].xyz), 1e-4);
    mat3 rot = mat3(
      instanceMatrix[0].xyz / instScale,
      instanceMatrix[1].xyz / instScale,
      instanceMatrix[2].xyz / instScale
    );

    vec3 restN = normalize(restOrigin);
    vec3 macroPos = macroMorphologyPosition(restOrigin);
    vec3 macroN = macroMorphologyNormal(restOrigin, restN);
    float amount = developmentDisplaceAmount(macroPos);

    vec3 toCamera = normalize(cameraPosition - macroPos);
    float viewFacing = max(dot(macroN, toCamera), 0.0);
    if (viewFacing < 0.02) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      vViewPosition = vec3(0.0);
      vNormal = vec3(0.0, 1.0, 0.0);
      vTangent = vec3(1.0, 0.0, 0.0);
      vLocalPos = position;
      vSurfaceRest = restOrigin;
      vAttach = 0.0;
      vViewFacing = 0.0;
      return;
    }

    float attach = clamp(aAttach, 0.0, 1.0);
    float glue = pow(attach, 0.72);
    float faceScale = mix(0.9, 1.6, smoothstep(0.05, 0.8, viewFacing));
    vec3 local = position * instScale * faceScale;

    // Twist the lobe frame toward the camera on the front disc so the apron
    // presents area instead of collapsing to a silhouette fringe.
    vec3 sR = rot[0];
    vec3 sU = rot[1];
    vec3 sF = rot[2];
    vec3 cR = cross(sU, toCamera);
    if (dot(cR, cR) < 1e-6) cR = sR;
    cR = normalize(cR);
    vec3 cF = normalize(cross(cR, sU));
    float billboard = smoothstep(0.12, 0.7, viewFacing);
    vec3 R = normalize(mix(sR, cR, billboard));
    vec3 F = normalize(mix(sF, cF, billboard));
    vec3 U = normalize(mix(sU, macroN, 0.35));

    float surfaceBias = 0.018 + 0.016 * (1.0 - glue);
    vec3 worldPosition =
      macroPos + macroN * (amount + surfaceBias) + R * local.x + U * local.y + F * local.z;

    vec3 rigidN = normalize(R * normal.x + U * normal.y + F * normal.z);
    vec3 worldNormal = normalize(mix(rigidN, macroN, glue * 0.55));
    vec3 worldTangent = R;

    vec4 mvPosition = modelViewMatrix * vec4(worldPosition, 1.0);
    vViewPosition = mvPosition.xyz;
    vNormal = normalize(normalMatrix * worldNormal);
    vTangent = normalize(normalMatrix * worldTangent);
    vLocalPos = position;
    vSurfaceRest = restOrigin;
    vAttach = attach;
    vViewFacing = viewFacing;
    gl_Position = projectionMatrix * mvPosition;
  }
`

/**
 * Particle layer — track the body surface with a slight float lift.
 * Study 06 birth (age ≤ 0.02) uses the individuality vertex path (unit sphere);
 * after that, match development / decay displace. Centers sit above the membrane
 * so grit reads as a floating skin, not buried dust.
 */
export const particleSurfaceVertexShader = /* glsl */ `
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
  uniform float uFloatOffset;

  varying float vAlpha;
  varying float vGlow;

  ${developmentDisplacementGlsl}
  ${macroMorphologyGlsl}

  void main() {
    // Rest sample on the undeformed unit sphere (same as Scatter attachment).
    vec3 restOrigin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float instScale = max(length(instanceMatrix[1].xyz), 1e-4);
    vec3 restN = normalize(restOrigin);

    vec3 surfacePos;
    vec3 surfaceN;

    // Match lifecycleVisualStudy: birth body has no macro / micro deform.
    if (uAge <= 0.02) {
      surfacePos = restOrigin;
      surfaceN = restN;
    } else {
      vec3 macroPos = macroMorphologyPosition(restOrigin);
      vec3 macroN = macroMorphologyNormal(restOrigin, restN);
      float amount = developmentDisplaceAmount(macroPos);

      // Match decayVertexShader late warp once the body enters decay.
      float lateWarp = 0.0;
      if (uAge >= 0.8) {
        float warpBias = max(uLateWarp, 0.001);
        float decayNoise = fbm(macroPos * uDecayScale + vec3(uSeed * 0.41, uSeed * 0.17, 2.3));
        float brittle = fbm(macroPos * uDecayScale * 2.8 + vec3(uSeed * 0.11, 5.2, 1.4));
        float warpField = mix(decayNoise, abs(brittle - 0.5) * 2.0, clamp(warpBias - 0.7, 0.0, 1.0));
        float instability = smoothstep(0.65, 1.0, uAge);
        lateWarp = (warpField * 2.0 - 1.0) * uDecayDisplacement * instability * warpBias;
      }

      surfacePos = macroPos + macroN * (amount + lateWarp);
      surfaceN = macroN;
    }

    vec3 toCamera = normalize(cameraPosition - surfacePos);
    float viewFacing = max(dot(surfaceN, toCamera), 0.0);
    if (viewFacing < 0.02) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      vAlpha = 0.0;
      vGlow = 0.0;
      return;
    }

    // Lift so the grit clears the membrane (bottom ≈ uFloatOffset above surface).
    vec3 local = position * instScale;
    float lift = max(uFloatOffset, 0.0) + instScale;
    vec3 worldPosition = surfacePos + surfaceN * lift + local;

    vec4 mvPosition = modelViewMatrix * vec4(worldPosition, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = mix(0.5, 1.0, smoothstep(0.04, 0.5, viewFacing));
    // Soft hotspot toward camera on each grit sphere.
    vGlow = pow(max(dot(normalize(normalMatrix * normal), vec3(0.0, 0.0, 1.0)), 0.0), 1.65);
  }
`

export const particleSurfaceFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uGlowStrength;

  varying float vAlpha;
  varying float vGlow;

  void main() {
    float core = smoothstep(0.08, 0.95, vGlow);
    float halo = pow(vGlow, 0.55);
    float glow = mix(halo * 0.55, 1.0, core);
    float alpha = uOpacity * vAlpha * glow;
    if (alpha < 0.02) discard;

    // Hot white core with a soft luminous falloff.
    vec3 color = uColor * (0.55 + uGlowStrength * (0.7 + core * 1.35));
    gl_FragColor = vec4(color, alpha);
  }
`

export const scatterAttachmentFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRimColor;
  uniform float uBodyAlpha;
  uniform float uFresnelPower;
  uniform float uRimStrength;
  uniform float uAge;
  uniform float uSeed;
  uniform float uDecayStart;
  uniform float uDecayScale;
  uniform float uDiscardThreshold;

  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vLocalPos;
  varying vec3 vTangent;
  varying vec3 vSurfaceRest;
  varying float vAttach;
  varying float vViewFacing;

  ${noiseFunctions}

  void main() {
    vec3 normal = normalize(vNormal);
    if (!gl_FrontFacing) normal = -normal;
    vec3 viewDirection = normalize(-vViewPosition);
    float attach = clamp(vAttach, 0.0, 1.0);
    float free = 1.0 - attach;
    float viewFacing = clamp(vViewFacing, 0.0, 1.0);

    // Length-wise fiber frame (local +X ≈ growth axis).
    vec3 tangent = normalize(vTangent);
    tangent = normalize(tangent - normal * dot(tangent, normal));
    vec3 bitangent = cross(normal, tangent);

    // Fine crystalline microfold — iced membrane, not soft cloth.
    float fiber = sin(vLocalPos.x * 52.0 + vLocalPos.z * 9.0);
    float ridge = sin(vLocalPos.x * 96.0 - vLocalPos.z * 31.0 + 1.4);
    normal = normalize(
      normal +
      (tangent * fiber + bitangent * ridge) * mix(0.02, 0.08, free)
    );

    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);
    float edge = pow(1.0 - facing, mix(2.2, 4.2, free));

    // Frosted glass / thin ice — stay clear-white, barely borrow body tint.
    vec3 ice = vec3(0.96, 0.98, 1.0);
    vec3 glass = vec3(0.88, 0.94, 0.97);
    vec3 bodyTint = mix(uColorA, uColorB, 0.45);
    vec3 membrane = mix(ice, glass, facing * 0.28 + free * 0.2);
    membrane = mix(membrane, bodyTint, 0.04);
    membrane = mix(membrane, uRimColor, fresnel * 0.1);

    // Specular glints along the shard edge.
    vec3 lightDir = normalize(vec3(0.35, 0.7, 0.55));
    vec3 halfDir = normalize(viewDirection + lightDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 48.0);
    float aniso = pow(max(0.0, 1.0 - abs(dot(tangent, halfDir))), 5.5);
    aniso *= 0.2 + 0.8 * free;

    // Subtle length fibers inside the ice.
    float grain = 0.5 + 0.5 * sin(vLocalPos.x * 70.0 + fiber * 0.5);
    membrane = mix(membrane, ice, grain * 0.08 * free);

    vec3 color = membrane;
    color += ice * edge * uRimStrength * 1.25;
    color += vec3(1.0) * fresnel * 0.65;
    color += ice * aniso * 0.4;
    color += vec3(1.0) * spec * 0.6;
    // Tip brightens; root stays slightly denser.
    color = mix(color, ice, free * 0.22);

    // Soft internal glow — luminous ice, not a neon bloom.
    float glow = mix(0.18, 0.42, free) + fresnel * 0.35 + edge * 0.25;
    glow *= mix(0.75, 1.15, viewFacing);
    color += ice * glow * 0.55;
    color += uRimColor * glow * 0.12;

    // Clearer body: face-on stays readable; edges stay luminous.
    float alpha = mix(0.62, 0.9, edge);
    alpha = mix(alpha, mix(0.7, 0.88, fresnel), 0.55);
    alpha *= mix(1.0, 0.78, free * facing * 0.65);
    alpha *= mix(0.55, 1.0, smoothstep(0.02, 0.35, viewFacing));
    alpha = clamp(alpha, 0.0, 0.96);
    if (!gl_FrontFacing) alpha *= 0.55;

    float age = clamp(uAge, 0.0, 1.0);
    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);
    float decayField = fbm(vSurfaceRest * uDecayScale * 0.85 + seedOffset * 1.7);
    float lobe = fbm(vSurfaceRest * uDecayScale * 0.42 + seedOffset * 2.1);
    decayField = mix(decayField, lobe, 0.55);
    float decayProgress = smoothstep(uDecayStart, 1.0, age);
    float edgeCut = 0.28;
    float remaining = smoothstep(decayProgress - edgeCut, decayProgress + edgeCut, decayField);
    remaining = mix(remaining, remaining * remaining, smoothstep(0.9, 0.98, age) * 0.4);
    float bodyExit = 1.0 - smoothstep(0.94, 0.995, age);
    alpha *= remaining * bodyExit;
    if (alpha < uDiscardThreshold) discard;

    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`

export const developmentFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRimColor;
  uniform float uLow;
  uniform float uHigh;
  uniform float uFresnelPower;
  uniform float uRimStrength;
  uniform float uBodyAlpha;
  uniform float uEdgeAlpha;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uPatternContrast;
  uniform vec3 uAccentColor;
  uniform float uAccentStrength;
  uniform float uTime;
  uniform float uAge;
  uniform float uSpeed;
  uniform float uNoiseAmount;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}

  void main() {
    float ageScale = mix(0.75, 1.45, clamp(uAge, 0.0, 1.0));
    float gradient = smoothstep(uLow, uHigh, vPosition.y);
    vec3 bodyColor = mix(uColorA, uColorB, gradient);
    bodyColor = mix(bodyColor, mix(uColorA, uColorB, 0.7), uAge * 0.32);

    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);
    vec3 samplePosition = vPosition * uNoiseScale * ageScale + seedOffset + vec3(0.0, uTime * uSpeed, 0.0);
    float identityNoise = fbm(samplePosition);
    float detailNoise = fbm(samplePosition * 2.2 + vec3(3.1, uTime * uSpeed * 0.4, 1.4));

    float contrast = clamp(uPatternContrast + uNoiseAmount * 0.12, 0.0, 1.0);
    float band = mix(0.4, 0.04, contrast);
    float pattern = smoothstep(0.5 - band, 0.5 + band, identityNoise);
    float detailPattern = smoothstep(0.42, 0.72, detailNoise);

    float noiseGain = clamp(uNoiseAmount, 0.0, 2.0);
    vec3 agedAccent = mix(uAccentColor, uRimColor, uAge * 0.35);
    vec3 identityColor = mix(bodyColor, agedAccent, pattern * uAccentStrength * noiseGain);
    identityColor = mix(identityColor, agedAccent, detailPattern * uAccentStrength * noiseGain * 0.55);

    vec3 normal = normalize(vNormal);
    vec3 worldNormal = normalize(vWorldNormal);
    if (!gl_FrontFacing) {
      normal = -normal;
      worldNormal = -worldNormal;
    }
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);

    float iridescence = smoothstep(-0.45, 0.5, worldNormal.x);
    vec3 rimCool = vec3(0.62, 0.78, 0.78);
    vec3 rim = mix(uRimColor, rimCool, iridescence);

    vec3 key = normalize(vec3(-0.25, 0.45, 0.85));
    float wrap = dot(worldNormal, key) * 0.5 + 0.5;
    float light = 0.86 + 0.14 * wrap;

    vec3 finalColor = (identityColor + fresnel * rim * uRimStrength) * light;
    float alpha = mix(uBodyAlpha, uEdgeAlpha, fresnel);
    if (!gl_FrontFacing) alpha *= 0.28;

    gl_FragColor = vec4(finalColor, alpha);
    #include <colorspace_fragment>
  }
`

export const decayVertexShader = /* glsl */ `
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
  ${pathGrowthUniformsGlsl}

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${developmentDisplacementGlsl}
  ${macroMorphologyGlsl}
  ${pathGrowthGlsl}

  void main() {
    float lifeEnvelope = smoothstep(0.0, 0.1, uAge) * (1.0 - smoothstep(0.88, 1.0, uAge));
    float noiseGain = mix(0.85, 2.1, clamp(uNoiseAmount * 0.5, 0.0, 1.0));
    float warpBias = max(uLateWarp, 0.001);

    vec3 macroPos = macroMorphologyPosition(position);
    vec3 macroN = macroMorphologyNormal(position, normal);

    float breath = developmentDisplaceAmount(macroPos);

    float decayNoise = fbm(macroPos * uDecayScale + vec3(uSeed * 0.41, uSeed * 0.17, 2.3));
    // Crystal bias uses a harder ridge so late warp feels brittle, not rubbery.
    float brittle = fbm(macroPos * uDecayScale * 2.8 + vec3(uSeed * 0.11, 5.2, 1.4));
    float warpField = mix(decayNoise, abs(brittle - 0.5) * 2.0, clamp(warpBias - 0.7, 0.0, 1.0));
    float instability = smoothstep(0.65, 1.0, uAge);
    float lateWarp = (warpField * 2.0 - 1.0) * uDecayDisplacement * instability * warpBias;

    vec3 displacedPosition = macroPos + macroN * (breath + lateWarp);

    float e = 0.05;
    vec3 tangent = normalize(cross(macroN, abs(macroN.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 bitangent = normalize(cross(macroN, tangent));
    float dT = (formField(macroPos + tangent * e) - formField(macroPos - tangent * e)) * 0.5;
    float dB = (formField(macroPos + bitangent * e) - formField(macroPos - bitangent * e)) * 0.5;
    float slope = clamp(uDisplacement * lifeEnvelope * noiseGain + uDecayDisplacement * instability * warpBias, 0.0, 0.4);
    vec3 perturbed = normalize(macroN - (tangent * dT + bitangent * dB) * slope);
    vec3 displacedNormal = normalize(mix(macroN, perturbed, 0.5));

    displacedPosition = applyPathGrowth(position, displacedPosition, displacedNormal);

    vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vPosition = position;
    vViewPosition = viewPosition.xyz;
    vNormal = normalize(normalMatrix * displacedNormal);
    vWorldNormal = normalize(mat3(modelMatrix) * displacedNormal);
    gl_Position = projectionMatrix * viewPosition;
  }
`

export const decayFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRimColor;
  uniform float uLow;
  uniform float uHigh;
  uniform float uFresnelPower;
  uniform float uRimStrength;
  uniform float uBodyAlpha;
  uniform float uEdgeAlpha;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uPatternContrast;
  uniform vec3 uAccentColor;
  uniform float uAccentStrength;
  uniform float uTime;
  uniform float uAge;
  uniform float uSpeed;
  uniform float uNoiseAmount;
  uniform float uDecayScale;
  uniform float uDecayStart;
  uniform float uEdgeSoftness;
  uniform float uBoundaryWidth;
  uniform float uDiscardThreshold;
  uniform vec3 uDecayAccent;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}

  void main() {
    float ageScale = mix(0.75, 1.45, clamp(uAge, 0.0, 1.0));
    float gradient = smoothstep(uLow, uHigh, vPosition.y);
    vec3 bodyColor = mix(uColorA, uColorB, gradient);
    bodyColor = mix(bodyColor, mix(uColorA, uColorB, 0.7), uAge * 0.32);

    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);
    vec3 samplePosition = vPosition * uNoiseScale * ageScale + seedOffset + vec3(0.0, uTime * uSpeed * 0.35, 0.0);
    float identityNoise = fbm(samplePosition);
    float detailNoise = fbm(samplePosition * 2.2 + vec3(3.1, uTime * uSpeed * 0.15, 1.4));

    float contrast = clamp(uPatternContrast + uNoiseAmount * 0.12, 0.0, 1.0);
    float band = mix(0.4, 0.04, contrast);
    float pattern = smoothstep(0.5 - band, 0.5 + band, identityNoise);
    float detailPattern = smoothstep(0.42, 0.72, detailNoise);

    float noiseGain = clamp(uNoiseAmount, 0.0, 2.0);
    vec3 agedAccent = mix(uAccentColor, uRimColor, uAge * 0.35);
    vec3 identityColor = mix(bodyColor, agedAccent, pattern * uAccentStrength * noiseGain);
    identityColor = mix(identityColor, agedAccent, detailPattern * uAccentStrength * noiseGain * 0.55);

    vec3 normal = normalize(vNormal);
    vec3 worldNormal = normalize(vWorldNormal);
    if (!gl_FrontFacing) {
      normal = -normal;
      worldNormal = -worldNormal;
    }
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);

    float iridescence = smoothstep(-0.45, 0.5, worldNormal.x);
    vec3 rimCool = vec3(0.62, 0.78, 0.78);
    vec3 rim = mix(uRimColor, rimCool, iridescence);

    vec3 key = normalize(vec3(-0.25, 0.45, 0.85));
    float wrap = dot(worldNormal, key) * 0.5 + 0.5;
    float light = 0.86 + 0.14 * wrap;

    vec3 baseColor = (identityColor + fresnel * rim * uRimStrength) * light;
    float baseAlpha = mix(uBodyAlpha, uEdgeAlpha, fresnel);

    // Stable decay field — larger soft openings, not fine salt-and-pepper.
    float decayField = fbm(vPosition * uDecayScale * 0.85 + seedOffset * 1.7);
    float lobe = fbm(vPosition * uDecayScale * 0.42 + seedOffset * 2.1);
    decayField = mix(decayField, lobe, 0.55);
    float decayProgress = smoothstep(uDecayStart, 1.0, uAge);
    float edge = max(uEdgeSoftness, 0.001);
    float remaining = smoothstep(decayProgress - edge, decayProgress + edge, decayField);
    remaining = mix(remaining, remaining * remaining, smoothstep(0.9, 0.98, uAge) * 0.4);

    float boundaryWidth = max(uBoundaryWidth, 0.001);
    float boundary = 1.0 - smoothstep(0.0, boundaryWidth, abs(decayField - decayProgress));
    boundary *= smoothstep(0.0, 0.08, decayProgress);

    vec3 finalColor = mix(uDecayAccent, baseColor, remaining);
    finalColor = mix(finalColor, uDecayAccent, boundary * 0.45);
    float alpha = baseAlpha * remaining;
    if (!gl_FrontFacing) alpha *= 0.28;

    if (alpha < uDiscardThreshold) discard;

    gl_FragColor = vec4(finalColor, alpha);
    #include <colorspace_fragment>
  }
`

export const traceBodyFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRimColor;
  uniform float uLow;
  uniform float uHigh;
  uniform float uFresnelPower;
  uniform float uRimStrength;
  uniform float uBodyAlpha;
  uniform float uEdgeAlpha;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uPatternContrast;
  uniform vec3 uAccentColor;
  uniform float uAccentStrength;
  uniform float uTime;
  uniform float uAge;
  uniform float uSpeed;
  uniform float uNoiseAmount;
  uniform float uDecayScale;
  uniform float uDecayStart;
  uniform float uEdgeSoftness;
  uniform float uBoundaryWidth;
  uniform float uDiscardThreshold;
  uniform vec3 uDecayAccent;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}

  void main() {
    float ageScale = mix(0.75, 1.45, clamp(uAge, 0.0, 1.0));
    float gradient = smoothstep(uLow, uHigh, vPosition.y);
    vec3 bodyColor = mix(uColorA, uColorB, gradient);
    bodyColor = mix(bodyColor, mix(uColorA, uColorB, 0.7), uAge * 0.32);

    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);
    vec3 samplePosition = vPosition * uNoiseScale * ageScale + seedOffset + vec3(0.0, uTime * uSpeed * 0.2, 0.0);
    float identityNoise = fbm(samplePosition);
    float detailNoise = fbm(samplePosition * 2.2 + vec3(3.1, uTime * uSpeed * 0.1, 1.4));

    float contrast = clamp(uPatternContrast + uNoiseAmount * 0.12, 0.0, 1.0);
    float band = mix(0.4, 0.04, contrast);
    float pattern = smoothstep(0.5 - band, 0.5 + band, identityNoise);
    float detailPattern = smoothstep(0.42, 0.72, detailNoise);

    float noiseGain = clamp(uNoiseAmount, 0.0, 2.0);
    vec3 agedAccent = mix(uAccentColor, uRimColor, uAge * 0.35);
    vec3 identityColor = mix(bodyColor, agedAccent, pattern * uAccentStrength * noiseGain);
    identityColor = mix(identityColor, agedAccent, detailPattern * uAccentStrength * noiseGain * 0.55);

    vec3 normal = normalize(vNormal);
    vec3 worldNormal = normalize(vWorldNormal);
    if (!gl_FrontFacing) {
      normal = -normal;
      worldNormal = -worldNormal;
    }
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);

    float iridescence = smoothstep(-0.45, 0.5, worldNormal.x);
    vec3 rimCool = vec3(0.62, 0.78, 0.78);
    vec3 rim = mix(uRimColor, rimCool, iridescence);

    vec3 key = normalize(vec3(-0.25, 0.45, 0.85));
    float wrap = dot(worldNormal, key) * 0.5 + 0.5;
    float light = 0.86 + 0.14 * wrap;

    vec3 baseColor = (identityColor + fresnel * rim * uRimStrength) * light;
    float baseAlpha = mix(uBodyAlpha, uEdgeAlpha, fresnel);

    float decayField = fbm(vPosition * uDecayScale * 0.85 + seedOffset * 1.7);
    float lobe = fbm(vPosition * uDecayScale * 0.42 + seedOffset * 2.1);
    decayField = mix(decayField, lobe, 0.55);
    float decayProgress = smoothstep(uDecayStart, 1.0, uAge);
    float edge = max(uEdgeSoftness, 0.001);
    float remaining = smoothstep(decayProgress - edge, decayProgress + edge, decayField);
    remaining = mix(remaining, remaining * remaining, smoothstep(0.9, 0.98, uAge) * 0.4);

    float boundaryWidth = max(uBoundaryWidth, 0.001);
    float boundary = 1.0 - smoothstep(0.0, boundaryWidth, abs(decayField - decayProgress));
    boundary *= smoothstep(0.0, 0.08, decayProgress);

    // Living body exits completely near death so only the trace remains.
    float bodyPresence = 1.0 - smoothstep(0.94, 0.995, uAge);

    vec3 finalColor = mix(uDecayAccent, baseColor, remaining);
    finalColor = mix(finalColor, uDecayAccent, boundary * 0.45);
    float alpha = baseAlpha * remaining * bodyPresence;
    if (!gl_FrontFacing) alpha *= 0.28;

    if (alpha < uDiscardThreshold) discard;

    gl_FragColor = vec4(finalColor, alpha);
    #include <colorspace_fragment>
  }
`

export const traceVertexShader = /* glsl */ `
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uDecayScale;
  uniform float uDecayDisplacement;
  uniform float uPreservedAge;
  uniform float uAge;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}
  ${macroMorphologyGlsl}

  void main() {
    // Frozen geometry — macro locked to preserved age, plus static late-life imprint.
    float freezeAge = max(uPreservedAge, uAge);
    vec3 macroPos = macroMorphologyPositionAt(position, freezeAge);
    vec3 macroN = macroMorphologyNormalAt(position, normal, freezeAge);

    float decayNoise = fbm(macroPos * uDecayScale + vec3(uSeed * 0.41, uSeed * 0.17, 2.3));
    float instability = smoothstep(0.65, 1.0, freezeAge);
    float lateWarp = (decayNoise * 2.0 - 1.0) * uDecayDisplacement * instability * 0.85;
    vec3 displacedPosition = macroPos + macroN * lateWarp;

    vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vPosition = position;
    vViewPosition = viewPosition.xyz;
    vNormal = normalize(normalMatrix * macroN);
    vWorldNormal = normalize(mat3(modelMatrix) * macroN);
    gl_Position = projectionMatrix * viewPosition;
  }
`

export const traceFragmentShader = /* glsl */ `
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uDecayScale;
  uniform float uDecayStart;
  uniform float uAge;
  uniform float uPreservedAge;
  uniform float uTraceScale;
  uniform float uTraceThreshold;
  uniform float uInternalTrace;
  uniform float uRimTrace;
  uniform float uBoundaryTrace;
  uniform float uTraceOpacity;
  uniform float uTraceFresnelPower;
  uniform float uPersistence;
  uniform vec3 uTraceColor;
  uniform vec3 uAccentColor;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}

  void main() {
    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);

    float identityField = fbm(vPosition * uTraceScale + seedOffset);
    float sparseTrace = smoothstep(uTraceThreshold, 1.0, identityField);

    float detailField = fbm(vPosition * uTraceScale * 2.4 + seedOffset * 1.3 + vec3(2.1, 0.0, 4.7));
    float filament = smoothstep(0.55, 0.88, detailField) * (1.0 - smoothstep(0.88, 1.0, detailField));

    vec3 normal = normalize(vNormal);
    if (!gl_FrontFacing) normal = -normal;
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float rimTrace = pow(1.0 - facing, uTraceFresnelPower);

    float decayField = fbm(vPosition * uDecayScale + seedOffset * 1.7);
    float decayProgress = smoothstep(uDecayStart, 1.0, max(uAge, uPreservedAge));
    float boundary = 1.0 - smoothstep(0.0, 0.08, abs(decayField - decayProgress));

    float traceMask = max(sparseTrace * uInternalTrace, rimTrace * uRimTrace);
    traceMask = max(traceMask, filament * uInternalTrace * 0.65);
    traceMask = max(traceMask, boundary * uBoundaryTrace);

    // Residue emerges near death and can linger by persistence.
    float reveal = smoothstep(0.7, 0.94, uAge);
    float linger = mix(reveal, max(reveal, smoothstep(0.85, 1.0, uPreservedAge)), uPersistence);
    float alpha = traceMask * uTraceOpacity * linger;

    if (alpha < 0.02) discard;

    // Pale, desaturated archive color — not a living neon glow.
    vec3 paleAccent = mix(uTraceColor, uAccentColor, 0.22);
    vec3 finalColor = mix(uTraceColor, paleAccent, sparseTrace * 0.35 + rimTrace * 0.2);
    finalColor *= 0.92 + rimTrace * 0.08;

    gl_FragColor = vec4(finalColor, alpha);
    #include <colorspace_fragment>
  }
`

export const materialFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRimColor;
  uniform float uLow;
  uniform float uHigh;
  uniform float uFresnelPower;
  uniform float uRimStrength;
  uniform float uBodyAlpha;
  uniform float uEdgeAlpha;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform vec3 uAccentColor;
  uniform float uAccentStrength;
  uniform float uAge;
  uniform float uMaterialMode;
  uniform float uIridescence;
  uniform float uInternalContrast;
  uniform float uTransmission;
  uniform vec3 uTransmitTint;
  uniform vec3 uIridSecondary;
  uniform float uDecayScale;
  uniform float uDecayStart;
  uniform float uEdgeSoftness;
  uniform float uBoundaryWidth;
  uniform float uDiscardThreshold;
  uniform vec3 uDecayAccent;
  uniform float uThinningRate;
  uniform float uFractureSharpness;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}

  void main() {
    float age = clamp(uAge, 0.0, 1.0);
    float birth = smoothstep(0.0, 0.06, age);
    float interiorReveal = smoothstep(0.1, 0.38, age);
    float thinEdge = smoothstep(0.32, 0.52, age);
    float holeOpen = smoothstep(uDecayStart, 0.9, age);
    float fragment = smoothstep(0.72, 0.94, age);
    float bodyExit = 1.0 - smoothstep(0.94, 0.995, age);

    float thinning = clamp(uThinningRate, 0.0, 1.0);
    float fracture = clamp(uFractureSharpness, 0.0, 1.0);

    float gradient = smoothstep(uLow, uHigh, vPosition.y);
    vec3 bodyColor = mix(uColorA, uColorB, gradient);
    bodyColor = mix(bodyColor, vec3(0.86, 0.82, 0.88), 0.14 * (1.0 - uTransmission));

    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);
    float identityNoise = fbm(vPosition * uNoiseScale + seedOffset);
    float contrast = clamp(uInternalContrast, 0.0, 1.0);
    float band = mix(0.36, 0.05, contrast);
    float pattern = smoothstep(0.5 - band, 0.5 + band, identityNoise);

    vec3 pink = vec3(0.9, 0.74, 0.8);
    vec3 cyan = vec3(0.7, 0.84, 0.88);
    vec3 interior = mix(pink, cyan, identityNoise);
    interior = mix(interior, uAccentColor, 0.35);
    float accentGain = mix(0.15, 1.0, interiorReveal) * mix(0.55, 1.05, contrast);
    bodyColor = mix(bodyColor, interior, pattern * uAccentStrength * accentGain);

    float bodyAlpha = uBodyAlpha;
    float fresnelPower = uFresnelPower;
    float rimStrength = uRimStrength;
    float iridescence = uIridescence;
    float transmission = uTransmission;
    float hybridMask = 0.0;

    if (uMaterialMode > 1.5) {
      hybridMask = smoothstep(0.32, 0.68, identityNoise);
      bodyAlpha = mix(0.86, 0.4, hybridMask);
      fresnelPower = mix(2.4, 4.2, hybridMask);
      rimStrength = mix(0.35, 0.78, hybridMask);
      iridescence = mix(0.28, 0.72, hybridMask);
      transmission = mix(0.12, 0.58, hybridMask);
      bodyAlpha = mix(bodyAlpha, uBodyAlpha, 0.35);
      fresnelPower = mix(fresnelPower, uFresnelPower, 0.35);
      iridescence = mix(iridescence, uIridescence, 0.4);
      transmission = mix(transmission, uTransmission, 0.4);
    }

    // Pre-hole thinning: membrane leans on opacity loss; crystal keeps shell longer.
    float thinMix = mix(0.35, 0.85, thinning);
    bodyAlpha *= birth * mix(1.0, 1.0 - thinMix * 0.55, thinEdge);
    fresnelPower = mix(fresnelPower, fresnelPower + mix(0.6, 1.6, thinning), thinEdge);
    rimStrength = mix(rimStrength, min(1.0, rimStrength + 0.28), thinEdge);
    iridescence = mix(iridescence, min(1.0, iridescence + 0.22), thinEdge);
    transmission = mix(transmission, min(0.85, transmission + 0.2 + thinning * 0.2), thinEdge) * mix(0.75, 1.0, birth);

    vec3 normal = normalize(vNormal);
    vec3 worldNormal = normalize(vWorldNormal);
    if (!gl_FrontFacing) {
      normal = -normal;
      worldNormal = -worldNormal;
    }
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, fresnelPower);

    vec3 transmitted = mix(bodyColor, uTransmitTint, facing * transmission);
    vec3 surfaceColor = mix(bodyColor, transmitted, transmission);

    float irid = fresnel * iridescence;
    vec3 rim = mix(uRimColor, uIridSecondary, 0.5 + 0.5 * worldNormal.x);
    float crystalBias = hybridMask;
    if (uMaterialMode > 0.5 && uMaterialMode < 1.5) crystalBias = 1.0;
    rim = mix(rim, vec3(0.88, 0.94, 0.96), crystalBias * 0.22);

    vec3 key = normalize(vec3(-0.25, 0.45, 0.85));
    float light = 0.88 + 0.12 * max(dot(worldNormal, key), 0.0);

    vec3 finalColor = (surfaceColor + rim * rimStrength * (fresnel + irid * 0.85)) * light;
    float edgeAlpha = min(1.0, bodyAlpha + 0.12 + fresnel * 0.22 * transmission);
    float alpha = mix(bodyAlpha, edgeAlpha, fresnel);
    if (!gl_FrontFacing) alpha *= 0.28;

    // Shared decay field; material bias reshapes soft dissolve vs brittle fracture.
    float decayField = fbm(vPosition * uDecayScale * 0.85 + seedOffset * 1.7);
    float lobe = fbm(vPosition * uDecayScale * 0.45 + seedOffset * 2.1);
    decayField = mix(decayField, lobe, mix(0.55, 0.25, fracture));

    float softEdge = max(mix(uEdgeSoftness, uEdgeSoftness * 1.35, thinning), 0.001);
    float hardEdge = max(mix(0.04, 0.012, fracture), 0.001);
    float softRemain = smoothstep(holeOpen - softEdge, holeOpen + softEdge, decayField);
    float hardRemain = smoothstep(holeOpen - hardEdge, holeOpen + hardEdge, decayField);

    float ridge = abs(decayField - 0.5) * 2.0;
    float shard = smoothstep(0.55, 0.92, ridge);
    float crystalRemain = max(hardRemain, shard * hardRemain * mix(0.35, 1.0, fracture));
    crystalRemain = mix(crystalRemain, crystalRemain * crystalRemain, fragment * 0.4);

    float membraneRemain = mix(1.0, softRemain, holeOpen);
    membraneRemain = mix(membraneRemain, membraneRemain * membraneRemain, fragment * 0.55);

    float localFracture = fracture;
    float localThinning = thinning;
    if (uMaterialMode > 1.5) {
      // Hybrid: milky zones dissolve; crystalline patches fracture and linger.
      localFracture = mix(0.12, 0.9, hybridMask);
      localThinning = mix(0.8, 0.28, hybridMask);
      softRemain = smoothstep(holeOpen - softEdge, holeOpen + softEdge, decayField);
      hardRemain = smoothstep(holeOpen - hardEdge, holeOpen + hardEdge, decayField);
      crystalRemain = max(hardRemain, shard * hardRemain);
      membraneRemain = mix(1.0, softRemain, holeOpen);
    }

    float remaining = mix(membraneRemain, crystalRemain, localFracture);
    remaining = mix(1.0, remaining, holeOpen);

    float thin = 1.0 - holeOpen * localThinning;
    alpha *= thin * remaining * bodyExit;

    // Soft regions opening expose interior structure (hybrid especially).
    float exposed = (1.0 - remaining) * holeOpen * mix(0.15, 0.55, 1.0 - localFracture);
    finalColor = mix(finalColor, interior, exposed * 0.45);

    float boundaryWidth = max(mix(uBoundaryWidth, uBoundaryWidth * 0.55, localFracture), 0.001);
    float boundary = 1.0 - smoothstep(0.0, boundaryWidth, abs(decayField - holeOpen));
    boundary *= smoothstep(0.02, 0.12, holeOpen);

    finalColor = mix(mix(finalColor, uDecayAccent, 0.3), finalColor, remaining);
    finalColor = mix(finalColor, mix(uDecayAccent, rim, 0.4), boundary * mix(0.35, 0.55, localFracture));

    if (alpha < uDiscardThreshold) discard;

    gl_FragColor = vec4(finalColor, alpha);
    #include <colorspace_fragment>
  }
`

/** Study 09 — one mesh: living form + interior glow + foil fracture (no nested body). */
export const layeredVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAge;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uSpeed;
  uniform float uPulseSpeed;
  uniform float uDisplacement;
  uniform float uNoiseAmount;
  uniform float uFoil;
  uniform float uDecayScale;
  uniform float uDecayDisplacement;
  uniform float uLateWarp;
  ${pathGrowthUniformsGlsl}

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying float vFoilMask;

  ${developmentDisplacementGlsl}
  ${macroMorphologyGlsl}
  ${pathGrowthGlsl}

  float foilField(vec3 p) {
    float large = fbm(p * uNoiseScale * 0.55 + vec3(uSeed * 0.21, 2.4, 0.7));
    float crisp = fbm(p * uNoiseScale * 3.4 + vec3(uSeed * 0.09, 5.1, 1.3));
    float mask = smoothstep(0.42, 0.78, large);
    mask *= smoothstep(0.35, -0.55, p.y);
    float ageOpen = mix(0.55, 1.25, smoothstep(0.35, 0.85, clamp(uAge, 0.0, 1.0)));
    return clamp(mask * mix(0.35, 1.0, crisp) * ageOpen, 0.0, 1.0);
  }

  void main() {
    float age = clamp(uAge, 0.0, 1.0);
    float lifeEnvelope = smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(0.88, 1.0, age));
    float noiseGain = mix(0.85, 2.1, clamp(uNoiseAmount * 0.5, 0.0, 1.0));
    float warpBias = max(uLateWarp, 0.001);

    vec3 macroPos = macroMorphologyPosition(position);
    vec3 macroN = macroMorphologyNormal(position, normal);

    float foilMask = foilField(macroPos);
    vFoilMask = foilMask;

    float breath = developmentDisplaceAmount(macroPos);
    float foilWarp = (fbm(macroPos * uNoiseScale * 4.2 + vec3(uSeed * 0.33, 1.1, 2.8)) * 2.0 - 1.0);
    foilWarp *= uDisplacement * 0.85 * uFoil * foilMask;

    float decayNoise = fbm(macroPos * uDecayScale + vec3(uSeed * 0.41, uSeed * 0.17, 2.3));
    float brittle = fbm(macroPos * uDecayScale * 2.8 + vec3(uSeed * 0.11, 5.2, 1.4));
    float warpField = mix(decayNoise, abs(brittle - 0.5) * 2.0, clamp(foilMask, 0.0, 1.0));
    float instability = smoothstep(0.55, 1.0, age);
    float lateWarp = (warpField * 2.0 - 1.0) * uDecayDisplacement * instability * warpBias;

    vec3 displacedPosition = macroPos + macroN * (breath + foilWarp + lateWarp);

    float e = 0.05;
    vec3 tangent = normalize(cross(macroN, abs(macroN.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 bitangent = normalize(cross(macroN, tangent));
    float dT = (formField(macroPos + tangent * e) - formField(macroPos - tangent * e)) * 0.5;
    float dB = (formField(macroPos + bitangent * e) - formField(macroPos - bitangent * e)) * 0.5;
    float slope = clamp(
      uDisplacement * lifeEnvelope * noiseGain + uFoil * foilMask * 0.2 + uDecayDisplacement * instability,
      0.0,
      0.45
    );
    vec3 perturbed = normalize(macroN - (tangent * dT + bitangent * dB) * slope);
    vec3 displacedNormal = normalize(mix(macroN, perturbed, mix(0.5, 0.72, max(foilMask * uFoil, instability * 0.5))));

    displacedPosition = applyPathGrowth(position, displacedPosition, displacedNormal);

    vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vPosition = position;
    vViewPosition = viewPosition.xyz;
    vNormal = normalize(normalMatrix * displacedNormal);
    vWorldNormal = normalize(mat3(modelMatrix) * displacedNormal);
    gl_Position = projectionMatrix * viewPosition;
  }
`

export const layeredFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRimColor;
  uniform float uLow;
  uniform float uHigh;
  uniform float uFresnelPower;
  uniform float uRimStrength;
  uniform float uBodyAlpha;
  uniform float uEdgeAlpha;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uPatternContrast;
  uniform vec3 uAccentColor;
  uniform float uAccentStrength;
  uniform float uTime;
  uniform float uAge;
  uniform float uSpeed;
  uniform float uNoiseAmount;
  uniform float uGlow;
  uniform float uFoil;
  uniform float uIridescence;
  uniform float uGrain;
  uniform vec3 uGlowCyan;
  uniform vec3 uGlowPink;
  uniform vec3 uGlowYellow;
  uniform vec3 uFoilColor;
  uniform float uDecayScale;
  uniform float uDecayStart;
  uniform float uEdgeSoftness;
  uniform float uBoundaryWidth;
  uniform float uDiscardThreshold;
  uniform vec3 uDecayAccent;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying float vFoilMask;

  ${noiseFunctions}

  float hash13(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  void main() {
    float age = clamp(uAge, 0.0, 1.0);
    float glowGain = clamp(uGlow, 0.0, 1.5);
    float foilAmt = clamp(uFoil, 0.0, 1.5);
    float grainAmt = clamp(uGrain, 0.0, 1.0);
    float iridAmt = clamp(uIridescence, 0.0, 1.0);

    float midLife = smoothstep(0.12, 0.4, age) * (1.0 - smoothstep(0.65, 0.9, age) * 0.45);
    float lateFoil = mix(1.0, 1.35, smoothstep(0.5, 0.88, age));
    float holeOpen = smoothstep(uDecayStart, 0.9, age);
    float fragment = smoothstep(0.72, 0.94, age);
    float bodyExit = 1.0 - smoothstep(0.94, 0.995, age);

    float gradient = smoothstep(uLow, uHigh, vPosition.y);
    vec3 bodyColor = mix(uColorA, uColorB, gradient);
    bodyColor = mix(bodyColor, vec3(0.9, 0.88, 0.92), 0.18);

    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);
    vec3 samplePosition = vPosition * uNoiseScale + seedOffset + vec3(0.0, uTime * uSpeed * 0.35, 0.0);
    float identityNoise = fbm(samplePosition);
    float deepNoise = fbm(samplePosition * 0.55 + vec3(2.1, uTime * uSpeed * 0.12, 0.4));
    float detailNoise = fbm(samplePosition * 2.4 + vec3(3.1, 1.4, uTime * uSpeed * 0.2));

    float contrast = clamp(uPatternContrast + uNoiseAmount * 0.1, 0.0, 1.0);
    float band = mix(0.38, 0.05, contrast);
    float pattern = smoothstep(0.5 - band, 0.5 + band, identityNoise);

    float t = clamp(deepNoise * 0.65 + identityNoise * 0.35 + vPosition.x * 0.08, 0.0, 1.0);
    vec3 glow = mix(uGlowCyan, uGlowPink, smoothstep(0.1, 0.55, t));
    glow = mix(glow, uGlowYellow, smoothstep(0.45, 0.9, t + detailNoise * 0.15));
    glow = mix(glow, uAccentColor, 0.18);

    vec3 normal = normalize(vNormal);
    vec3 worldNormal = normalize(vWorldNormal);
    if (!gl_FrontFacing) {
      normal = -normal;
      worldNormal = -worldNormal;
    }
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);

    float interior = (1.0 - facing) * 0.55 + pattern * 0.45;
    interior = clamp(interior * midLife * glowGain, 0.0, 1.0);
    bodyColor = mix(bodyColor, glow, interior * 0.92);
    bodyColor = mix(bodyColor, glow * 1.12, detailNoise * interior * 0.28);

    float irid = fresnel * iridAmt;
    vec3 rim = mix(uRimColor, mix(uGlowCyan, uGlowPink, 0.5 + 0.5 * worldNormal.x), iridAmt * 0.65);
    vec3 key = normalize(vec3(-0.25, 0.5, 0.85));
    float light = 0.86 + 0.16 * max(dot(worldNormal, key), 0.0);
    float gloss = pow(max(dot(reflect(-key, worldNormal), viewDirection), 0.0), 26.0);

    vec3 flesh = (bodyColor + rim * uRimStrength * (fresnel + irid * 0.8)) * light;
    flesh += glow * interior * 0.22;
    flesh += vec3(1.0) * gloss * mix(0.06, 0.14, iridAmt);

    float foilMask = clamp(vFoilMask * foilAmt * lateFoil, 0.0, 1.0);
    float foilDetail = fbm(vPosition * uNoiseScale * 5.5 + seedOffset * 1.8);
    float foilRidge = 1.0 - abs(foilDetail * 2.0 - 1.0);
    vec3 foilBase = mix(uFoilColor, uFoilColor * 0.55, foilDetail);
    float foilSpec = pow(max(dot(reflect(-key, worldNormal), viewDirection), 0.0), 48.0);
    vec3 foilLit = foilBase * (0.55 + 0.45 * max(dot(worldNormal, key), 0.0));
    foilLit += vec3(0.85, 0.88, 0.92) * foilSpec * mix(0.35, 0.85, foilRidge);
    foilLit = mix(foilLit, flesh * 0.35, 0.08);

    vec3 finalColor = mix(flesh, foilLit, foilMask);

    float speck = hash13(floor(vPosition * 92.0 + seedOffset * 3.0));
    float grainMask = smoothstep(0.55, 0.95, fresnel) * grainAmt;
    finalColor += vec3(0.95, 0.97, 1.0) * speck * grainMask * 0.35;
    finalColor = mix(finalColor, finalColor * (0.88 + speck * 0.24), grainMask * 0.55);

    float alpha = mix(uBodyAlpha, uEdgeAlpha, fresnel);
    alpha = mix(alpha, min(1.0, alpha + 0.18), foilMask * 0.7);
    alpha *= mix(0.7, 1.0, smoothstep(0.0, 0.1, age));
    if (!gl_FrontFacing) alpha *= 0.28;

    // Gradual mortality — same shared decay field as Studies 04 / 06.
    float decayField = fbm(vPosition * uDecayScale * 0.85 + seedOffset * 1.7);
    float lobe = fbm(vPosition * uDecayScale * 0.42 + seedOffset * 2.1);
    decayField = mix(decayField, lobe, 0.5);

    float softEdge = max(uEdgeSoftness, 0.001);
    float hardEdge = max(mix(0.045, 0.014, foilMask), 0.001);
    float softRemain = smoothstep(holeOpen - softEdge, holeOpen + softEdge, decayField);
    float hardRemain = smoothstep(holeOpen - hardEdge, holeOpen + hardEdge, decayField);
    float ridge = abs(decayField - 0.5) * 2.0;
    float shard = smoothstep(0.55, 0.92, ridge);
    float foilRemain = max(hardRemain, shard * hardRemain * mix(0.4, 1.0, foilMask));
    foilRemain = mix(foilRemain, foilRemain * foilRemain, fragment * 0.35);

    float fleshRemain = mix(1.0, softRemain, holeOpen);
    fleshRemain = mix(fleshRemain, fleshRemain * fleshRemain, fragment * 0.5);

    // Soft flesh dissolves first; foil patches fracture and linger.
    float remaining = mix(fleshRemain, foilRemain, clamp(foilMask * 0.85, 0.0, 1.0));
    remaining = mix(1.0, remaining, holeOpen);

    float thinning = mix(0.72, 0.38, foilMask);
    float thin = 1.0 - holeOpen * thinning;
    alpha *= thin * remaining * bodyExit;

    float exposed = (1.0 - remaining) * holeOpen * mix(0.2, 0.5, 1.0 - foilMask);
    finalColor = mix(finalColor, glow, exposed * 0.4);

    float boundaryWidth = max(mix(uBoundaryWidth, uBoundaryWidth * 0.6, foilMask), 0.001);
    float boundary = 1.0 - smoothstep(0.0, boundaryWidth, abs(decayField - holeOpen));
    boundary *= smoothstep(0.02, 0.12, holeOpen);
    finalColor = mix(mix(finalColor, uDecayAccent, 0.28), finalColor, remaining);
    finalColor = mix(finalColor, mix(uDecayAccent, rim, 0.35), boundary * mix(0.3, 0.5, foilMask));

    if (alpha < uDiscardThreshold) discard;

    gl_FragColor = vec4(finalColor, alpha);
    #include <colorspace_fragment>
  }
`

