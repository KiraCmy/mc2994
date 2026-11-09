/**
 * Exp07 Final Habitat — shaders and material patches (no React), so they can
 * be compiled and checked outside the app.
 */
import * as THREE from 'three'

export const LIGHT_DIR = new THREE.Vector3(0.62, 0.48, -0.62).normalize()

export const nucleusVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vLocal;
  varying vec3 vViewDir;
  void main() {
    vLocal = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export const nucleusFragment = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform vec3 uGold;
  uniform vec3 uPink;
  uniform vec3 uFrost;
  uniform vec3 uShell;
  uniform vec3 uBlue;
  varying vec3 vNormalW;
  varying vec3 vLocal;
  varying vec3 vViewDir;
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                   mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
               mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                   mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
  }
  void main() {
    float facing = max(dot(normalize(vNormalW), normalize(vViewDir)), 0.0);
    float fres = pow(1.0 - facing, 2.2);
    vec3 p = vLocal * 2.4;
    float n = vnoise(p + vec3(0.0, uTime * 0.07, 0.0));
    float n2 = vnoise(p * 2.3 + n * 1.8);
    float fil = pow(1.0 - abs(sin((n2 * 5.0 + vLocal.y * 2.6) * 3.14159)), 7.0);
    float core = pow(facing, 3.0);
    vec3 col = mix(uGold, uPink, smoothstep(0.25, 0.8, n)) * (0.18 + 0.5 * fres + 0.55 * core);
    col = mix(col, uBlue * (0.3 + 0.6 * fres + 0.4 * core), smoothstep(0.55, 0.85, n2) * 0.55);
    col += uGold * fil * 0.22 * (0.4 + fres);
    float veins = pow(1.0 - abs(sin(vnoise(p * 2.1 + 7.0) * 15.7)), 30.0);
    col = mix(col, uFrost * 1.3, veins * 0.55 * smoothstep(0.08, 0.85, uLevel));
    col *= 1.0 - 0.12 * smoothstep(0.4, 1.0, uLevel);
    /* No silhouette: the rim fades into the membrane's own pearl tone. */
    float body = smoothstep(0.0, 0.95, facing);
    body *= body;
    col = mix(uShell, col, body);
    gl_FragColor = vec4(col, 1.0);
  }
