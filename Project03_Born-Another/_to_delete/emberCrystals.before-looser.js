/**
 * World Final — ember druses (three.js only).
 *
 * Warm translucent columns after the reference: long slender hexagonal
 * prisms bundled tight around one dominant crystal, with satellite clusters
 * and small points at the foot. Apricot at the root clearing toward a pale
 * rose tip, fine growth lines across the faces, frosted patches, light
 * glowing through the edges. Each druse rises from a low mound of sand, with
 * shallow glassy pools and loose shards stuck in the ground around it.
 */
import * as THREE from 'three'
import { habitatColor, habitatHeight, habitatNormal, habitatRng, HABITAT_SEED } from './habitatField.js'
import { orientAlong } from './crystalShapes.js'
import { EXPLORE_SITES } from './exploreSites.js'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

export const EMBER_DRUSES = EXPLORE_SITES.filter((s) => s.outcrop?.style === 'ember').map((s) => s.outcrop)

/**
 * Column habits (height 1, radius ≈ 0.5; local y runs 0 root → 1 tip):
 * chamfered hexagonal prisms with different terminations, so a druse reads
 * as many crystals rather than one shape repeated.
 *   long   — slender body, short pointed tip
 *   stout  — wide body, steep off-centre (rhombohedral) tip
 *   tapered — narrowing body, longer pyramid
 *   broken — tip snapped off on a slant
 */
export const EMBER_HABITS = {
  long: { taper: 0.04, tip: 0.12, lean: 0.04, flat: 1 },
  stout: { taper: 0.02, tip: 0.2, lean: 0.14, flat: 0.82 },
  tapered: { taper: 0.22, tip: 0.24, lean: 0.06, flat: 1 },
  broken: { taper: 0.05, tip: 0, lean: 0, flat: 0.9, cut: 0.16 },
}

export function createEmberColumnGeometry({ taper = 0.03, tip = 0.1, lean = 0.05, flat = 1, cut = 0 } = {}) {
  const bevel = 0.09
  const angles = []
  for (let k = 0; k < 6; k++) {
    const c = (k / 6) * Math.PI * 2
    angles.push(c - Math.PI / 6 + bevel, c + Math.PI / 6 - bevel)
  }
  /* flat < 1 squashes the section: real columns are rarely regular. */
  const ring = (radius, y, dx = 0, dy = () => 0) =>
    angles.map((a) => [Math.cos(a) * radius + dx, y + dy(a), Math.sin(a) * radius * flat])
  const top = 0.5 * (1 - taper)
  const body = 1 - tip - cut
  const rings = [ring(0.5, 0), ring(0.5 * (1 - taper * 0.4), body * 0.45), ring(top, body)]
  const tri = []
  const n = angles.length
  if (cut) {
    /* Slanted break: the top ring tilts, capped by a rough fan. */
    rings[2] = ring(top, body, 0, (a) => cut * (0.5 + 0.5 * Math.cos(a - 0.6)))
  } else {
    rings.push(ring(top * 0.45, body + tip * 0.66, lean * 0.5))
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < n; i++) {
      const a0 = rings[r][i], a1 = rings[r][(i + 1) % n]
      const b0 = rings[r + 1][i], b1 = rings[r + 1][(i + 1) % n]
      tri.push(a0, b0, a1, a1, b0, b1)
    }
  }
  const last = rings[rings.length - 1]
  const apex = cut ? [0.04, body + cut * 0.55, 0] : [lean, 1, lean * 0.3]
  for (let i = 0; i < n; i++) tri.push(last[i], apex, last[(i + 1) % n])
  const pos = new Float32Array(tri.length * 3)
  tri.forEach((v, i) => pos.set(v, i * 3))
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  return geo
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function moundOf(o) {
  return { x: o.x, z: o.z, radius: o.spread * 1.5 + 0.8 * o.scale, height: o.scale * 0.2 }
}

/** Mound bump (0 at the rim, 1 at the centre) with a lumpy outline. */
function moundBump(m, x, z) {
  const a = Math.atan2(z - m.z, x - m.x)
  const r = m.radius * (1 + 0.12 * Math.sin(a * 3 + m.x) + 0.07 * Math.sin(a * 7 + m.z))
  const d = Math.hypot(x - m.x, z - m.z) / r
  if (d >= 1) return 0
  const k = 1 - d * d
  return k * k
}

