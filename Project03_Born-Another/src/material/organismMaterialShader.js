/**
 * Organism material — Study 01: solid core + translucent shell. Pairs with any
 * body vertex shader (they all emit vPosition / vViewPosition / vNormal /
 * vWorldNormal), so it keeps the lifecycle deformation exactly.
 *
 * One surface, two read-outs blended by facing: face-on pixels show a lit
 * core seen through a thin glass skin; grazing pixels are the skin itself.
 * Both share the same normal and body palette so they read as one organism.
 */
export const organismMaterialFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRimColor;
  uniform float uLow;
  uniform float uHigh;
  uniform float uCoreOpacity;
  uniform float uShellTransmission;
  uniform float uRoughness;
  uniform float uIor;
  uniform vec3 uKeyLightDir;
  uniform vec3 uFillLightDir;

  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;

  // Procedural studio environment (world space). studioEnv is the soft
  // backdrop; studioLights are the bright panels whose reflections wrap the
  // form as broad curved highlights. Roughness widens and dims both.
  vec3 studioEnv(vec3 dir) {
    float y = dir.y;
    vec3 c = mix(vec3(0.62, 0.65, 0.7), vec3(0.93, 0.95, 0.98), smoothstep(-0.1, 0.7, y));
    return mix(c, vec3(0.44, 0.47, 0.53), smoothstep(0.0, -0.6, y));
  }

  float studioLights(vec3 dir, float rough) {
    float soft = mix(0.05, 0.5, rough);
    vec3 kz = normalize(uKeyLightDir);
    vec3 kx = normalize(cross(vec3(0.0, 1.0, 0.0), kz));
    vec3 ky = cross(kz, kx);
    vec2 p = vec2(dot(dir, kx), dot(dir, ky));
    float panel = smoothstep(0.62 + soft, 0.62 - soft, abs(p.x))
      * smoothstep(0.34 + soft, 0.34 - soft, abs(p.y))
      * smoothstep(0.0, 0.3, dot(dir, kz));

    float horizon = smoothstep(0.05 + soft * 0.6, 0.0, abs(dir.y - 0.16));
    float strip = smoothstep(0.08 + soft * 0.5, 0.02, abs(dir.x + 0.62))
      * smoothstep(-0.35, 0.1, dir.y) * smoothstep(0.95, 0.5, dir.y);

    return (0.85 * panel + 0.35 * horizon + 0.55 * strip) * mix(1.0, 0.45, rough);
  }

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 vView = normalize(-vViewPosition);
    vec3 v = normalize((vec4(vView, 0.0) * viewMatrix).xyz);
    if (!gl_FrontFacing) n = -n;
    float facing = clamp(dot(n, v), 0.0, 1.0);
    // 0 face-on → 1 at the silhouette; one continuous core → skin gradient.
    float edge = pow(1.0 - facing, 1.8);

    vec3 lKey = normalize(uKeyLightDir);
    vec3 lFill = normalize(uFillLightDir);

    float coreRough = uRoughness;
    float shellRough = uRoughness * 0.35;
    float f0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0);

    float t = smoothstep(uLow, uHigh, vPosition.y);
    vec3 body = mix(uColorA, uColorB, t);

    // Body lighting, with the normal bent toward the eye by IOR in the
    // interior so the core reads as seen through the skin.
    float bend = 0.45 * (1.0 - 1.0 / uIor) * (1.0 - edge);
    vec3 nc = normalize(mix(n, v, bend));
    float keyDiffuse = clamp((dot(nc, lKey) + 0.3) / 1.3, 0.0, 1.0);
    float fillDiffuse = clamp(dot(nc, lFill) * 0.5 + 0.5, 0.0, 1.0);
    float shade = (0.5 + 0.6 * keyDiffuse + 0.28 * fillDiffuse) * mix(1.0, 0.9, edge);

    vec3 hc = normalize(lKey + v);
    float coreShine = mix(90.0, 8.0, coreRough);
    float coreSpec = pow(max(dot(nc, hc), 0.0), coreShine) * mix(0.5, 0.1, coreRough);

    vec3 skin = mix(body, uRimColor, 0.22);
    vec3 base = mix(body, skin, edge) * shade + vec3(coreSpec) * (1.0 - edge);

    // Glass skin: Fresnel reflection of the backdrop, plus the bright panels
    // reflected across the whole surface (stronger toward grazing angles).
    float fresnel = f0 + (1.0 - f0) * pow(1.0 - facing, 5.0);
    fresnel = clamp(fresnel * mix(1.0, 0.7, shellRough) + f0, 0.0, 1.0);
    vec3 r = reflect(-v, n);
    vec3 tint = mix(vec3(1.0), skin, 0.25);
    float lights = studioLights(r, shellRough) * mix(0.3, 1.0, fresnel);
    float shellShine = mix(260.0, 24.0, shellRough);
    float shellSpec = pow(max(dot(n, hc), 0.0), shellShine) * mix(0.7, 0.25, shellRough);

    vec3 color = base * (1.0 - fresnel) + studioEnv(r) * tint * fresnel
      + (lights + shellSpec) * tint;

    float shellAlpha = mix(uCoreOpacity, 0.05, uShellTransmission);
    float baseAlpha = mix(uCoreOpacity, shellAlpha, edge);
    float alpha = baseAlpha + (1.0 - baseAlpha) * clamp(fresnel + lights + shellSpec, 0.0, 1.0);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`
