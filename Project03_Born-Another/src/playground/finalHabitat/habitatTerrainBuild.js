/**
 * Exp07 Final Habitat — terrain builders (three.js only, no React) so the app
 * and offline checks build exactly the same ground, veils, glints and splashes.
 */
import * as THREE from 'three'
import {
  HABITAT_RADIUS,
  HABITAT_SEED,
  HABITAT_VEIL_RADIUS,
  habitatColor,
  habitatHeight,
  habitatNormal,
  habitatRng,
  habitatVeil,
  habitatVeilHeight,
} from './habitatField.js'
import { glintFragment, glintVertex } from './habitatShaders.js'

/**
 * Concentric grid: dense around the organism, coarse toward the rim, so a
 * World Final-sized field stays affordable. Ring radii grow as (i/rings)^power.
 */
export function buildPolarGrid(radius, rings, segments, power, inner = 0) {
  const count = 1 + rings * segments
  const pos = new Float32Array(count * 3)
  let v = 1
  for (let i = 1; i <= rings; i++) {
    const r = inner + (radius - inner) * Math.pow(i / rings, power)
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2 + (i % 2) * (Math.PI / segments)
      pos[v * 3] = Math.cos(a) * r
      pos[v * 3 + 2] = Math.sin(a) * r
      v++
    }
  }
  const index = []
  for (let j = 0; j < segments; j++) index.push(0, 1 + ((j + 1) % segments), 1 + j)
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segments
    const b0 = 1 + i * segments
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments
      index.push(a0 + j, a0 + j1, b0 + j)
      index.push(a0 + j1, b0 + j1, b0 + j)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setIndex(count > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1))
  return geo
}

