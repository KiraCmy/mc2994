import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Height of the prism crystal below (prism 1 + tip). */
export const PRISM_TIP = 0.5
export const PRISM_HEIGHT = 1 + PRISM_TIP
/** Height of the frost shard below (from −0.35 to 1). */
export const SHARD_HEIGHT = 1.35

/**
 * Quartz point with volume: a hexagonal prism whose edges are chamfered
 * (12-sided section: six wide faces, six narrow bevels), a slight taper, and a
 * two-step termination (shoulder facets, then the tip). Base open (embedded).
 * Flat facet normals so every face and bevel catches its own light.
 */
export function createPrismCrystalGeometry({ taper = 0.08 } = {}) {
  const bevel = 0.14 /* half-width of a bevel in radians */
  const angles = []
  for (let k = 0; k < 6; k++) {
    const c = (k / 6) * Math.PI * 2
    angles.push(c - Math.PI / 6 + bevel, c + Math.PI / 6 - bevel)
  }
  const ring = (radius, y) => angles.map((a) => [Math.cos(a) * radius, y, Math.sin(a) * radius])
  const top = 0.5 * (1 - taper)
  const rings = [
    ring(0.5, 0),
    ring(top, 1),
    ring(top * 0.46, 1 + PRISM_TIP * 0.62),
  ]
  const apex = [0, PRISM_HEIGHT, 0]
  const tri = []
  const n = angles.length
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < n; i++) {
      const a0 = rings[r][i], a1 = rings[r][(i + 1) % n]
      const b0 = rings[r + 1][i], b1 = rings[r + 1][(i + 1) % n]
      tri.push(a0, b0, a1, a1, b0, b1)
    }
  }
  const last = rings[rings.length - 1]
  for (let i = 0; i < n; i++) tri.push(last[i], apex, last[(i + 1) % n])
  const pos = new Float32Array(tri.length * 3)
  tri.forEach((v, i) => pos.set(v, i * 3))
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  return geo
}

/** Rounded frost bead (frost-flower rosettes are built from these). */
export function createBeadGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 2)
  geo.scale(1, 0.78, 1)
  geo.computeVertexNormals()
  return geo
}

/** Glossy pearl-white frost beads with a blush sheen. */
export function createBeadMaterial(overrides = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: '#fbeef4',
    metalness: 0,
    roughness: 0.18,
    iridescence: 0.8,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [250, 650],
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 0.8,
    sheenColor: new THREE.Color('#ffd9e8'),
    emissive: new THREE.Color('#ffe9f2'),
    emissiveIntensity: 0.05,
    envMapIntensity: 1.6,
    ...overrides,
  })
}

/** Elongated hexagonal bipyramid for frost / rime needles. */
export function createShardGeometry() {
  const up = new THREE.ConeGeometry(0.5, 1, 6, 1, true).toNonIndexed()
  up.translate(0, 0.5, 0)
  const down = new THREE.ConeGeometry(0.5, 0.35, 6, 1, true).toNonIndexed()
  down.rotateX(Math.PI)
  down.translate(0, -0.175, 0)
  const merged = mergeGeometries([up, down])
  merged.computeVertexNormals()
  up.dispose()
  down.dispose()
  return merged
}

/** Glassy crystal material shared by the body and the outcrops. */
export function createCrystalMaterial(overrides = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#fbf8ff',
    metalness: 0,
    roughness: 0.03,
    transmission: 1,
    thickness: 0.5,
    ior: 1.56,
    dispersion: 0.35,
    iridescence: 0.9,
    iridescenceIOR: 1.5,
    iridescenceThicknessRange: [220, 700],
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    attenuationColor: new THREE.Color('#f1e6ff'),
    attenuationDistance: 4,
    emissive: new THREE.Color('#e6dbff'),
    emissiveIntensity: 0.2,
    envMapIntensity: 3,
    ...overrides,
  })
  patchCrystalRim(material)
  return material
}

/**
 * Crystal detail (reference: clear quartz with inner life): bright facet rims,
 * a glow toward the termination, wispy veils and fine flecks inside the glass.
 * Works per instance — noise runs in the crystal's own geometry space.
 */
export function patchCrystalRim(material, strength = 0.35) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCrystalLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCrystalLocal = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCrystalLocal;
        float crystalHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float crystalNoise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(crystalHash(i), crystalHash(i + vec3(1.0, 0.0, 0.0)), f.x),
                         mix(crystalHash(i + vec3(0.0, 1.0, 0.0)), crystalHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                     mix(mix(crystalHash(i + vec3(0.0, 0.0, 1.0)), crystalHash(i + vec3(1.0, 0.0, 1.0)), f.x),
                         mix(crystalHash(i + vec3(0.0, 1.0, 1.0)), crystalHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 cp = vCrystalLocal * vec3(3.0, 1.3, 3.0);
        float veils = pow(1.0 - abs(crystalNoise(cp * 2.2) * 2.0 - 1.0), 9.0);
        float flecks = step(0.8, crystalNoise(cp * 15.0)) * crystalNoise(cp * 3.0 + 4.0);
        float tipGlow = smoothstep(0.95, 1.62, vCrystalLocal.y);
        float crystalRim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        diffuseColor.rgb *= 1.0 - veils * 0.18;
        totalEmissiveRadiance += vec3(1.0, 0.9, 0.96) * crystalRim * ${strength.toFixed(2)};
        totalEmissiveRadiance += vec3(0.96, 0.92, 1.0) * (veils * 0.1 + flecks * 0.45) + vec3(1.0, 0.92, 0.97) * tipGlow * 0.14;`,
      )
  }
  material.customProgramCacheKey = () => `exp07-crystal-detail-${strength.toFixed(2)}`
}

/** Opaque sparkling frost (visible through the membrane too). */
export function createFrostMaterial(overrides = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: '#f7f1ff',
    metalness: 0,
    roughness: 0.22,
    iridescence: 0.7,
    iridescenceIOR: 1.4,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    sheen: 0.5,
    sheenColor: new THREE.Color('#ffe0f0'),
    emissive: new THREE.Color('#d9d2ff'),
    emissiveIntensity: 0.14,
    envMapIntensity: 1.2,
    ...overrides,
  })
}

/** Unit quaternion that turns +Y onto `axis`, then spins around it. */
const _up = new THREE.Vector3(0, 1, 0)
const _spin = new THREE.Quaternion()
export function orientAlong(target, axis, spin = 0) {
  target.setFromUnitVectors(_up, axis)
  if (spin) target.premultiply(_spin.setFromAxisAngle(axis, spin))
  return target
}