/** Ground under an ember druse: the sand plus its mound. */
export function emberGround(m, x, z) {
  return habitatHeight(x, z) + m.height * moundBump(m, x, z)
}

export function buildEmberLayout(druses = EMBER_DRUSES, seed = HABITAT_SEED + 717) {
  const r = habitatRng(seed)
  const crystals = []
  const pools = []
  const mounds = []
  for (const o of druses) {
    const m = moundOf(o)
    mounds.push(m)
    const n = habitatNormal(o.x, o.z)
    const up = new THREE.Vector3(n[0] * 0.5, 1, n[2] * 0.5).normalize()
    /* Each crystal grows from a root and fans out at its own angle: tall
       ones stand nearly upright, short ones splay and cross. */
    const habitFor = (h, big) => {
      const t = r()
      if (big) return t < 0.55 ? 'long' : t < 0.85 ? 'stout' : 'tapered'
      return t < 0.3 ? 'long' : t < 0.55 ? 'stout' : t < 0.8 ? 'tapered' : 'broken'
    }
    const add = (x, z, height, lean, az, opts = {}) => {
      const axis = new THREE.Vector3(
        up.x + Math.sin(lean) * Math.cos(az),
        up.y * Math.cos(lean),
        up.z + Math.sin(lean) * Math.sin(az),
      ).normalize()
      const habit = opts.habit ?? habitFor(height, height > o.scale * 0.7)
      const ratio = { long: 0.17, stout: 0.3, tapered: 0.2, broken: 0.24 }[habit] * (0.8 + r() * 0.45)
      crystals.push({
        x, z, y: emberGround(m, x, z) - height * (opts.sink ?? 0.1),
        axis, spin: r() * Math.PI * 2, height,
        width: height * ratio,
        depth: 0.75 + r() * 0.35,
        tint: r(),
        habit,
      })
    }
    const fan = r() * Math.PI * 2
    /* Main druse: one dominant column, a few tall companions, then a spray. */
    const roots = Math.round(o.count * 1.5)
    for (let i = 0; i < roots; i++) {
      const main = i === 0
      const tall = i < 4
      const ang = r() * Math.PI * 2
      const rad = main ? 0 : Math.pow(r(), 0.7) * o.spread * (tall ? 0.18 : 0.32)
      const h = o.scale * (main ? 1.3 : tall ? 0.7 + r() * 0.4 : 0.22 + Math.pow(r(), 1.5) * 0.6)
      const lean = main ? 0.04 + r() * 0.06 : tall ? 0.08 + r() * 0.22 : 0.3 + r() * 0.75
      /* Splay away from the centre, with some crossing back over it. */
      const az = main ? fan : r() < 0.78 ? ang + (r() - 0.5) * 0.9 : ang + Math.PI + (r() - 0.5)
      add(o.x + Math.cos(ang) * rad, o.z + Math.sin(ang) * rad, h, lean, az)
    }
    /* Satellite druses: smaller, each its own little fan. */
    const sats = 2 + Math.floor(r() * 3)
    for (let s2 = 0; s2 < sats; s2++) {
      const sa = fan + (s2 / sats) * Math.PI * 2 + (r() - 0.5) * 0.9
      const sr = o.spread * (0.7 + r() * 0.6)
      const sx = o.x + Math.cos(sa) * sr
      const sz = o.z + Math.sin(sa) * sr
      const k = 3 + Math.floor(r() * 5)
      const size = 0.28 + r() * 0.32
      for (let i = 0; i < k; i++) {
        const ang = r() * Math.PI * 2
        const rad = Math.sqrt(r()) * o.spread * 0.12
        const h = o.scale * size * (i === 0 ? 1 : 0.35 + r() * 0.6)
        add(sx + Math.cos(ang) * rad, sz + Math.sin(ang) * rad, h, i === 0 ? 0.1 + r() * 0.2 : 0.25 + r() * 0.7, ang + (r() - 0.5) * 1.2)
      }
    }
    /* Loose crystals: lying, half-buried or stuck in at an angle. */
    const loose = 7 + Math.floor(r() * 8)
    for (let i = 0; i < loose; i++) {
      const ang = r() * Math.PI * 2
      const rad = o.spread * (0.9 + r() * 2.4)
      const lying = r() < 0.4
      add(o.x + Math.cos(ang) * rad, o.z + Math.sin(ang) * rad, o.scale * (0.12 + r() * 0.3), lying ? 1.3 + r() * 0.2 : 0.3 + r() * 0.8, r() * Math.PI * 2, { sink: lying ? 0.02 : 0.28 })
    }
    /* Shallow pools settling in the low sand beside the mound. */
    const nPools = 12
    for (let i = 0, made = 0; i < nPools && made < 3; i++) {
      const ang = fan + Math.PI * (0.4 + r() * 1.2) + i * 2.1
      const rad = m.radius * (0.95 + r() * 1.1)
      const x = o.x + Math.cos(ang) * rad
      const z = o.z + Math.sin(ang) * rad
      const size = o.scale * (0.35 + r() * 0.35)
      let lo = Infinity
      let sum = 0
      for (let k = 0; k < 9; k++) {
        const a = (k / 8) * Math.PI * 2
        const rr = k === 8 ? 0 : size * 0.8
        const h = emberGround(m, x + Math.cos(a) * rr, z + Math.sin(a) * rr)
        lo = Math.min(lo, h)
        sum += h
      }
      let hi = -Infinity
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        hi = Math.max(hi, emberGround(m, x + Math.cos(a) * size * 0.8, z + Math.sin(a) * size * 0.8))
      }
      /* Only where the sand is nearly level: a pool never hangs on a slope. */
      if (hi - lo > 0.14 * size + 0.05 || moundBump(m, x, z) > 0.05) {
        r()
        r()
        continue
      }
      pools.push({ x, z, y: lo + (sum / 9 - lo) * 0.45, size, yaw: r() * Math.PI * 2, seed: r() * 10 })
      made++
    }
  }
  return { crystals, pools, mounds }
}