export function buildGroundGeometry({ rings = 300, segments = 420 } = {}) {
  const geo = buildPolarGrid(HABITAT_RADIUS, rings, segments, 2.4)
  const pos = geo.attributes.position.array
  for (let i = 0; i < pos.length; i += 3) pos[i + 1] = habitatHeight(pos[i], pos[i + 2])
  geo.computeVertexNormals()
  const nor = geo.attributes.normal.array
  const colors = new Float32Array(pos.length)
  const c = new THREE.Color()
  for (let i = 0; i < pos.length; i += 3) {
    const slope = Math.min(1, (1 - nor[i + 1]) * 3)
    const rgb = habitatColor(pos[i], pos[i + 2], pos[i + 1], slope)
    c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace)
    colors[i] = c.r
    colors[i + 1] = c.g
    colors[i + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeBoundingSphere()
  return geo
}

/** Satin sand: soft sheen + faint iridescence (darker than the veils). */
/**
 * Satin sand with two close-up details:
 * - fine grain: a procedural micro-normal + rare sparkling grains, fading out
 *   past ~20 units so the far dunes stay smooth;
 * - caustics: slow moving light ripples (tileable water caustic), stronger
 *   under the floating body, as if light focused through its membrane.
 * Update material.userData.uniforms.uTime each frame.
 */
export function createGroundMaterial({ caustic = 0.3, grain = 0.18 } = {}) {
  const uniforms = { uTime: { value: 0 }, uCaustic: { value: caustic }, uGrain: { value: grain }, uFilm: { value: 0 } }
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    /* Multiplies the sand colours down a step: the body reads against it. */
    color: '#bdbacb',
    metalness: 0,
    roughness: 0.72,
    sheen: 0.32,
    sheenColor: new THREE.Color('#e9dcf2'),
    sheenRoughness: 0.4,
    iridescence: 0.35,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [300, 700],
    envMapIntensity: 0.8,
  })
  material.userData.uniforms = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHabWorld;\nvarying float vHabUp;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvHabWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvHabUp = normalize(mat3(modelMatrix) * objectNormal).y;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vHabWorld;
        varying float vHabUp;
        uniform float uTime;
        uniform float uCaustic;
        uniform float uGrain;
        uniform float uFilm;
        float habHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float habNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(habHash(i), habHash(i + vec2(1.0, 0.0)), f.x), mix(habHash(i + vec2(0.0, 1.0)), habHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float habCaustic(vec2 uv, float t) {
          vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
          vec2 i = p; float c = 1.0; float inten = 0.005;
          for (int n = 0; n < 4; n++) {
            float tt = t * (1.0 - (3.5 / float(n + 1)));
            i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
            c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
          }
          c /= 4.0; c = 1.17 - pow(c, 1.4);
          return pow(abs(c), 8.0);
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        float habDist = length(vHabWorld - cameraPosition);
        float grainFade = 1.0 - smoothstep(4.0, 22.0, habDist);
        vec2 gp = vHabWorld.xz * 70.0;
        float g0 = habNoise(gp);
        vec2 grad = vec2(habNoise(gp + vec2(0.35, 0.0)) - g0, habNoise(gp + vec2(0.0, 0.35)) - g0);
        grad += 0.5 * vec2(habNoise(gp * 2.3 + vec2(0.35, 7.0)) - habNoise(gp * 2.3 + 7.0), habNoise(gp * 2.3 + vec2(7.0, 7.35)) - habNoise(gp * 2.3 + 7.0));
        normal = normalize(normal + (viewMatrix * vec4(grad.x, 0.0, grad.y, 0.0)).xyz * uGrain * 4.0 * grainFade);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float sparkle = step(0.996, habHash(floor(vHabWorld.xz * 70.0))) * pow(max(0.0, sin(uTime * 1.3 + habHash(floor(vHabWorld.xz * 70.0) + 3.1) * 40.0)), 6.0);
        totalEmissiveRadiance += vec3(1.0, 0.97, 1.0) * sparkle * 0.55 * grainFade * uGrain;
        diffuseColor.rgb *= 1.0 - (g0 - 0.5) * 0.12 * grainFade;
        float cFade = 1.0 - smoothstep(25.0, 60.0, habDist);
        float under = 0.5 + 0.9 * exp(-dot(vHabWorld.xz, vHabWorld.xz) / 40.0);
        float cau = habCaustic(vHabWorld.xz * 0.45, uTime * 0.35 + 23.0) * 0.75 + habCaustic(vHabWorld.xz * 0.78 + 3.7, uTime * 0.27 + 11.0) * 0.45;
        totalEmissiveRadiance += vec3(1.0, 0.95, 1.0) * min(cau, 1.6) * uCaustic * under * cFade * smoothstep(0.55, 0.95, vHabUp);
        float filmFacing = pow(1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0), 1.6);
        float filmBand = vHabWorld.x * 0.22 + vHabWorld.z * 0.16 + filmFacing * 3.4 + uTime * 0.04;
        vec3 filmHue = 0.55 + 0.45 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + filmBand));
        totalEmissiveRadiance += filmHue * uFilm * filmFacing * 0.7;`,
      )
  }
  material.customProgramCacheKey = () => 'exp07-ground-caustic-v2'
  return material
}

export function buildVeilGeometry(layer = 0, { rings = 220, segments = 360 } = {}) {
  const geo = buildPolarGrid(HABITAT_VEIL_RADIUS, rings, segments, 2.2, 1.2)
  const pos = geo.attributes.position.array
  const mask = new Float32Array(pos.length / 3)
  for (let i = 0; i < pos.length; i += 3) {
    mask[i / 3] = habitatVeil(pos[i], pos[i + 2], HABITAT_SEED, layer)
    pos[i + 1] = habitatVeilHeight(pos[i], pos[i + 2], HABITAT_SEED, layer)
  }
  geo.setAttribute('aVeil', new THREE.BufferAttribute(mask, 1))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

/**
 * Translucent iridescent membrane sheet. Masked by aVeil; grazing angles get
 * more opaque and glow at the folds (the reference's bright veil edges).
 */
export function createVeilMaterial(layer = 0, { fade = 1 } = {}) {
  const uniforms = { uVeilFade: { value: fade }, uFilm: { value: 0 } }
  const material = new THREE.MeshPhysicalMaterial({
    color: layer ? '#efe8fb' : '#f6eefc',
    metalness: 0,
    roughness: 0.1,
    transparent: true,
    opacity: layer ? 0.42 : 0.5,
    depthWrite: false,
    side: THREE.DoubleSide,
    iridescence: 1,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [250, 820],
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    sheen: 0.6,
    sheenColor: new THREE.Color('#ffd9ee'),
    envMapIntensity: 1.8,
  })
  material.userData.uniforms = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aVeil;\nvarying float vVeil;\nvarying float vSlope;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvVeil = aVeil;\nvSlope = 1.0 - abs(normalize(mat3(modelMatrix) * objectNormal).y);',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vVeil;\nvarying float vSlope;\nuniform float uVeilFade;\nuniform float uFilm;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float veilMask = smoothstep(0.05, 0.6, vVeil);
        /* Light lives in the folds (steep parts) and along the sheet's edge. */
        float veilFold = smoothstep(0.06, 0.45, vSlope) * veilMask;
        float veilEdge = smoothstep(0.08, 0.28, vVeil) * (1.0 - smoothstep(0.28, 0.55, vVeil));
        totalEmissiveRadiance += vec3(1.0, 0.93, 0.98) * (veilFold * 0.35 + veilEdge * 0.45) * uVeilFade;
        float filmFacing = pow(1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0), 1.4);
        float filmBand = vVeil * 5.0 + filmFacing * 3.2 + vSlope * 2.0;
        vec3 filmHue = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + filmBand));
        totalEmissiveRadiance += filmHue * uFilm * filmFacing * veilMask * 0.85;
        diffuseColor.a = clamp(veilMask * 0.05 + veilFold * 0.45 + veilEdge * 0.4, 0.0, 0.8) * uVeilFade;
        diffuseColor.a = clamp(diffuseColor.a + uFilm * filmFacing * veilMask * 0.28, 0.0, 0.9);`,
      )
  }
  material.customProgramCacheKey = () => `exp07-veil-v6-${layer}`
  return material
}

