/* World Final opening shaders (water surface, light signal). */

export const surfaceVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`
export const surfaceFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uBright;
  uniform vec3 uDeep;
  varying vec3 vWorld;
  /* Value noise + domain warp: an organic, never-repeating ripple light,
     not a regular wave grid. */
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int k = 0; k < 4; k++) { v += a * noise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; }
    return v;
  }
  void main() {
    vec2 p = vWorld.xz * 0.12;
    float t = uTime * 0.05;
    vec2 warp = vec2(fbm(p + vec2(t, -t * 0.7)), fbm(p + vec2(5.2 - t * 0.6, 1.3 + t)));
    float n = fbm(p * 1.7 + warp * 2.2 + t * 0.4);
    /* Soft caustic veins where the warped field crosses its mid value. */
    float vein = 1.0 - smoothstep(0.0, 0.11, abs(n - 0.5));
    float veil = fbm(p * 0.35 + warp * 0.6 - t * 0.2);
    vec3 toFrag = vWorld - cameraPosition;
    float dist = length(toFrag);
    /* Bright where we look up toward the sun; the sheet thins toward the
       horizon and with distance, so no ceiling pattern sits across the view. */
    float up = clamp(normalize(toFrag).y, 0.0, 1.0);
    float ceiling = smoothstep(0.18, 0.6, up);
    float sun = pow(up, 5.0);
    float near = exp(-dist * 0.03);
    float light = 0.18 + 0.55 * sun + 0.32 * veil + 0.3 * vein * near * (0.4 + 0.6 * veil);
    vec3 col = mix(uDeep, uBright, clamp(light, 0.0, 1.0));
    gl_FragColor = vec4(col, uOpacity * ceiling * (0.45 + 0.55 * exp(-dist * 0.008)));
  }
`

/* Faint light signal: a soft glow that reads through the haze before the
   body itself does (World Final discovery). */
export const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.2) + 0.5 * pow(max(0.0, 1.0 - d), 9.0);
    gl_FragColor = vec4(uColor, a * uAlpha);
  }
`