/**
 * Ember crystal, after the reference: thick glass whose colour lives in its
 * depth — amber where you look straight through a column, clear lilac at the
 * edges and toward the tips — with light caught inside (fractures, sparkles
 * that move with the view), bright facet edges, and a sandy frosting where it
 * leaves the ground. Each column differs in clarity and warmth.
 */
export function createEmberMaterial() {
  const uniforms = { uEmberGlow: { value: 1 }, uSand: { value: new THREE.Color('#bdb5cc') } }
  const material = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    metalness: 0,
    roughness: 0.035,
    transmission: 0.94,
    thickness: 1.6,
    ior: 1.55,
    dispersion: 0.6,
    attenuationColor: new THREE.Color('#f2a456'),
    attenuationDistance: 0.8,
    iridescence: 0.55,
    iridescenceIOR: 1.38,
    iridescenceThicknessRange: [160, 720],
    clearcoat: 0.8,
    clearcoatRoughness: 0.03,
    specularIntensity: 1,
    emissive: new THREE.Color('#000000'),
    envMapIntensity: 2.8,
  })
  material.userData.uniforms = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEmberLocal;\nvarying vec3 vEmberWorld;\nvarying float vEmberRand;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vEmberLocal = position;
        #ifdef USE_INSTANCING
          vEmberWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
          vEmberRand = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        #else
          vEmberWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          vEmberRand = 0.3;
        #endif`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vEmberLocal;
        varying vec3 vEmberWorld;
        varying float vEmberRand;
        uniform float uEmberGlow;
        uniform vec3 uSand;
        float emberHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float emberNoise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(emberHash(i), emberHash(i + vec3(1.0, 0.0, 0.0)), f.x),
                         mix(emberHash(i + vec3(0.0, 1.0, 0.0)), emberHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                     mix(mix(emberHash(i + vec3(0.0, 0.0, 1.0)), emberHash(i + vec3(1.0, 0.0, 1.0)), f.x),
                         mix(emberHash(i + vec3(0.0, 1.0, 1.0)), emberHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
        }
        float emberFbm(vec3 p) { return emberNoise(p) * 0.55 + emberNoise(p * 2.1 + 7.0) * 0.3 + emberNoise(p * 4.7 + 3.0) * 0.15; }
        float emberFrost() {
          float edge = 0.1 + 0.12 * emberFbm(vEmberWorld * 2.5);
          return 1.0 - smoothstep(edge - 0.07, edge + 0.05, vEmberLocal.y);
        }
        float emberEdge() {
          float a = atan(vEmberLocal.z, vEmberLocal.x) / 6.2831853 * 6.0 + 0.5;
          float f = fract(a);
          return 1.0 - smoothstep(0.0, 0.04, min(f, 1.0 - f));
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 eV = normalize(vViewPosition);
        float eFacing = abs(dot(normalize(vNormal), eV));
        float eClarity = smoothstep(0.55, 0.9, vEmberRand);
        float eWarm = emberFbm(vEmberWorld * 1.3 + vEmberRand * 11.0);
        vec3 amber = mix(vec3(0.96, 0.58, 0.26), vec3(1.0, 0.76, 0.42), eWarm);
        vec3 clearC = vec3(0.93, 0.9, 1.0);
        /* Colour in the depth: straight through is amber, grazing is clear. */
        float depthCol = pow(eFacing, 0.8) * (1.0 - 0.85 * eClarity) * (1.0 - 0.45 * smoothstep(0.65, 1.0, vEmberLocal.y));
        vec3 glass = mix(clearC, amber, clamp(depthCol * (0.85 + 0.5 * eWarm), 0.0, 1.0));
        float eFrostK = emberFrost();
        diffuseColor.rgb *= mix(glass, uSand * (0.82 + 0.3 * emberNoise(vEmberWorld * 40.0)), eFrostK);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float ePatch = smoothstep(0.6, 0.85, emberFbm(vEmberWorld * 3.0 + 5.0));
        roughnessFactor = clamp(roughnessFactor + ePatch * 0.16 + emberFrost() * 0.6, 0.02, 0.85);`,
      )
      .replace(
        '#include <transmission_fragment>',
        THREE.ShaderChunk.transmission_fragment.replace(
          'material.transmission = transmission;',
          'material.transmission = transmission * (1.0 - 0.8 * emberFrost());',
        ),
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 V = normalize(vViewPosition);
          float facing = abs(dot(normal, V));
          float clarity = smoothstep(0.55, 0.9, vEmberRand);
          float frost = emberFrost();
          /* Light caught inside: patterns that shift as the view moves. */
          vec3 R = reflect(-V, normal);
          vec3 q = vEmberWorld * 1.6 + R * 1.4 + vEmberRand * 7.0;
          float sparkle = smoothstep(0.74, 0.92, emberNoise(q * 3.0)) * emberNoise(q * 0.7);
          float fracture = pow(1.0 - abs(emberNoise(q * 0.9) * 2.0 - 1.0), 14.0);
          float rim = pow(1.0 - facing, 3.0);
          vec3 warm = mix(vec3(1.0, 0.62, 0.38), vec3(0.88, 0.84, 1.0), clarity);
          vec3 glow = warm * (pow(facing, 2.0) * 0.16 * (1.0 - clarity * 0.6) + rim * 0.06)
            + vec3(1.0, 0.96, 0.92) * (sparkle * 0.5 + fracture * 0.18 + emberEdge() * 0.18)
            + vec3(1.0, 0.94, 0.9) * smoothstep(0.86, 1.0, vEmberLocal.y) * 0.12;
          totalEmissiveRadiance += glow * (1.0 - frost) * uEmberGlow;
        }`,
      )
  }
  material.customProgramCacheKey = () => 'exp07-ember-crystal-v3'
  return material
}

