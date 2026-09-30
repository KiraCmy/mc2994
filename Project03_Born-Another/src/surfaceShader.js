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
  uniform float uLateWarp;

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
    float warpBias = max(uLateWarp, 0.001);

    float field = formField(position);
    float breath = (field * 0.92 + (pulse - 0.5) * 0.18) * uDisplacement * lifeEnvelope * noiseGain;

    float decayNoise = fbm(position * uDecayScale + vec3(uSeed * 0.41, uSeed * 0.17, 2.3));
    // Crystal bias uses a harder ridge so late warp feels brittle, not rubbery.
    float brittle = fbm(position * uDecayScale * 2.8 + vec3(uSeed * 0.11, 5.2, 1.4));
    float warpField = mix(decayNoise, abs(brittle - 0.5) * 2.0, clamp(warpBias - 0.7, 0.0, 1.0));
    float instability = smoothstep(0.65, 1.0, uAge);
    float lateWarp = (warpField * 2.0 - 1.0) * uDecayDisplacement * instability * warpBias;

    vec3 displacedPosition = position + normal * (breath + lateWarp);

    float e = 0.05;
    vec3 tangent = normalize(cross(normal, abs(normal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 bitangent = normalize(cross(normal, tangent));
    float dT = (formField(position + tangent * e) - formField(position - tangent * e)) * 0.5;
    float dB = (formField(position + bitangent * e) - formField(position - bitangent * e)) * 0.5;
    float slope = clamp(uDisplacement * lifeEnvelope * noiseGain + uDecayDisplacement * instability * warpBias, 0.0, 0.4);
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

    // Stable decay field — larger soft openings, not fine salt-and-pepper.
    float decayField = fbm(vPosition * uDecayScale * 0.85 + seedOffset * 1.7);
    float lobe = fbm(vPosition * uDecayScale * 0.42 + seedOffset * 2.1);
    decayField = mix(decayField, lobe, 0.55);
    float decayProgress = smoothstep(uDecayStart, 1.0, uAge);
    float edge = max(uEdgeSoftness, 0.001);
    float remaining = smoothstep(decayProgress - edge, decayProgress + edge, decayField);
    remaining = mix(remaining, remaining * remaining, smoothstep(0.7, 0.92, uAge) * 0.55);

    float boundaryWidth = max(uBoundaryWidth, 0.001);
    float boundary = 1.0 - smoothstep(0.0, boundaryWidth, abs(decayField - decayProgress));
    boundary *= smoothstep(0.0, 0.08, decayProgress);

    vec3 finalColor = mix(uDecayAccent, baseColor, remaining);
    finalColor = mix(finalColor, uDecayAccent, boundary * 0.45);
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

    float decayField = fbm(vPosition * uDecayScale * 0.85 + seedOffset * 1.7);
    float lobe = fbm(vPosition * uDecayScale * 0.42 + seedOffset * 2.1);
    decayField = mix(decayField, lobe, 0.55);
    float decayProgress = smoothstep(uDecayStart, 1.0, uAge);
    float edge = max(uEdgeSoftness, 0.001);
    float remaining = smoothstep(decayProgress - edge, decayProgress + edge, decayField);
    remaining = mix(remaining, remaining * remaining, smoothstep(0.7, 0.92, uAge) * 0.55);

    float boundaryWidth = max(uBoundaryWidth, 0.001);
    float boundary = 1.0 - smoothstep(0.0, boundaryWidth, abs(decayField - decayProgress));
    boundary *= smoothstep(0.0, 0.08, decayProgress);

    // Living body exits completely near death so only the trace remains.
    float bodyPresence = 1.0 - smoothstep(0.82, 0.98, uAge);

    vec3 finalColor = mix(uDecayAccent, baseColor, remaining);
    finalColor = mix(finalColor, uDecayAccent, boundary * 0.45);
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
    float bodyExit = 1.0 - smoothstep(0.88, 0.98, age);

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

export const outerShellFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRimColor;
  uniform vec3 uInnerTintA;
  uniform vec3 uInnerTintB;
  uniform float uLow;
  uniform float uHigh;
  uniform float uFresnelPower;
  uniform float uRimStrength;
  uniform float uBodyAlpha;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uAge;
  uniform float uAccentStrength;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}

  void main() {
    float age = clamp(uAge, 0.0, 1.0);
    float gradient = smoothstep(uLow, uHigh, vPosition.y);
    vec3 bodyColor = mix(uColorA, uColorB, gradient);
    bodyColor = mix(bodyColor, vec3(0.96, 0.95, 0.97), 0.22);

    // Bleed core palette into the shell so layers feel continuous.
    vec3 coreBleed = mix(uInnerTintA, uInnerTintB, gradient * 0.5 + 0.25);
    bodyColor = mix(bodyColor, coreBleed, 0.28);

    bodyColor = mix(bodyColor, mix(uColorB, vec3(0.8, 0.86, 0.92), 0.45), smoothstep(0.55, 0.95, age) * 0.28);

    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);
    float identityNoise = fbm(vPosition * uNoiseScale * 0.75 + seedOffset);
    float frost = smoothstep(0.3, 0.78, identityNoise);
    bodyColor = mix(bodyColor, mix(bodyColor, coreBleed, 0.4), frost * uAccentStrength * 0.2);

    vec3 normal = normalize(vNormal);
    vec3 worldNormal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);

    vec3 rim = mix(uRimColor, mix(uInnerTintB, vec3(1.0), 0.35), 0.35);
    vec3 key = normalize(vec3(-0.2, 0.55, 0.9));
    float light = 0.94 + 0.08 * max(dot(worldNormal, key), 0.0);
    float gloss = pow(max(dot(reflect(-key, worldNormal), viewDirection), 0.0), 30.0);

    vec3 finalColor = bodyColor * light;
    finalColor += rim * uRimStrength * fresnel * 0.65;
    finalColor += vec3(1.0) * gloss * 0.14;

    float decayField = fbm(vPosition * uNoiseScale * 1.05 + seedOffset * 1.6);
    float decayProgress = smoothstep(0.55, 0.98, age);
    float remaining = smoothstep(decayProgress - 0.18, decayProgress + 0.16, decayField);
    float tear = smoothstep(0.7, 1.0, age);
    remaining *= mix(1.0, smoothstep(0.12, 0.5, decayField), tear);

    // Softer shell — more haze than hard glass object.
    float alpha = mix(uBodyAlpha * 0.08, min(0.48, uBodyAlpha + 0.2), fresnel);
    alpha *= remaining;
    alpha *= mix(0.6, 1.0, smoothstep(0.0, 0.12, age));
    alpha *= 1.0 - smoothstep(0.92, 1.0, age) * 0.8;

    if (alpha < 0.03) discard;

    gl_FragColor = vec4(finalColor, alpha);
    #include <colorspace_fragment>
  }
