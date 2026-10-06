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
 * AGE-driven low-frequency body morphology — separate from Study 03 micro noise.
 * Requires: noiseFunctions (valueNoise), uniforms uAge + uSeed.
 * Export kept free of micro displace so scatter can later reuse position/normal.
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

  float macroSoftLobe(vec3 n, vec3 axis, float power) {
    return pow(max(0.0, dot(n, axis)), power);
  }

  /**
   * Object-space offset for rest position p (typically on the unit sphere).
   * Birth ≈ 0; development elongates; maturity opens 2–3 lobes; decay collapses.
   */
  vec3 macroMorphologyOffsetAt(vec3 p, float age) {
    float a = clamp(age, 0.0, 1.0);
    float rad = max(length(p), 1e-4);
    vec3 n = p / rad;

    // Smooth overlapping stage envelopes (not hard cuts).
    float develop = smoothstep(0.02, 0.3, a) * (1.0 - smoothstep(0.7, 0.95, a));
    float mature = smoothstep(0.2, 0.48, a) * (1.0 - smoothstep(0.65, 0.9, a));
    float collapse = smoothstep(0.52, 0.78, a);

    vec3 axisA = macroSeedDir(0.0);
    vec3 axisB = macroSeedDir(1.0);
    // Third lobe axis from the first two — stays deterministic and non-aligned.
    vec3 axisC = normalize(cross(axisA, axisB) + axisB * 0.42 + axisA * 0.18);

    // Very low-frequency variation (not surface noise scale).
    float slow = valueNoise(n * 1.05 + vec3(uSeed * 0.061, 0.27, 1.4));
    float slow2 = valueNoise(n * 0.72 + vec3(1.9, uSeed * 0.044, 0.55));

    // Development: gentle elongation + soft asymmetry.
    float along = dot(n, axisA);
    vec3 developOffset =
      axisA * (along * 0.11 + (slow - 0.5) * 0.04) * develop
      + n * (slow2 - 0.5) * 0.035 * develop;

    // Maturity: 2–3 large readable lobes (weights from seed).
    float w1 = 0.5 + 0.2 * sin(uSeed * 0.019);
    float w2 = 0.4 + 0.2 * cos(uSeed * 0.023);
    float w3 = 0.32 + 0.18 * sin(uSeed * 0.029 + 1.2);
    float lobe =
      macroSoftLobe(n, axisA, 2.15) * w1
      + macroSoftLobe(n, axisB, 2.35) * w2
      + macroSoftLobe(n, axisC, 2.55) * w3;
    vec3 matureOffset =
      n * lobe * 0.24 * mature
      + (axisB * (slow - 0.42) * 0.05 + axisC * (slow2 - 0.5) * 0.04) * mature;

    // Instability / decay: uneven compression and partial collapse.
    float hollow = 1.0 - lobe * 0.55 + (slow - 0.5) * 0.45;
    float crush = pow(clamp(hollow, 0.0, 1.4), 1.35);
    vec3 collapseOffset =
      -n * crush * 0.2 * collapse
      - axisA * (slow2 - 0.5) * 0.07 * collapse
      + axisB * (slow - 0.5) * 0.045 * collapse;

    return developOffset + matureOffset + collapseOffset;
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
    float e = 0.045;
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
 * Micro / breath only — macro morphology lives in macroMorphologyGlsl.
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
    return (field * 0.92 + (pulse - 0.5) * 0.18) * uDisplacement * lifeEnvelope * noiseGain;
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

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${developmentDisplacementGlsl}
  ${macroMorphologyGlsl}

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

    vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vPosition = position;
    vViewPosition = viewPosition.xyz;
    vNormal = normalize(normalMatrix * displacedNormal);
    vWorldNormal = normalize(mat3(modelMatrix) * displacedNormal);
    gl_Position = projectionMatrix * viewPosition;
  }