/** Sediment glints: dense near the clearing, thinning into the mid field. */
export function buildGlints(count = 9000) {
  const r = habitatRng(HABITAT_SEED + 101)
  const gpos = new Float32Array(count * 3)
  const gsize = new Float32Array(count)
  const gphase = new Float32Array(count)
  const gcol = new Float32Array(count * 3)
  const palette = ['#d9c7ff', '#f6d9e6', '#bfe6f2', '#ffd1e6', '#ffffff'].map((h) => new THREE.Color(h))
  for (let i = 0; i < count; i++) {
    const ang = r() * Math.PI * 2
    const rad = 0.9 + Math.pow(r(), 1.6) * 60
    const x = Math.cos(ang) * rad
    const z = Math.sin(ang) * rad
    const n = habitatNormal(x, z)
    const lift = 0.01 + r() * 0.04
    gpos.set([x + n[0] * lift, habitatHeight(x, z) + n[1] * lift, z + n[2] * lift], i * 3)
    gsize[i] = (0.5 + Math.pow(r(), 3) * 2.4) * (1 + rad * 0.02)
    gphase[i] = r() * 100
    const c = palette[Math.floor(r() * palette.length)]
    gcol.set([c.r, c.g, c.b], i * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(gpos, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(gsize, 1))
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(gphase, 1))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(gcol, 3))
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uScale: { value: 1 } }]),
    vertexShader: glintVertex,
    fragmentShader: glintFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  })
  return { geometry, material }
}

/* ---------- splash crowns: droplets on stalks rising from the sand ---------- */

export function planSplashes() {
  const r = habitatRng(HABITAT_SEED + 303)
  const crowns = []
  const add = (n, rMin, rMax, sMin, sMax) => {
    for (let i = 0; i < n; i++) {
      const ang = r() * Math.PI * 2
      const rad = rMin + Math.pow(r(), 0.8) * (rMax - rMin)
      const x = Math.cos(ang) * rad
      const z = Math.sin(ang) * rad
      const size = sMin + r() * (sMax - sMin)
      const stalks = 7 + Math.floor(r() * 6)
      crowns.push({
        x,
        z,
        y: habitatHeight(x, z),
        size,
        stalks: Array.from({ length: stalks }, (_, k) => ({
          ang: (k / stalks) * Math.PI * 2 + (r() - 0.5) * 0.5,
          lean: 0.25 + r() * 0.45,
          len: 0.6 + r() * 0.6,
          drop: 0.08 + r() * 0.07,
        })),
        period: 3 + r() * 3,
        phase: r(),
      })
    }
  }
  add(26, 2.2, 9, 0.08, 0.16)
  add(28, 9, 34, 0.18, 0.4)
  return crowns
}

export function createSplashResources(crowns) {
  const stalkCount = crowns.reduce((n, c) => n + c.stalks.length, 0)
  const droplet = new THREE.SphereGeometry(1, 14, 10)
  const stalk = new THREE.CylinderGeometry(0.18, 0.55, 1, 6, 1, true)
  stalk.translate(0, 0.5, 0)
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#fbf6ff',
    metalness: 0,
    roughness: 0.03,
    transmission: 1,
    thickness: 0.2,
    ior: 1.33,
    iridescence: 0.6,
    iridescenceIOR: 1.35,
    specularIntensity: 1,
    emissive: new THREE.Color('#f3ecff'),
    emissiveIntensity: 0.08,
    envMapIntensity: 2,
  })
  const drops = new THREE.InstancedMesh(droplet, glass, stalkCount)
  const stalks = new THREE.InstancedMesh(stalk, glass, stalkCount)
  drops.frustumCulled = false
  stalks.frustumCulled = false
  return { droplet, stalk, glass, drops, stalks, stalkCount }
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _a = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/** Crowns rise, hold, and sink back on their own cycle. */
export function updateSplashes(crowns, res, time, turbulence = 0) {
  let k = 0
  for (const c of crowns) {
    const t = ((time / c.period + c.phase) % 1 + 1) % 1
    const rise = Math.sin(Math.min(1, t / 0.7) * Math.PI)
    const h = Math.max(0, rise) * (1 + turbulence * 0.8)
    for (const s of c.stalks) {
      const len = c.size * s.len * h
      _a.set(Math.cos(s.ang) * s.lean, 1, Math.sin(s.ang) * s.lean).normalize()
      _q.setFromUnitVectors(_up, _a)
      const w = c.size * 0.05 * (0.3 + 0.7 * h)
      _p.set(c.x, c.y - c.size * 0.04, c.z)
      _s.set(w, Math.max(1e-4, len), w)
      res.stalks.setMatrixAt(k, _m.compose(_p, _q, _s))
      _p.addScaledVector(_a, len)
      const d = c.size * s.drop * (0.2 + 0.8 * h)
      _s.set(d, d, d)
      res.drops.setMatrixAt(k, _m.compose(_p, _q.identity(), _s))
      k++
    }
  }
  res.stalks.instanceMatrix.needsUpdate = true
  res.drops.instanceMatrix.needsUpdate = true
}