`

export const innerCoreFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uShellTintA;
  uniform vec3 uShellTintB;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uAge;
  uniform float uInternalContrast;
  uniform float uBodyAlpha;
  uniform float uFresnelPower;
  uniform float uRimStrength;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  ${noiseFunctions}

  void main() {
    float age = clamp(uAge, 0.0, 1.0);
    vec3 seedOffset = vec3(uSeed * 0.137, uSeed * 0.219, uSeed * 0.311);

    float fieldA = fbm(vPosition * uNoiseScale * 0.5 + seedOffset);
    float fieldB = fbm(vPosition * uNoiseScale * 0.9 + seedOffset * 1.4 + vec3(1.7, 0.6, 4.2));
    float detail = fbm(vPosition * uNoiseScale * 1.55 + seedOffset * 0.75);
    float contrast = clamp(uInternalContrast, 0.0, 1.0);

    float t = fieldA * mix(0.5, 0.8, contrast) + fieldB * 0.4;
    t = clamp(t + vPosition.x * 0.1 - vPosition.y * 0.05, 0.0, 1.0);

    vec3 cyan = uColorA;
    vec3 pink = uColorB;
    vec3 violet = mix(cyan, pink, 0.45) * vec3(0.92, 0.86, 1.05);
    violet = mix(violet, vec3(0.78, 0.62, 0.92), 0.28);

    vec3 core = mix(cyan, violet, smoothstep(0.05, 0.45, t));
    core = mix(core, pink, smoothstep(0.35, 0.85, t));
    core = mix(core, mix(pink, cyan, detail), 0.1);
    // Soften toward shell palette so the core doesn't read as a separate object.
    vec3 shellWash = mix(uShellTintA, uShellTintB, 0.5);
    core = mix(core, shellWash, 0.18);
    core *= mix(1.04, 1.14, fieldB);

    float reveal = smoothstep(0.55, 0.78, age);
    float fade = smoothstep(0.78, 1.0, age);
    core = mix(core, core * 1.08, reveal * (1.0 - fade));
    core = mix(core, mix(core, vec3(0.76, 0.8, 0.88), 0.45), fade * 0.45);

    vec3 normal = normalize(vNormal);
    vec3 worldNormal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);

    vec3 rim = mix(pink * 0.9, cyan, 0.4 + 0.25 * worldNormal.x);
    vec3 key = normalize(vec3(-0.15, 0.4, 0.85));
    float light = 0.93 + 0.09 * max(dot(worldNormal, key), 0.0);

    vec3 finalColor = core * light + rim * uRimStrength * fresnel * 0.32;

    float decayField = fbm(vPosition * uNoiseScale * 0.75 + seedOffset * 1.2);
    float decayProgress = smoothstep(0.74, 1.0, age);
    float remaining = smoothstep(decayProgress - 0.22, decayProgress + 0.2, decayField);

    float alpha = mix(uBodyAlpha * 0.58, min(0.82, uBodyAlpha + 0.08), fresnel * 0.2);
    alpha *= mix(0.5, 1.0, smoothstep(0.0, 0.14, age));
    alpha *= mix(1.0, remaining, smoothstep(0.72, 0.88, age));
    alpha *= 1.0 - smoothstep(0.94, 1.0, age);

    if (alpha < 0.028) discard;

    gl_FragColor = vec4(finalColor, alpha);
    #include <colorspace_fragment>
  }
`

