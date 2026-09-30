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
const noiseFunctions = /* glsl */ `
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

  void main() {
    float pulse = sin(uTime * uPulseSpeed + uSeed * 0.01) * 0.5 + 0.5;
    float lifeEnvelope = smoothstep(0.0, 0.1, uAge) * (1.0 - smoothstep(0.88, 1.0, uAge));
    float noiseGain = mix(0.85, 2.1, clamp(uNoiseAmount * 0.5, 0.0, 1.0));

    float field = formField(position);
    float amount = (field * 0.92 + (pulse - 0.5) * 0.18) * uDisplacement * lifeEnvelope * noiseGain;
    vec3 displacedPosition = position + normal * amount;

    // Soft normal bend — strong perturbation caused muddy terminator bands.
    float e = 0.05;
    vec3 tangent = normalize(cross(normal, abs(normal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 bitangent = normalize(cross(normal, tangent));
    float dT = (formField(position + tangent * e) - formField(position - tangent * e)) * 0.5;
    float dB = (formField(position + bitangent * e) - formField(position - bitangent * e)) * 0.5;
    float slope = clamp(uDisplacement * lifeEnvelope * noiseGain, 0.0, 0.35);
    vec3 perturbed = normalize(normal - (tangent * dT + bitangent * dB) * slope);
    vec3 displacedNormal = normalize(mix(normal, perturbed, 0.5));

    vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vPosition = position;
    vViewPosition = viewPosition.xyz;
    vNormal = normalize(normalMatrix * displacedNormal);
    vWorldNormal = normalize(mat3(modelMatrix) * displacedNormal);
    gl_Position = projectionMatrix * viewPosition;
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

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}

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

    float field = formField(position);
    float breath = (field * 0.92 + (pulse - 0.5) * 0.18) * uDisplacement * lifeEnvelope * noiseGain;

    float decayNoise = fbm(position * uDecayScale + vec3(uSeed * 0.41, uSeed * 0.17, 2.3));
    float instability = smoothstep(0.65, 1.0, uAge);
    float lateWarp = (decayNoise * 2.0 - 1.0) * uDecayDisplacement * instability;

    vec3 displacedPosition = position + normal * (breath + lateWarp);

    float e = 0.05;
    vec3 tangent = normalize(cross(normal, abs(normal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 bitangent = normalize(cross(normal, tangent));
    float dT = (formField(position + tangent * e) - formField(position - tangent * e)) * 0.5;
    float dB = (formField(position + bitangent * e) - formField(position - bitangent * e)) * 0.5;
    float slope = clamp(uDisplacement * lifeEnvelope * noiseGain + uDecayDisplacement * instability, 0.0, 0.35);
    vec3 perturbed = normalize(normal - (tangent * dT + bitangent * dB) * slope);
    vec3 displacedNormal = normalize(mix(normal, perturbed, 0.5));

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

    // Stable decay field — identity-bound holes, not rapid animation.
    float decayField = fbm(vPosition * uDecayScale + seedOffset * 1.7);
    float decayProgress = smoothstep(uDecayStart, 1.0, uAge);
    float edge = max(uEdgeSoftness, 0.001);
    float remaining = smoothstep(decayProgress - edge, decayProgress + edge, decayField);

    float boundaryWidth = max(uBoundaryWidth, 0.001);
    float boundary = 1.0 - smoothstep(0.0, boundaryWidth, abs(decayField - decayProgress));
    boundary *= smoothstep(0.0, 0.08, decayProgress);

    vec3 finalColor = mix(uDecayAccent, baseColor, remaining);
    finalColor = mix(finalColor, uDecayAccent, boundary * 0.55);
    float alpha = baseAlpha * remaining;

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

    float decayField = fbm(vPosition * uDecayScale + seedOffset * 1.7);
    float decayProgress = smoothstep(uDecayStart, 1.0, uAge);
    float edge = max(uEdgeSoftness, 0.001);
    float remaining = smoothstep(decayProgress - edge, decayProgress + edge, decayField);

    float boundaryWidth = max(uBoundaryWidth, 0.001);
    float boundary = 1.0 - smoothstep(0.0, boundaryWidth, abs(decayField - decayProgress));
    boundary *= smoothstep(0.0, 0.08, decayProgress);

    // Living body exits completely near death so only the trace remains.
    float bodyPresence = 1.0 - smoothstep(0.82, 0.98, uAge);

    vec3 finalColor = mix(uDecayAccent, baseColor, remaining);
    finalColor = mix(finalColor, uDecayAccent, boundary * 0.55);
    float alpha = baseAlpha * remaining * bodyPresence;

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

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}

  void main() {
    // Frozen geometry — no living time motion, only a static late-life imprint.
    float decayNoise = fbm(position * uDecayScale + vec3(uSeed * 0.41, uSeed * 0.17, 2.3));
    float instability = smoothstep(0.65, 1.0, uPreservedAge);
    float lateWarp = (decayNoise * 2.0 - 1.0) * uDecayDisplacement * instability * 0.85;
    vec3 displacedPosition = position + normal * lateWarp;

    vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vPosition = position;
    vViewPosition = viewPosition.xyz;
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
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
