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

/**
 * The body's own quartz: the same prism with a short, blunt termination
 * (same overall height), so crystals read as grown out of the skin rather
 * than as the needles that stand on the sand.
 */
export function createBluntPrismGeometry() {
  const geo = createPrismCrystalGeometry({ taper: 0.12 })
  const p = geo.attributes.position.array
  const body = PRISM_HEIGHT - 0.2
  for (let i = 1; i < p.length; i += 3) p[i] = p[i] <= 1 ? p[i] * body : body + (p[i] - 1) * (0.2 / PRISM_TIP)
  geo.attributes.position.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/** Acicular needle (spiral species: radiating sprays). Height PRISM_HEIGHT. */
export function createNeedleGeometry() {
  return createPrismCrystalGeometry({ taper: 0.5 })
}

/** Cubic block with a little bevel (trilobite species: blocky aggregates). */
export function createBlockGeometry() {
  const box = new THREE.BoxGeometry(1, PRISM_HEIGHT, 1, 1, 1, 1)
  box.translate(0, PRISM_HEIGHT / 2, 0)
  const flat = box.toNonIndexed()
  box.dispose()
  /* Cleaved, slightly stepped faces (not a perfect cube). */
  const p = flat.attributes.position.array
  for (let i = 0; i < p.length; i += 3) {
    if (p[i + 1] > PRISM_HEIGHT * 0.99) {
      p[i] *= 0.92
      p[i + 2] *= 0.92
    }
  }
  flat.computeVertexNormals()
  return flat
}

/**
 * The body's own crystals (all habits): clear, refracting crystal with an
 * inside — milky phantoms and fractures, sparkles that move with the view —
 * bright facet edges, a little fire, and a frosted root where it grows out of
 * the skin. habit: 'prisms' | 'plates' | 'blocks' (local frames of
 * createBluntPrismGeometry / createPlateCrystalGeometry / createBlockGeometry).
 */
export function createBodyCrystalMaterial(habit = 'prisms', overrides = {}) {
  const uniforms = { uSkin: { value: new THREE.Color('#f2dbe6') }, uGlow: { value: 1 } }
  const material = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    metalness: 0,
    roughness: 0.03,
    transmission: 0.92,
    thickness: 1.2,
    ior: 1.56,
    dispersion: 0.6,
    attenuationColor: new THREE.Color('#ecd6f0'),
    attenuationDistance: 1.4,
    iridescence: habit === 'blocks' ? 0.9 : 0.55,
    iridescenceIOR: 1.4,
    iridescenceThicknessRange: habit === 'blocks' ? [250, 1100] : [160, 720],
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    specularIntensity: 1,
    sheen: habit === 'plates' ? 0.6 : 0,
    sheenColor: new THREE.Color('#fff6ee'),
    envMapIntensity: 2.8,
    ...overrides,
  })
  const code = habit === 'plates' ? 1 : habit === 'blocks' ? 2 : 0
  material.userData.uniforms = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vXLocal;\nvarying vec3 vXWorld;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vXLocal = position;
        #ifdef USE_INSTANCING
          vXWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        #else
          vXWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        #endif`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vXLocal;
        varying vec3 vXWorld;
        uniform vec3 uSkin;
        uniform float uGlow;
        float xHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float xNoise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(xHash(i), xHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(xHash(i + vec3(0.0, 1.0, 0.0)), xHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                     mix(mix(xHash(i + vec3(0.0, 0.0, 1.0)), xHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(xHash(i + vec3(0.0, 1.0, 1.0)), xHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
        }
        /* Facet edges in the crystal's own frame (habit-specific). */
        float xEdge() {
          vec3 p = vXLocal;
          ${code === 0
            ? `float a = atan(p.z, p.x) / 6.2831853 * 6.0 + 0.5; float f = fract(a);
               float side = 1.0 - smoothstep(0.0, 0.05, min(f, 1.0 - f));
               float shoulder = 1.0 - smoothstep(0.0, 0.03, abs(p.y - ${(PRISM_HEIGHT - 0.2).toFixed(3)}));
               return max(side * step(p.y, ${(PRISM_HEIGHT - 0.2).toFixed(3)}), shoulder);`
            : code === 1
              ? `/* The bevelled rim of the blade. */
                 return smoothstep(0.062, 0.085, abs(p.z));`
              : `vec3 q = abs(vec3(p.x, p.y - ${(PRISM_HEIGHT / 2).toFixed(3)}, p.z)) / vec3(0.5, ${(PRISM_HEIGHT / 2).toFixed(3)}, 0.5);
                 float ex = smoothstep(0.9, 0.98, q.x), ey = smoothstep(0.92, 0.985, q.y), ez = smoothstep(0.9, 0.98, q.z);
                 return max(max(ex * ey, ey * ez), ex * ez);`}
        }
        float xRoot() { return 1.0 - smoothstep(0.08, 0.32, vXLocal.y / ${PRISM_HEIGHT.toFixed(3)}); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float xn = xNoise(vXWorld * 3.0);
        /* Inside: a milky phantom and cloudy veils, clear elsewhere. */
        float xVeil = pow(1.0 - abs(xNoise(vXWorld * 2.2 + 7.0) * 2.0 - 1.0), 6.0);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.94, 0.92, 0.98), xVeil * 0.6);
        /* Root: frosted, taking the skin's colour where it grows out of it. */
        diffuseColor.rgb = mix(diffuseColor.rgb, uSkin * (0.85 + 0.25 * xNoise(vXWorld * 30.0)), xRoot() * 0.85);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + smoothstep(0.66, 0.9, xNoise(vXWorld * 5.0 + 3.0)) * 0.16 + xRoot() * 0.55, 0.02, 0.9);`,
      )
      .replace(
        '#include <transmission_fragment>',
        THREE.ShaderChunk.transmission_fragment.replace(
          'material.transmission = transmission;',
          'material.transmission = transmission * (1.0 - 0.8 * xRoot());',
        ),
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 V = normalize(vViewPosition);
          vec3 R = reflect(-V, normal);
          vec3 q = vXWorld * 2.4 + R * 1.3;
          float sparkle = smoothstep(0.78, 0.94, xNoise(q * 3.2)) * xNoise(q * 0.8);
          float fracture = pow(1.0 - abs(xNoise(q) * 2.0 - 1.0), 16.0);
          float rim = pow(1.0 - abs(dot(normal, V)), 3.0);
          float lit = (1.0 - xRoot());
          totalEmissiveRadiance += vec3(1.0, 0.97, 1.0) * (xEdge() * 0.32 + sparkle * 0.5 + fracture * 0.16 + rim * 0.1) * lit * uGlow;
          totalEmissiveRadiance += vec3(0.95, 0.93, 1.0) * xVeil * 0.06 * lit;
        }`,
      )
  }
  material.customProgramCacheKey = () => `exp07-body-crystal-${code}`
  return material
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