export const outerLayeredVertexShader = /* glsl */ `
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

  // Shared low-frequency body — same domain as the core for one silhouette.
  float sharedBody(vec3 p) {
    float large = fbm(p * 0.72 + vec3(uSeed * 0.09, 1.1, uTime * uSpeed * 0.12));
    float medium = fbm(p * 1.15 + vec3(0.0, uTime * uSpeed * 0.32, uSeed * 0.17));
    return (large * 2.0 - 1.0) * 0.7 + (medium * 2.0 - 1.0) * 0.35;
  }

  // Outer adds only mild surface texture on top of the shared body.
  float outerField(vec3 p) {
    float base = sharedBody(p);
    float skin = fbm(p * uNoiseScale * 1.6 + vec3(uTime * uSpeed * 0.4, uSeed * 0.22, 2.4));
    float ridged = 1.0 - abs(skin * 2.0 - 1.0);
    return base * 0.78 + (ridged * 2.0 - 1.0) * 0.22 + (skin * 2.0 - 1.0) * 0.12;
  }

  void main() {
    float age = clamp(uAge, 0.0, 1.0);
    float pulse = sin(uTime * uPulseSpeed + uSeed * 0.01) * 0.5 + 0.5;
    float growth = smoothstep(0.0, 0.16, age) * mix(1.0, 1.2, smoothstep(0.2, 0.55, age));
    float fracture = smoothstep(0.58, 0.94, age);
    float noiseGain = mix(0.9, 1.7, clamp(uNoiseAmount * 0.5, 0.0, 1.0));

    float field = outerField(position);
    float amount = (field * 0.92 + (pulse - 0.5) * 0.06) * uDisplacement * growth * noiseGain;
    amount += field * uDisplacement * 0.45 * fracture * noiseGain;
    vec3 displacedPosition = position + normal * amount;

    float e = 0.055;
    vec3 tangent = normalize(cross(normal, abs(normal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 bitangent = normalize(cross(normal, tangent));
    float dT = (outerField(position + tangent * e) - outerField(position - tangent * e)) * 0.5;
    float dB = (outerField(position + bitangent * e) - outerField(position - bitangent * e)) * 0.5;
    float slope = clamp(uDisplacement * (growth + fracture * 0.5) * noiseGain * 0.55, 0.0, 0.4);
    vec3 perturbed = normalize(normal - (tangent * dT + bitangent * dB) * slope);
    vec3 displacedNormal = normalize(mix(normal, perturbed, mix(0.4, 0.58, fracture)));

    vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vPosition = position;
    vViewPosition = viewPosition.xyz;
    vNormal = normalize(normalMatrix * displacedNormal);
    vWorldNormal = normalize(mat3(modelMatrix) * displacedNormal);
    gl_Position = projectionMatrix * viewPosition;
  }
`