`

export function patchMembrane(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    /* Optional edge light (silhouette against the habitat). */
    shader.uniforms.uRim ??= { value: 0 }
    shader.uniforms.uRimColor ??= { value: new THREE.Color('#e2f4ff') }
    /* Optional contact dents (up to three neighbours). */
    shader.uniforms.uContactDir ??= { value: [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1)] }
    shader.uniforms.uContactAmt ??= { value: [0, 0, 0] }
    shader.uniforms.uContactDepth ??= { value: 0 }
    shader.uniforms.uBodyCentre ??= { value: new THREE.Vector3() }
    /* Optional drag: the membrane trails behind its motion through water. */
    shader.uniforms.uDrift ??= { value: new THREE.Vector3() }
    /* Optional end-of-life coil (husk shape). */
    shader.uniforms.uCoil ??= { value: 0 }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aTent;
        attribute float aFrost;
        attribute vec3 aFacetOffset;
        attribute vec3 aFacetNormal;
        attribute vec3 aCoilOffset;
        attribute vec3 aCoilNormal;
        uniform float uCoil;
        uniform float uTime;
        uniform float uBreath;
        uniform float uTent;
        uniform float uFacet;
        uniform vec3 uContactDir[3];
        uniform float uContactAmt[3];
        uniform float uContactDepth;
        uniform vec3 uBodyCentre;
        uniform vec3 uDrift;
        varying float vFrost;
        varying vec3 vLocal;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        objectNormal = normalize(mix(objectNormal, aFacetNormal, uFacet));
        if (uCoil > 0.0) objectNormal = normalize(mix(objectNormal, aCoilNormal, uCoil));`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed += aFacetOffset * uFacet + aCoilOffset * uCoil;
        float wob = sin(position.x * 2.3 + uTime * 0.55) * sin(position.y * 1.9 - uTime * 0.42) * sin(position.z * 2.1 + uTime * 0.37);
        transformed += objectNormal * (wob * uBreath + aTent * uTent);
        /* Soft contact: flatten where a neighbour presses, a slight swell
           around the pressed patch (volume moves aside, like jelly). */
        vec3 fromCentre = normalize(position - uBodyCentre);
        /* Water drag: the trailing side lags behind, the leading side eases flat. */
        float driftLen = length(uDrift);
        if (driftLen > 1e-5) {
          float lead = dot(fromCentre, uDrift / driftLen);
          transformed -= uDrift * (0.75 * smoothstep(0.0, 1.0, -lead) + 0.2 * smoothstep(0.0, 1.0, lead));
        }
        for (int ci = 0; ci < 3; ci++) {
          float cd = dot(fromCentre, uContactDir[ci]);
          float press = smoothstep(0.5, 1.0, cd);
          float swell = smoothstep(0.1, 0.5, cd) * (1.0 - smoothstep(0.5, 0.78, cd));
          transformed += fromCentre * uContactAmt[ci] * uContactDepth * (0.3 * swell - press);
        }
        vFrost = aFrost;
        vLocal = position;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uRime;
        uniform vec3 uCore;
        uniform float uCoreGlow;
        uniform float uFilm;
        uniform float uRim;
        uniform vec3 uRimColor;
        uniform float uTime;
        varying float vFrost;
        varying vec3 vLocal;
        float frostHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float frostEdge = 1.0 - uRime * 1.08;
        float frostMask = smoothstep(frostEdge, frostEdge + 0.16, vFrost);
        roughnessFactor = mix(roughnessFactor, 0.42, frostMask);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float glint = step(0.986, frostHash(floor(vLocal * 140.0))) * frostMask;
        totalEmissiveRadiance += vec3(0.92, 0.9, 1.0) * (frostMask * 0.05 + glint * 0.32);
        float inward = pow(max(dot(normal, normalize(vViewPosition)), 0.0), 1.4);
        totalEmissiveRadiance += uCore * inward * uCoreGlow * (1.0 - 0.55 * frostMask);
        /* Soap-film rainbow: bands flow with view angle and the surface, pastel
           so it stays in the Born Another palette but separates the body from
           the habitat. */
        float filmFacing = 1.0 - abs(dot(normal, normalize(vViewPosition)));
        float filmFlow = 0.25 * sin(vLocal.x * 3.1 + vLocal.y * 2.3 + uTime * 0.12) + 0.15 * sin(vLocal.z * 5.2 - vLocal.x * 1.7 - uTime * 0.08);
        vec3 filmHue = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + filmFacing * 2.2 + filmFlow * 1.6));
        filmHue = mix(vec3(1.0), filmHue, 0.82);
        totalEmissiveRadiance += filmHue * uFilm * smoothstep(0.05, 0.7, filmFacing) * (1.0 - 0.6 * frostMask);
        totalEmissiveRadiance += uRimColor * pow(filmFacing, 3.0) * uRim;`,
      )
  }
  material.customProgramCacheKey = () => 'exp07-membrane-v8'
}

export const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`

export const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uGlow;
  uniform vec3 uLightDir;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(h, 0.7)) : mix(uHorizon, uBottom, pow(-h, 0.5));
    float sun = max(dot(d, normalize(uLightDir)), 0.0);
    col += uGlow * (pow(sun, 6.0) * 0.55 + pow(sun, 40.0) * 0.6);
    gl_FragColor = vec4(col, 1.0);
  }
`

export const shaftVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const shaftFragment = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  uniform float uSeed;
  varying vec2 vUv;
  void main() {
    float across = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
    across = pow(across, 1.6);
    float along = smoothstep(0.0, 0.25, vUv.y) * (0.35 + 0.65 * vUv.y);
    float flicker = 0.75 + 0.25 * sin(uTime * 0.35 + uSeed * 6.0 + vUv.y * 3.0);
    float a = across * along * flicker * uStrength * 1.8;
    gl_FragColor = vec4(vec3(0.86, 0.9, 1.0) * a, a);
  }
`