const TINTS = ['#ffffff', '#ffeee2', '#ffe4d2', '#fbeef4', '#f4f0ff', '#fff1e4'].map((h) => new THREE.Color(h))
const TINT_WEIGHTS = [0.24, 0.24, 0.16, 0.14, 0.12, 0.1]
export function emberTintFor(t) {
  return tintFor(t)
}

function tintFor(t) {
  let acc = 0
  for (let i = 0; i < TINTS.length; i++) {
    acc += TINT_WEIGHTS[i]
    if (t < acc) return TINTS[i]
  }
  return TINTS[0]
}

function buildMoundGeometry(mounds, rings = 14, segments = 48) {
  const pos = []
  const col = []
  const idx = []
  const c = new THREE.Color()
  for (const m of mounds) {
    const base = pos.length / 3
    pos.push(m.x, emberGround(m, m.x, m.z), m.z)
    for (let i = 1; i <= rings; i++) {
      const t = i / rings
      for (let j = 0; j < segments; j++) {
        const a = (j / segments) * Math.PI * 2
        const rr = m.radius * 1.12 * t
        const x = m.x + Math.cos(a) * rr
        const z = m.z + Math.sin(a) * rr
        const bump = moundBump(m, x, z)
        /* Edges tuck under the sand so the seam disappears. */
        pos.push(x, habitatHeight(x, z) + m.height * bump - 0.05 * (1 - smooth(0, 0.25, bump)), z)
      }
    }
    for (let j = 0; j < segments; j++) idx.push(base, base + 1 + ((j + 1) % segments), base + 1 + j)
    for (let i = 1; i < rings; i++) {
      for (let j = 0; j < segments; j++) {
        const a0 = base + 1 + (i - 1) * segments + j
        const a1 = base + 1 + (i - 1) * segments + ((j + 1) % segments)
        const b0 = a0 + segments
        const b1 = a1 + segments
        idx.push(a0, a1, b0, a1, b1, b0)
      }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const nor = geo.attributes.normal.array
  for (let v = 0; v < pos.length / 3; v++) {
    if (nor[v * 3 + 1] < 0) {
      /* winding check failed for this layout; flip all once */
      const ia = geo.index.array
      for (let t = 0; t < ia.length; t += 3) [ia[t + 1], ia[t + 2]] = [ia[t + 2], ia[t + 1]]
      geo.computeVertexNormals()
      break
    }
  }
  const n2 = geo.attributes.normal.array
  for (let v = 0; v < pos.length / 3; v++) {
    const x = pos[v * 3]
    const y = pos[v * 3 + 1]
    const z = pos[v * 3 + 2]
    const slope = Math.min(1, (1 - n2[v * 3 + 1]) * 3)
    const rgb = habitatColor(x, z, y, slope)
    let wet = 0
    for (const m of mounds) wet = Math.max(wet, moundBump(m, x, z))
    /* Damp, darker sand around the roots, a little warmth from the glow. */
    const k = 1 - 0.18 * wet
    c.setRGB(rgb[0] * k * (1 + 0.05 * wet), rgb[1] * k, rgb[2] * k, THREE.SRGBColorSpace)
    col.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.computeBoundingSphere()
  return geo
}

function buildPoolGeometry(segments = 40) {
  const geo = new THREE.CircleGeometry(1, segments)
  geo.rotateX(-Math.PI / 2)
  const p = geo.attributes.position.array
  for (let i = 3; i < p.length; i += 3) {
    const a = Math.atan2(p[i + 2], p[i])
    const k = 1 + 0.22 * Math.sin(a * 3 + 0.6) + 0.12 * Math.sin(a * 5 + 2.1)
    p[i] *= k
    p[i + 2] *= k * 0.72
  }
  geo.computeVertexNormals()
  return geo
}

/** Everything for the ember druses; groundMaterial is the sand's own material. */
export function createEmberResources(groundMaterial) {
  const layout = buildEmberLayout()
  const crystalMat = createEmberMaterial()
  const crystals = new THREE.Group()
  const geos = []
  for (const [habit, params] of Object.entries(EMBER_HABITS)) {
    const list = layout.crystals.filter((c) => c.habit === habit)
    if (!list.length) continue
    const geo = createEmberColumnGeometry(params)
    geos.push(geo)
    const mesh = new THREE.InstancedMesh(geo, crystalMat, list.length)
    list.forEach((cr, i) => {
      orientAlong(_q, cr.axis, cr.spin)
      _p.set(cr.x, cr.y, cr.z)
      _s.set(cr.width, cr.height, cr.width * cr.depth)
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
      mesh.setColorAt(i, tintFor(cr.tint))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    crystals.add(mesh)
  }

  const moundGeo = buildMoundGeometry(layout.mounds)
  const mound = new THREE.Mesh(moundGeo, groundMaterial)

  const poolGeo = buildPoolGeometry()
  const poolMat = new THREE.MeshPhysicalMaterial({
    color: '#8f8aa3',
    metalness: 0.35,
    roughness: 0.02,
    transparent: true,
    opacity: 0.62,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 0.5,
    iridescenceIOR: 1.33,
    iridescenceThicknessRange: [180, 520],
    envMapIntensity: 2.2,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, Math.max(1, layout.pools.length))
  layout.pools.forEach((pl, i) => {
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pl.yaw)
    _p.set(pl.x, pl.y, pl.z)
    _s.set(pl.size, 1, pl.size)
    pools.setMatrixAt(i, _m.compose(_p, _q, _s))
  })
  pools.count = layout.pools.length
  pools.instanceMatrix.needsUpdate = true
  pools.renderOrder = 2

  return {
    crystals, mound, pools, crystalMat, layout,
    dispose() {
      for (const o of [...crystals.children, pools, ...geos, crystalMat, moundGeo, poolGeo, poolMat]) o.dispose?.()
    },
  }
}