export const innerLayeredVertexShader = /* glsl */ `
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

  // Same shared body domain as outer — keeps the object continuous.
  float sharedBody(vec3 p) {
    float large = fbm(p * 0.72 + vec3(uSeed * 0.09, 1.1, uTime * uSpeed * 0.12));
    float medium = fbm(p * 1.15 + vec3(0.0, uTime * uSpeed * 0.32, uSeed * 0.17));
    return (large * 2.0 - 1.0) * 0.7 + (medium * 2.0 - 1.0) * 0.35;
  }

  float innerField(vec3 p) {
    float base = sharedBody(p);
    float soft = fbm(p * uNoiseScale * 0.9 + vec3(uSeed * 0.14, uTime * uSpeed * 0.28, 1.8));
    return base * 0.82 + (soft * 2.0 - 1.0) * 0.28;
  }

  void main() {
    float age = clamp(uAge, 0.0, 1.0);
    float pulse = sin(uTime * uPulseSpeed + uSeed * 0.01) * 0.5 + 0.5;
    float swell = smoothstep(0.04, 0.32, age) * (1.0 - smoothstep(0.8, 1.0, age) * 0.75);
    swell = mix(0.45, 1.15, swell);
    float lateCollapse = smoothstep(0.82, 1.0, age);
    float noiseGain = mix(0.9, 1.55, clamp(uNoiseAmount * 0.5, 0.0, 1.0));

    float field = innerField(position);
    float amount = (field * 0.94 + (pulse - 0.5) * 0.07) * uDisplacement * swell * noiseGain;
    amount -= abs(field) * uDisplacement * 0.4 * lateCollapse;
    vec3 displacedPosition = position + normal * amount;

    float e = 0.055;
    vec3 tangent = normalize(cross(normal, abs(normal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 bitangent = normalize(cross(normal, tangent));
    float dT = (innerField(position + tangent * e) - innerField(position - tangent * e)) * 0.5;
    float dB = (innerField(position + bitangent * e) - innerField(position - bitangent * e)) * 0.5;
    float slope = clamp(uDisplacement * swell * noiseGain * 0.5, 0.0, 0.36);
    vec3 perturbed = normalize(normal - (tangent * dT + bitangent * dB) * slope);
    vec3 displacedNormal = normalize(mix(normal, perturbed, 0.45));

    vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vPosition = position;
    vViewPosition = viewPosition.xyz;
    vNormal = normalize(normalMatrix * displacedNormal);
    vWorldNormal = normalize(mat3(modelMatrix) * displacedNormal);
    gl_Position = projectionMatrix * viewPosition;
  }
`