export const moteVertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uScale;
  uniform float uDrift;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    vec3 p = position;
    float t = uTime * (0.12 + uDrift);
    p.x += sin(t + aPhase) * 0.35;
    p.y += mod(uTime * 0.05 + aPhase * 0.37, 1.0) * 0.6 - 0.3;
    p.z += cos(t * 0.8 + aPhase * 1.3) * 0.35;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    gl_PointSize = aSize * uScale * (12.0 / dist);
    gl_Position = projectionMatrix * mv;
    vSoft = smoothstep(1.5, 6.0, dist);
    vAlpha = (0.25 + 0.5 * (0.5 + 0.5 * sin(uTime * 0.7 + aPhase))) * (1.0 - smoothstep(14.0, 26.0, dist));
  }
`

export const bubbleVertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uScale;
  uniform float uTurb;
  varying float vAlpha;
  void main() {
    float speed = aSeed.x * (1.0 + uTurb * 1.2);
    float rise = aSeed.w;
    float h = mod(uTime * speed + aSeed.z, rise);
    vec3 p = position;
    p.y += h;
    float wob = uTime * (1.3 + aSeed.x) + aSeed.z;
    p.x += sin(wob) * 0.12 * (1.0 + h * 0.08) + h * uTurb * 0.35;
    p.z += cos(wob * 0.8) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    gl_PointSize = aSeed.y * uScale * (20.0 / dist) * (0.8 + 0.4 * h / rise);
    gl_Position = projectionMatrix * mv;
    vAlpha = smoothstep(0.0, 0.6, h) * (1.0 - smoothstep(rise * 0.75, rise, h)) * (1.0 - smoothstep(18.0, 34.0, dist));
  }
`

export const bubbleFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float d = length(q);
    if (d > 0.5) discard;
    float ring = smoothstep(0.5, 0.42, d) * smoothstep(0.26, 0.44, d);
    float glint = smoothstep(0.12, 0.0, length(q - vec2(-0.14, -0.16)));
    float body = smoothstep(0.5, 0.0, d) * 0.06;
    float a = (ring * 0.55 + glint * 0.8 + body) * vAlpha;
    gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), a * 0.6);
  }
`

/** Sand lifted by a storm: still at calm, streaming and rising as turbulence grows. */
export const dustVertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uScale;
  uniform float uStorm;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float lift = fract(uTime * (0.15 + uStorm * 0.55) + aPhase);
    p.y += lift * (0.35 + uStorm * 4.2);
    p.x += uTime * (0.4 + uStorm * 5.5) + sin(uTime * 1.4 + aPhase * 6.0) * uStorm * 0.8;
    p.z += cos(uTime * 0.7 + aPhase * 4.0) * uStorm * 0.6;
    p.x = mod(p.x + 20.0, 40.0) - 20.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    gl_PointSize = aSize * uScale * (1.0 + uStorm * 1.4) * (16.0 / dist);
    gl_Position = projectionMatrix * mv;
    float body = smoothstep(0.0, 0.12, lift) * (1.0 - smoothstep(0.62, 1.0, lift));
    vAlpha = uStorm * body * (1.0 - smoothstep(10.0, 28.0, dist));
  }
`

export const dustFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha;
    gl_FragColor = vec4(vec3(0.78, 0.71, 0.6), a * 0.85);
  }
`

export const moteFragment = /* glsl */ `
  varying float vAlpha;
  varying float vSoft;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    float disc = smoothstep(0.5, 0.36, d) * 0.12 + core * 0.18;
    float a = mix(disc, core, vSoft) * vAlpha;
    gl_FragColor = vec4(vec3(0.92, 0.94, 1.0) * a, a);
  }