`

/** Scatter membranes: footprint wrapped to base surface; same Study 03 displace. */
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

  ${developmentDisplacementGlsl}

  void main() {
    // Attachment rest sample on the undeformed base surface.
    vec3 restOrigin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float radius = length(restOrigin);
    mat3 basis = mat3(instanceMatrix);

    // Split local offset into surface footprint (XZ) and lift (Y / normal).
    vec3 footOffset = basis * vec3(position.x, 0.0, position.z);
    vec3 liftOffset = basis * vec3(0.0, position.y, 0.0);

    // Wrap the footprint onto the sphere so the apron follows host curvature
    // instead of sitting on a flat tangent plane.
    vec3 surfaceRest = normalize(restOrigin + footOffset) * radius;
    vec3 surfaceN = normalize(surfaceRest);

    // Near the root, stay glued to the surface; free edge keeps its lift.
    float attach = clamp(aAttach, 0.0, 1.0);
    float glue = pow(attach, 0.72);
    vec3 restPos = surfaceRest + liftOffset * (1.0 - glue * 0.92);

    // Same Study 03 displacement as the base mesh, sampled on the footprint.
    float amount = developmentDisplaceAmount(surfaceRest);
    vec3 worldPosition = restPos + surfaceN * amount;

    // Rigid free orientation for shading, blended toward surface normal at root.
    vec3 rigidN = normalize(basis * normal);
    vec3 worldNormal = normalize(mix(rigidN, surfaceN, glue * 0.85));

    // Local +X is the vane growth axis — used for grain and anisotropic rim.
    vec3 worldTangent = normalize(basis * vec3(1.0, 0.0, 0.0));

    vec4 mvPosition = modelViewMatrix * vec4(worldPosition, 1.0);
    vViewPosition = mvPosition.xyz;
    vNormal = normalize(normalMatrix * worldNormal);
    vTangent = normalize(normalMatrix * worldTangent);
    vLocalPos = position;
    vSurfaceRest = surfaceRest;
    vAttach = attach;
    gl_Position = projectionMatrix * mvPosition;
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

  ${noiseFunctions}

  void main() {
    vec3 normal = normalize(vNormal);
    if (!gl_FrontFacing) normal = -normal;
    vec3 viewDirection = normalize(-vViewPosition);
    float attach = clamp(vAttach, 0.0, 1.0);
    float free = 1.0 - attach;

    // Stable tangent frame along the feather vane (local +X).
    vec3 tangent = normalize(vTangent);
    tangent = normalize(tangent - normal * dot(tangent, normal));
    vec3 bitangent = cross(normal, tangent);

    // Soft low-frequency fold shading — keep large surfaces readable.
    float n1 = sin(vLocalPos.x * 28.0 + vLocalPos.z * 14.0);
    float n2 = sin(vLocalPos.x * 46.0 - vLocalPos.z * 22.0 + 1.1);
    normal = normalize(
      normal +
      (tangent * n1 + bitangent * n2) * 0.045 * free
    );

    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);

    // Fake thickness: root denser, free edge thinner / more transmitting.
    float thickness = mix(0.35, 1.0, attach);
    float transmit = pow(1.0 - facing, 1.35) * (1.0 - thickness) * mix(0.12, 0.4, free);
    vec3 interior = mix(uColorA, uColorB, 0.62);
    interior = mix(interior, uRimColor, 0.2);

    vec3 body = mix(uColorA, uColorB, facing * 0.55 + fresnel * 0.25);
    body = mix(body, interior, transmit * 0.32);

    // Thin-film iridescence on grazing angles.
    float film = fresnel * fresnel;
    vec3 irid = mix(vec3(0.72, 0.9, 0.96), vec3(0.96, 0.78, 0.88), facing);
    irid = mix(irid, uRimColor, 0.4);

    // Soft anisotropic highlight along the lobe.
    vec3 lightDir = normalize(vec3(0.4, 0.75, 0.5));
    vec3 halfDir = normalize(viewDirection + lightDir);
    float aniso = pow(max(0.0, 1.0 - abs(dot(tangent, halfDir))), 4.0);
    aniso *= 0.25 + 0.55 * free;

    vec3 color = body;
    color += uRimColor * fresnel * uRimStrength;
    color += irid * film * 0.28 * (0.4 + 0.6 * free);
    color += uRimColor * aniso * 0.14;

    float alpha = mix(uBodyAlpha * 0.96, min(1.0, uBodyAlpha + 0.04), fresnel);
    alpha *= mix(1.0, 0.88, transmit);
    // Soften the rooted apron so it dissolves into the host surface.
    alpha *= mix(1.0, 0.78, pow(attach, 1.25));
    if (!gl_FrontFacing) alpha *= 0.22;

    // Study 06-style decay: open along the shared seed field, then exit with the body.
    float age = clamp(uAge, 0.0, 1.0);
    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);
    float decayField = fbm(vSurfaceRest * uDecayScale * 0.85 + seedOffset * 1.7);
    float lobe = fbm(vSurfaceRest * uDecayScale * 0.42 + seedOffset * 2.1);
    decayField = mix(decayField, lobe, 0.55);
    float decayProgress = smoothstep(uDecayStart, 1.0, age);
    // Wide soft threshold so dying opens gradually, not as a hard cut.
    float edge = 0.28;
    float remaining = smoothstep(decayProgress - edge, decayProgress + edge, decayField);
    remaining = mix(remaining, remaining * remaining, smoothstep(0.9, 0.98, age) * 0.4);
    // Final exit only at the very end — dying itself is the gradual remaining field.
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

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}
  ${macroMorphologyGlsl}

  float formField(vec3 p) {
    float moving = fbm(p * uNoiseScale + vec3(0.0, uTime * uSpeed, uSeed * 0.137));
    float detail = fbm(p * uNoiseScale * 2.35 + vec3(uTime * uSpeed * 0.7, uSeed * 0.29, 1.7));
    float ridges = fbm(p * uNoiseScale * 0.55 + vec3(uSeed * 0.08, 4.1, uTime * uSpeed * 0.22));
    return (moving * 2.0 - 1.0) * 0.7
         + (detail * 2.0 - 1.0) * 0.45
         + (ridges * 2.0 - 1.0) * 0.35;
  }

  void main() {
    float pulse = sin(uTime * uPulseSpeed + uSeed * 0.01) * 0.5 + 0.5;
    float lifeEnvelope = smoothstep(0.0, 0.1, uAge) * (1.0 - smoothstep(0.88, 1.0, uAge));
    float noiseGain = mix(0.85, 2.1, clamp(uNoiseAmount * 0.5, 0.0, 1.0));
    float warpBias = max(uLateWarp, 0.001);

    vec3 macroPos = macroMorphologyPosition(position);
    vec3 macroN = macroMorphologyNormal(position, normal);

    float field = formField(macroPos);
    float breath = (field * 0.92 + (pulse - 0.5) * 0.18) * uDisplacement * lifeEnvelope * noiseGain;

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

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying float vFoilMask;

  ${noiseFunctions}
  ${macroMorphologyGlsl}

  float formField(vec3 p) {
    float moving = fbm(p * uNoiseScale + vec3(0.0, uTime * uSpeed, uSeed * 0.137));
    float detail = fbm(p * uNoiseScale * 2.35 + vec3(uTime * uSpeed * 0.7, uSeed * 0.29, 1.7));
    float ridges = fbm(p * uNoiseScale * 0.55 + vec3(uSeed * 0.08, 4.1, uTime * uSpeed * 0.22));
    return (moving * 2.0 - 1.0) * 0.7
         + (detail * 2.0 - 1.0) * 0.45
         + (ridges * 2.0 - 1.0) * 0.35;
  }

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
    float pulse = sin(uTime * uPulseSpeed + uSeed * 0.01) * 0.5 + 0.5;
    float lifeEnvelope = smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(0.88, 1.0, age));
    float noiseGain = mix(0.85, 2.1, clamp(uNoiseAmount * 0.5, 0.0, 1.0));
    float warpBias = max(uLateWarp, 0.001);

    vec3 macroPos = macroMorphologyPosition(position);
    vec3 macroN = macroMorphologyNormal(position, normal);

    float field = formField(macroPos);
    float foilMask = foilField(macroPos);
    vFoilMask = foilMask;

    float breath = (field * 0.92 + (pulse - 0.5) * 0.18) * uDisplacement * lifeEnvelope * noiseGain;
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

