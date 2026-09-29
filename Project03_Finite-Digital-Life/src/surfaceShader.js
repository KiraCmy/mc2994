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
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);

    float iridescence = smoothstep(-0.45, 0.5, worldNormal.x);
    vec3 rimCool = vec3(0.62, 0.78, 0.78);
    vec3 rim = mix(uRimColor, rimCool, iridescence);

    vec3 key = normalize(vec3(-0.25, 0.45, 0.85));
    float light = 0.9 + 0.1 * max(dot(worldNormal, key), 0.0);

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
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);

    float iridescence = smoothstep(-0.45, 0.5, worldNormal.x);
    vec3 rimCool = vec3(0.62, 0.78, 0.78);
    vec3 rim = mix(uRimColor, rimCool, iridescence);

    vec3 key = normalize(vec3(-0.25, 0.45, 0.85));
    float light = 0.9 + 0.1 * max(dot(worldNormal, key), 0.0);

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

  void main() {
    float movingNoise = fbm(position * uNoiseScale + vec3(0.0, uTime * uSpeed, uSeed * 0.137));
    float detailNoise = fbm(position * uNoiseScale * 2.15 + vec3(uTime * uSpeed * 0.65, uSeed * 0.29, 1.7));
    float pulse = sin(uTime * uPulseSpeed + uSeed * 0.01) * 0.5 + 0.5;
    float lifeEnvelope = smoothstep(0.0, 0.12, uAge) * (1.0 - smoothstep(0.82, 1.0, uAge));
    float noiseGain = mix(0.75, 1.45, clamp(uNoiseAmount * 0.5, 0.0, 1.0));
    float amount = (movingNoise * 0.55 + detailNoise * 0.3 + pulse * 0.35) * uDisplacement * lifeEnvelope * noiseGain;
    vec3 displacedPosition = position + normal * amount;

    vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vPosition = position;
    vViewPosition = viewPosition.xyz;
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
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
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(normal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);

    float iridescence = smoothstep(-0.45, 0.5, worldNormal.x);
    vec3 rimCool = vec3(0.62, 0.78, 0.78);
    vec3 rim = mix(uRimColor, rimCool, iridescence);

    vec3 key = normalize(vec3(-0.25, 0.45, 0.85));
    float light = 0.9 + 0.1 * max(dot(worldNormal, key), 0.0);

    vec3 finalColor = (identityColor + fresnel * rim * uRimStrength) * light;
    float alpha = mix(uBodyAlpha, uEdgeAlpha, fresnel);

    gl_FragColor = vec4(finalColor, alpha);
    #include <colorspace_fragment>
  }
`