/**
 * Selenite blade: a thin tablet with a pointed, slightly skewed head (gypsum /
 * selenite habit). Long axis +Y (0 → PRISM_HEIGHT), wide in X, thin in Z.
 */
export function createPlateCrystalGeometry() {
  const h = PRISM_HEIGHT
  const shape = new THREE.Shape()
  shape.moveTo(-0.5, 0)
  shape.lineTo(0.5, 0)
  shape.lineTo(0.56, h * 0.8)
  shape.lineTo(0.38, h)
  shape.lineTo(-0.46, h * 0.93)
  shape.lineTo(-0.56, h * 0.62)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.05,
    bevelSegments: 1,
    steps: 1,
  })
  geo.translate(0, 0, -0.06)
  const flat = geo.toNonIndexed()
  geo.dispose()
  flat.computeVertexNormals()
  return flat
}

/**
 * Calcite rhomb: a sheared, chunky rhombohedron (the mineral of trilobite
 * shields). Sits on y = 0, about 0.9 tall, faces flat-shaded.
 */
export function createRhombCrystalGeometry() {
  const box = new THREE.BoxGeometry(1, 0.9, 1)
  box.translate(0, 0.45, 0)
  const pos = box.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    pos.setX(i, pos.getX(i) + y * 0.38)
    pos.setZ(i, pos.getZ(i) + y * 0.22)
  }
  box.rotateY(Math.PI / 4)
  const flat = box.toNonIndexed()
  box.dispose()
  flat.computeVertexNormals()
  return flat
}