`

export function createEnvironmentScene() {
  const scene = new THREE.Scene()
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTop: { value: new THREE.Color('#e4e8ef') },
        uHorizon: { value: new THREE.Color('#c0c6d0') },
        uBottom: { value: new THREE.Color('#8c93a3') },
        uGlow: { value: new THREE.Color('#ffffff') },
        uLightDir: { value: LIGHT_DIR },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: skyFragment,
    }),
  )
  scene.add(sky)
  const panel = (color, intensity, pos, w, h) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    )
    mesh.position.copy(pos)
    mesh.lookAt(0, 0, 0)
    scene.add(mesh)
  }
  panel('#ffffff', 2, LIGHT_DIR.clone().multiplyScalar(8), 5, 6)
  panel('#ffd6ea', 1.4, new THREE.Vector3(-7, 2, 3), 5, 3)
  panel('#d7ecff', 1.2, new THREE.Vector3(6, 0, 5), 4, 3)
  return scene
}

export function patchFrond(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uSway = uniforms.uSway
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aT;\nuniform float uTime;\nuniform float uSway;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float phase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3;
        #else
          float phase = 0.0;
        #endif
        float tt = aT * aT;
        transformed.x += sin(uTime * 0.8 + phase) * uSway * tt;
        transformed.z += cos(uTime * 0.6 + phase * 1.3) * uSway * 0.6 * tt;`,
      )
  }
  material.customProgramCacheKey = () => 'exp07-frond-v1'
}

export const tuftVertex = /* glsl */ `
  attribute float aT;
  attribute float aPhase;
  uniform float uTime;
  uniform float uSway;
  varying float vT;
  #include <fog_pars_vertex>
  void main() {
    vec3 p = position;
    float tt = aT * aT;
    p.x += sin(uTime * 1.1 + aPhase) * uSway * tt;
    p.z += cos(uTime * 0.9 + aPhase * 1.4) * uSway * 0.7 * tt;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vT = aT;
    #include <fog_vertex>
  }
`

export const tuftFragment = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uTip;
  varying float vT;
  #include <fog_pars_fragment>
  void main() {
    vec3 col = mix(uBase, uTip, vT) * (0.7 + 0.6 * vT);
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`

export const glintVertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale * (10.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    vColor = aColor;
    vAlpha = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 1.3 + aPhase), 6.0);
    #include <fog_vertex>
  }
`

export const glintFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  #include <fog_pars_fragment>
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(vColor, a);
    #include <fog_fragment>
  }
`

/*
 * Frost shell — a thin transparent coat over the original Pearlescent body.
 * Only the frosted regions draw (rime grows along aFrost), so the body keeps
 * its own look until the medium freezes it.
 */
export const frostShellVertex = /* glsl */ `
  attribute float aFrost;
  uniform float uLift;
  varying float vFrost;
  varying vec3 vLocal;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vFrost = aFrost;
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position + normal * uLift, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
export const frostShellFragment = /* glsl */ `
  uniform float uRime;
  uniform float uTime;
  varying float vFrost;
  varying vec3 vLocal;
  varying vec3 vN;
  varying vec3 vView;
  float frostHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
  void main() {
    float edge = 1.0 - uRime * 0.92;
    float m = smoothstep(edge, edge + 0.22, vFrost) * 0.85;
    if (m < 0.01) discard;
    float fres = pow(1.0 - max(dot(normalize(vN), normalize(vView)), 0.0), 2.0);
    float grain = frostHash(floor(vLocal * 90.0));
    float glint = step(0.976, frostHash(floor(vLocal * 160.0) + floor(uTime * 0.5)));
    vec3 col = mix(vec3(0.93, 0.92, 0.98), vec3(1.0, 0.95, 0.98), grain);
    col = col * 0.94 + vec3(0.85, 0.9, 1.0) * fres * 0.12 + glint * 0.45;
    float a = m * (0.32 + 0.3 * grain + 0.2 * fres) + glint * m * 0.35;
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.7));
  }
`