/** Flat scale-flake (frost of the quilted body). */
export function createFlakeGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 1)
  geo.scale(1, 0.22, 0.8)
  geo.computeVertexNormals()
  return geo
}

/** Small cleaved grain (frost of the shielded body). */
export function createGrainGeometry() {
  const geo = new THREE.BoxGeometry(1.1, 0.8, 0.9)
  geo.rotateY(0.6)
  geo.rotateX(0.3)
  const flat = geo.toNonIndexed()
  geo.dispose()
  flat.computeVertexNormals()
  return flat
}

/**
 * Each species grows its own mineral, inside one palette:
 *  - spiral (ammonite line): clear lilac quartz points, pearl frost;
 *  - segmented (quilted oval): satin selenite blades, milky flake frost;
 *  - trilobite: pale apricot calcite rhombs with strong fire, cleaved grains.
 * len / width scale the grown crystal (length beyond the embed / girth).
 */
export const CRYSTAL_STYLES = Object.freeze({
  quartz: Object.freeze({
    habit: 'prism',
    frost: 'pearl',
    len: 1,
    width: 1,
    crystal: { color: '#f3f0ff', attenuationColor: '#e4d6ff', attenuationDistance: 1.5, iridescence: 1, dispersion: 0.35 },
    frostMat: { color: '#ece0fa', transmission: 0.75, thickness: 0.3, roughness: 0.08, iridescence: 1, sheen: 0.3 },
  }),
  selenite: Object.freeze({
    habit: 'plate',
    frost: 'flake',
    len: 1.05,
    width: 2.1,
    crystal: {
      color: '#fbf7f0',
      attenuationColor: '#eee2d0',
      attenuationDistance: 2.6,
      roughness: 0.32,
      transmission: 0.5,
      iridescence: 0.25,
      dispersion: 0.04,
      ior: 1.52,
      sheen: 1,
      sheenColor: '#fff2dc',
      emissive: '#fff4e4',
    },
    frostMat: { color: '#f6efe6', transmission: 0.25, thickness: 0.2, roughness: 0.38, iridescence: 0.2, sheen: 0.9, sheenColor: '#fff1dc' },
  }),
  calcite: Object.freeze({
    habit: 'rhomb',
    frost: 'grain',
    len: 1.45,
    width: 1.55,
    crystal: {
      color: '#fff7ee',
      attenuationColor: '#f0cdb0',
      attenuationDistance: 1.5,
      roughness: 0.04,
      dispersion: 0.85,
      ior: 1.66,
      iridescence: 0.5,
      emissive: '#ffe6cf',
    },
    frostMat: { color: '#efe3d6', transmission: 0.6, thickness: 0.25, roughness: 0.12, iridescence: 0.5, sheen: 0.2 },
  }),
})

/** The mineral a morphology grows. */
export function crystalStyleFor(morphologyType) {
  if (morphologyType === 'segmented') return CRYSTAL_STYLES.selenite
  if (morphologyType === 'trilobite') return CRYSTAL_STYLES.calcite
  return CRYSTAL_STYLES.quartz
}

export function createHabitGeometry(habit) {
  if (habit === 'plate') return createPlateCrystalGeometry()
  if (habit === 'rhomb') return createRhombCrystalGeometry()
  return createPrismCrystalGeometry()
}

export function createFrostGeometry(frost) {
  if (frost === 'flake') return createFlakeGeometry()
  if (frost === 'grain') return createGrainGeometry()
  return createBeadGeometry()
}

/** Plain-JSON style params → material overrides (colours to THREE.Color). */
export function styleMaterialParams(params) {
  const out = {}
  for (const [k, v] of Object.entries(params)) out[k] = typeof v === 'string' && v.startsWith('#') ? new THREE.Color(v) : v
  return out
}
