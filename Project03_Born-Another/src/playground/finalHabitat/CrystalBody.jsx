import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createExp05SurfaceEvaluator } from '../finalForm/exp05SurfaceEvaluator.js'
import {
  EXP05_DEFAULT_MORPHOLOGY_TYPE,
  normalizeExp05MorphologyType,
} from '../finalForm/exp05MorphologyTypes.js'
import { normalizeExp05Temperature } from '../finalForm/exp05EnvironmentCoupling.js'
import { crystalGrowth, rimeAmount, smoothstep } from '../crystalForm/crystallization.js'
import { habitatHeight, habitatRng } from './habitatField.js'
import { nucleusFragment, nucleusVertex, patchMembrane } from './habitatShaders.js'
import {
  createCrystalMaterial,
  createBeadGeometry,
  createBeadMaterial,
  createPrismCrystalGeometry,
  orientAlong,
  PRISM_HEIGHT,
} from './crystalShapes.js'

/*
 * Exp07 — the Final Form organism rebuilt as a nucleus–membrane structure in
 * which crystallization is part of the form:
 *
 *   membrane   transmissive, iridescent shell on the exact Exp05 surface
 *              (shared surface evaluator + Life). It breathes, is pulled up
 *              into collars around erupting clusters (aTent) and frosts over
 *              along veins near the growth sites (aFrost).
 *   nucleus    opaque glowing core (seen refracted through the membrane) with
 *              filaments; frost veins spread across it as it freezes.
 *   fibres     golden strands bridging nucleus and membrane.
 *   crystals   rooted INSIDE the body near the nucleus; they lengthen through
 *              the membrane as crystallization rises (hidden until they pierce).
 *   frost      frost-flower rosettes of pearl beads along the veins and around
 *              each cluster (blush sheen, never needles).
 */

const BODY_DETAIL = 28
const FIBRES = 420
const FIBRE_SEGMENTS = 6
const BEAD_MAX = 1800
const RESEAT_INTERVAL = 0.6
const NUCLEUS_SCALE = 0.76

/* ---------- small 3D value noise (JS) for the frost / vein field ---------- */
function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(s + 1, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function noise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const f = (t) => t * t * (3 - 2 * t)
  const u = f(x - xi), v = f(y - yi), w = f(z - zi)
  const l = (a, b, t) => a + (b - a) * t
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, s)
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  )
}

function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

function randomDir(r) {
  const u = r() * 2 - 1
  const a = r() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(a), u, s * Math.sin(a)]
}

/** Unit-sphere vertex directions shared by every seat. */
function createBase() {
  let geo = new THREE.IcosahedronGeometry(1, BODY_DETAIL)
  geo.deleteAttribute('normal')
  geo.deleteAttribute('uv')
  geo = mergeVertices(geo)
  const count = geo.attributes.position.count
  const dirs = new Float32Array(count * 3)
  const dirList = new Array(count)
  const p = geo.attributes.position.array
  for (let i = 0; i < count; i++) {
    const d = norm3([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]])
    dirs.set(d, i * 3)
    dirList[i] = d
  }
  return { index: geo.index.array.slice(), count, dirs, dirList }
}

function nearestVertex(base, dir) {
  let best = 0
  let bestDot = -2
  for (let i = 0; i < base.count; i++) {
    const d = base.dirs[i * 3] * dir[0] + base.dirs[i * 3 + 1] * dir[1] + base.dirs[i * 3 + 2] * dir[2]
    if (d > bestDot) {
      bestDot = d
      best = i
    }
  }
  return best
}

/** Seed-stable layout of eruptions, crystals, frost and fibres. */
function buildPlan(base, seed, siteDirections) {
  const r = habitatRng((Number(seed) || 1) * 977 + 5)
  const sites = siteDirections.slice(0, 12).map(norm3)
  while (sites.length < 7) sites.push(randomDir(r))

  /* Eruptions favour the upper body (reference: crown + one side). */
  const ranked = sites
    .map((d) => ({ d, score: d[1] * 0.85 + d[0] * 0.25 + r() * 0.45 }))
    .sort((a, b) => b.score - a.score)
  const eruptions = ranked.slice(0, 4).map((e, k) => ({
    dir: e.d,
    vertex: nearestVertex(base, e.d),
    radius: k === 0 ? 0.34 : 0.24,
    strength: k === 0 ? 1 : 0.65,
  }))
  const minor = ranked.slice(4).map((e) => e.d)

  const crystals = []
  eruptions.forEach((e, k) => {
    const n = k === 0 ? 13 : 8
    for (let j = 0; j < n; j++) {
      const main = j === 0
      const big = main ? 1 : Math.pow(r(), 1.5)
      const ang = r() * Math.PI * 2
      const spread = main ? 0 : (0.06 + r() * 0.16) * (k === 0 ? 1.2 : 1)
      const fan = main ? 0.25 : 0.7 + r() * 0.6
      crystals.push({
        vertex: e.vertex,
        offT: Math.cos(ang) * spread,
        offB: Math.sin(ang) * spread,
        tiltT: main ? (r() - 0.5) * 0.3 : Math.cos(ang) * fan,
        tiltB: main ? (r() - 0.5) * 0.3 : Math.sin(ang) * fan,
        spin: r() * Math.PI,
        embed: 0.14 + r() * 0.06,
        protrude: main ? (k === 0 ? 0.52 : 0.32) * (0.9 + r() * 0.25) : 0.1 + big * (k === 0 ? 0.3 : 0.2),
        wr: 0.34 + r() * 0.12,
        th: k * 0.06 + (main ? 0 : 0.08 + (1 - big) * 0.3) + r() * 0.08,
      })
    }
  })
  const extra = minor.concat(Array.from({ length: 10 }, () => norm3(randomDir(r).map((v, i) => (i === 1 ? Math.abs(v) : v)))))
  for (const d of extra) {
    const n = 1 + Math.floor(r() * 3)
    const vertex = nearestVertex(base, d)
    for (let j = 0; j < n; j++) {
      const ang = r() * Math.PI * 2
      crystals.push({
        vertex,
        offT: Math.cos(ang) * r() * 0.08,
        offB: Math.sin(ang) * r() * 0.08,
        tiltT: Math.cos(ang) * (0.3 + r() * 0.5),
        tiltB: Math.sin(ang) * (0.3 + r() * 0.5),
        spin: r() * Math.PI,
        embed: 0.08 + r() * 0.05,
        protrude: 0.05 + r() * 0.1,
        wr: 0.4 + r() * 0.15,
        th: 0.32 + r() * 0.5,
      })
    }
  }

  /* Per-vertex tent (membrane collars) and frost field (veins + proximity). */
  const tent = new Float32Array(base.count)
  const frost = new Float32Array(base.count)
  const cosR = eruptions.map((e) => Math.cos(e.radius))
  for (let i = 0; i < base.count; i++) {
    const x = base.dirs[i * 3], y = base.dirs[i * 3 + 1], z = base.dirs[i * 3 + 2]
    let t = 0
    eruptions.forEach((e, k) => {
      const d = x * e.dir[0] + y * e.dir[1] + z * e.dir[2]
      t += smoothstep(cosR[k], 1, d) * e.strength
    })
    tent[i] = Math.min(1, t)
    let prox = 0
    for (const s of sites) prox = Math.max(prox, x * s[0] + y * s[1] + z * s[2])
    const v = noise3(x * 3.2 + 11, y * 3.2, z * 3.2, 7)
    const veins = Math.pow(1 - Math.abs(v * 2 - 1), 5)
    const mottle = noise3(x * 6.5, y * 6.5 + 3, z * 6.5, 9)
    frost[i] = Math.min(1, 0.45 * smoothstep(0.55, 0.97, prox) + 0.4 * veins + 0.12 * mottle + 0.55 * tent[i])
  }

  /* Frost flowers: rosettes of pearl beads, centred where the frost field is
     strong (veins, growth sites, cluster collars). */
  const beads = []
  let guard = 0
  while (beads.length < BEAD_MAX && guard < BEAD_MAX * 40) {
    guard++
    const vertex = Math.floor(r() * base.count)
    const f = frost[vertex]
    if (r() > Math.pow(f, 2.6)) continue
    const radius = 0.018 + r() * 0.03
    const count = 6 + Math.floor(r() * 8)
    const th = Math.min(0.92, Math.max(0, 1 - f * 0.95 + r() * 0.1))
    for (let k = 0; k < count && beads.length < BEAD_MAX; k++) {
      const ring = k === 0 ? 0 : Math.sqrt(r())
      const ang = r() * Math.PI * 2
      beads.push({
        vertex,
        offT: Math.cos(ang) * ring * radius,
        offB: Math.sin(ang) * ring * radius,
        size: radius * (k === 0 ? 0.5 : 0.22 + (1 - ring) * 0.25 + r() * 0.12),
        lift: (1 - ring) * radius * 0.35,
        th: th + ring * 0.06,
      })
    }
  }

  /* Fibres: nucleus → inner membrane, with a gentle bow. */
  const fibres = Array.from({ length: FIBRES }, () => {
    const vertex = Math.floor(r() * base.count)
    const d = base.dirList[vertex]
    /* End at a different, nearby direction so strands wander across the
       space instead of radiating like spokes. */
    const end = nearestVertex(base, norm3([d[0] + (r() - 0.5) * 1.1, d[1] + (r() - 0.5) * 1.1, d[2] + (r() - 0.5) * 1.1]))
    return {
      vertex,
      end,
      bow: [(r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 2],
      amp: 0.08 + r() * 0.16,
      start: 0.7 + r() * 0.4,
      reach: 0.78 + r() * 0.16,
      warm: r(),
    }
  })

  /* Crystallization facets: planes (Fibonacci sphere, jittered) that cut the
     body into flat crystal faces as it freezes. */
  const facets = []
  const FACETS = 46
  for (let i = 0; i < FACETS; i++) {
    const y = 1 - (2 * (i + 0.5)) / FACETS
    const rad = Math.sqrt(1 - y * y)
    const a = i * 2.399963 + r() * 0.4
    const n = norm3([Math.cos(a) * rad + (r() - 0.5) * 0.2, y + (r() - 0.5) * 0.2, Math.sin(a) * rad + (r() - 0.5) * 0.2])
    facets.push({ n, vertex: nearestVertex(base, n), depth: 0.88 + r() * 0.07 })
  }

  return { eruptions, crystals, beads, fibres, tent, frost, facets }
}

/* ---------- shaders ---------- */

export default function CrystalBody({
  life,
  crystalRef,
  envRef,
  temperature = 0.5,
  morphologyType = EXP05_DEFAULT_MORPHOLOGY_TYPE,
  groundY = 0,
  layers,
  timeRef,
  /** Kin: live placement { x, z, lift, spin, phase, pulse, scale, snap } (hero: none). */
  placeRef = null,
  coreLight = true,
  children = null,
}) {
  const seed = life?.seed
  const morphType = normalizeExp05MorphologyType(morphologyType)
  const tempValue = normalizeExp05Temperature(temperature)

  const evaluator = useMemo(
    () => createExp05SurfaceEvaluator({ seed, morphologyType: morphType, temperature: tempValue }),
    [seed, morphType, tempValue],
  )
  useLayoutEffect(() => () => evaluator.dispose(), [evaluator])

  const base = useMemo(createBase, [])
  const sites = life?.outputs?.surface?.spatialGrowthSites
  const siteKey = (sites ?? []).map((s) => s.id).join('|')
  const plan = useMemo(
    () => buildPlan(base, seed, (sites ?? []).map((s) => s.direction)),
    // siteKey captures the site set; directions are stable per id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, seed, siteKey],
  )

  /* ---------- GPU resources ---------- */
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBreath: { value: 0.03 },
      uTent: { value: 0 },
      uRime: { value: 0 },
      uCore: { value: new THREE.Color('#ffd2c0') },
      uCoreGlow: { value: 0.07 },
      uFilm: { value: 0.24 },
      uFacet: { value: 0 },
    }),
    [],
  )
  const nucleusUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uGold: { value: new THREE.Color('#ffd2ad') },
      uPink: { value: new THREE.Color('#f5b3cf') },
      uBlue: { value: new THREE.Color('#cfe0ff') },
      uFrost: { value: new THREE.Color('#f4f1ff') },
      uShell: { value: new THREE.Color('#ecdde8') },
    }),
    [],
  )
  const resources = useMemo(() => {
    const membraneGeo = new THREE.BufferGeometry()
    membraneGeo.setIndex(new THREE.BufferAttribute(base.index, 1))
    membraneGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base.count * 3), 3))
    membraneGeo.setAttribute('aTent', new THREE.BufferAttribute(plan.tent, 1))
    membraneGeo.setAttribute('aFrost', new THREE.BufferAttribute(plan.frost, 1))
    membraneGeo.setAttribute('aFacetOffset', new THREE.BufferAttribute(new Float32Array(base.count * 3), 3))
    membraneGeo.setAttribute('aFacetNormal', new THREE.BufferAttribute(new Float32Array(base.count * 3), 3))

    const nucleusGeo = new THREE.BufferGeometry()
    nucleusGeo.setIndex(new THREE.BufferAttribute(base.index, 1))
    nucleusGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base.count * 3), 3))

    const fibreGeo = new THREE.BufferGeometry()
    const fibreVerts = FIBRES * FIBRE_SEGMENTS * 2
    fibreGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(fibreVerts * 3), 3))
    const fibreColors = new Float32Array(fibreVerts * 3)
    const gold = new THREE.Color('#b8884e')
    const pink = new THREE.Color('#a8738f')
    const pale = new THREE.Color('#b3a89c')
    plan.fibres.forEach((f, i) => {
      for (let s = 0; s < FIBRE_SEGMENTS; s++) {
        for (let e = 0; e < 2; e++) {
          const t = (s + e) / FIBRE_SEGMENTS
          const c = gold.clone().lerp(f.warm > 0.5 ? pink : pale, t)
          fibreColors.set([c.r, c.g, c.b], ((i * FIBRE_SEGMENTS + s) * 2 + e) * 3)
        }
      }
    })
    fibreGeo.setAttribute('color', new THREE.BufferAttribute(fibreColors, 3))

    const membraneMat = new THREE.MeshPhysicalMaterial({
      color: '#fff4f8',
      metalness: 0,
      roughness: 0.05,
      transmission: 1,
      thickness: 0.9,
      ior: 1.32,
      iridescence: 0.75,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [100, 1000],
      attenuationColor: new THREE.Color('#f6d2e2'),
      attenuationDistance: 3,
      specularIntensity: 0.7,
      clearcoat: 0.3,
      clearcoatRoughness: 0.12,
      sheen: 0.25,
      sheenColor: new THREE.Color('#ffd6ec'),
      envMapIntensity: 0.95,
    })
    patchMembrane(membraneMat, uniforms)

    const nucleusMat = new THREE.ShaderMaterial({
      uniforms: nucleusUniforms,
      vertexShader: nucleusVertex,
      fragmentShader: nucleusFragment,
    })
    const fibreMat = new THREE.LineBasicMaterial({ vertexColors: true, fog: false })

    return {
      membraneGeo,
      nucleusGeo,
      fibreGeo,
      membraneMat,
      nucleusMat,
      fibreMat,
      crystalGeo: createPrismCrystalGeometry(),
      beadGeo: createBeadGeometry(),
      crystalMat: createCrystalMaterial({
        color: '#f3f0ff',
        attenuationColor: new THREE.Color('#e4d6ff'),
        attenuationDistance: 1.5,
        iridescence: 1,
        emissive: new THREE.Color('#efe6ff'),
        emissiveIntensity: 0.03,
        envMapIntensity: 2,
        clearcoatRoughness: 0.06,
      }),
      frostMat: createBeadMaterial(),
    }
  }, [base, plan, uniforms, nucleusUniforms])

  useEffect(
    () => () => {
      for (const value of Object.values(resources)) value.dispose?.()
    },
    [resources],
  )

  const groupRef = useRef(null)
  const crystalsRef = useRef(null)
  const frostRef = useRef(null)
  const seatRef = useRef({ data: null, key: null, life: null, resources: null, at: -1 })
  const scratch = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(),
      n: new THREE.Vector3(),
      t: new THREE.Vector3(),
      b: new THREE.Vector3(),
      a: new THREE.Vector3(),
      ref: new THREE.Vector3(),
    }),
    [],
  )

  useLayoutEffect(() => {
    if (crystalsRef.current) crystalsRef.current.count = 0
    if (frostRef.current) frostRef.current.count = 0
  }, [resources])

  function seat() {
    const seated = evaluator.evaluateMany(base.dirList, life, { finiteDifferenceNormal: false })
    const pos = resources.membraneGeo.attributes.position.array
    let cx = 0, cy = 0, cz = 0
    for (let i = 0; i < base.count; i++) {
      const p = seated[i]?.position ?? base.dirList[i]
      pos[i * 3] = p[0]
      pos[i * 3 + 1] = p[1]
      pos[i * 3 + 2] = p[2]
      cx += p[0]; cy += p[1]; cz += p[2]
    }
    cx /= base.count; cy /= base.count; cz /= base.count
    let unit = 0
    let minY = Infinity
    const nuc = resources.nucleusGeo.attributes.position.array
    for (let i = 0; i < base.count; i++) {
      const j = i * 3
      const dx = pos[j] - cx, dy = pos[j + 1] - cy, dz = pos[j + 2] - cz
      unit += Math.hypot(dx, dy, dz)
      minY = Math.min(minY, pos[j + 1])
      const pinch = NUCLEUS_SCALE * (0.86 + 0.24 * noise3(base.dirs[j] * 2.1, base.dirs[j + 1] * 2.1, base.dirs[j + 2] * 2.1, 3))
      nuc[j] = cx + dx * pinch
      nuc[j + 1] = cy + dy * pinch
      nuc[j + 2] = cz + dz * pinch
    }
    unit /= base.count
    resources.membraneGeo.attributes.position.needsUpdate = true
    resources.membraneGeo.computeVertexNormals()
    resources.membraneGeo.computeBoundingSphere()
    resources.nucleusGeo.attributes.position.needsUpdate = true
    resources.nucleusGeo.computeVertexNormals()
    resources.nucleusGeo.computeBoundingSphere()

    /* Faceted (crystallized) target: each ray from the centre stops at the
       nearest facet plane, never deeper than 14% or prouder than 4%. */
    const facetOffset = resources.membraneGeo.attributes.aFacetOffset.array
    const planes = plan.facets.map((f) => {
      const v = f.vertex * 3
      const h = ((pos[v] - cx) * f.n[0] + (pos[v + 1] - cy) * f.n[1] + (pos[v + 2] - cz) * f.n[2]) * f.depth
      return { n: f.n, h }
    })
    const facetPos = new Float32Array(base.count * 3)
    for (let i = 0; i < base.count; i++) {
      const j = i * 3
      const dx = pos[j] - cx, dy = pos[j + 1] - cy, dz = pos[j + 2] - cz
      const rs = Math.hypot(dx, dy, dz) || 1
      const ux = dx / rs, uy = dy / rs, uz = dz / rs
      let rf = Infinity
      for (const pl of planes) {
        const d = ux * pl.n[0] + uy * pl.n[1] + uz * pl.n[2]
        if (d > 0.3) rf = Math.min(rf, pl.h / d)
      }
      const rt = Math.max(rs * 0.86, Math.min(rs * 1.04, rf))
      facetOffset[j] = ux * (rt - rs)
      facetOffset[j + 1] = uy * (rt - rs)
      facetOffset[j + 2] = uz * (rt - rs)
      facetPos[j] = pos[j] + facetOffset[j]
      facetPos[j + 1] = pos[j + 1] + facetOffset[j + 1]
      facetPos[j + 2] = pos[j + 2] + facetOffset[j + 2]
    }
    const facetGeo = new THREE.BufferGeometry()
    facetGeo.setIndex(resources.membraneGeo.index)
    facetGeo.setAttribute('position', new THREE.BufferAttribute(facetPos, 3))
    facetGeo.computeVertexNormals()
    resources.membraneGeo.attributes.aFacetNormal.array.set(facetGeo.attributes.normal.array)
    resources.membraneGeo.attributes.aFacetNormal.needsUpdate = true
    resources.membraneGeo.attributes.aFacetOffset.needsUpdate = true
    facetGeo.dispose()

    /* Fibres */
    const fp = resources.fibreGeo.attributes.position.array
    plan.fibres.forEach((f, i) => {
      const j = f.vertex * 3
      const k = f.end * 3
      const sx = cx + (pos[j] - cx) * NUCLEUS_SCALE * f.start * 0.8
      const sy = cy + (pos[j + 1] - cy) * NUCLEUS_SCALE * f.start * 0.8
      const sz = cz + (pos[j + 2] - cz) * NUCLEUS_SCALE * f.start * 0.8
      const ex = cx + (pos[k] - cx) * f.reach
      const ey = cy + (pos[k + 1] - cy) * f.reach
      const ez = cz + (pos[k + 2] - cz) * f.reach
      const point = (t) => {
        const bow = Math.sin(t * Math.PI) * f.amp * unit
        return [
          sx + (ex - sx) * t + f.bow[0] * bow,
          sy + (ey - sy) * t + f.bow[1] * bow,
          sz + (ez - sz) * t + f.bow[2] * bow,
        ]
      }
      for (let s = 0; s < FIBRE_SEGMENTS; s++) {
        const k = (i * FIBRE_SEGMENTS + s) * 6
        fp.set(point(s / FIBRE_SEGMENTS), k)
        fp.set(point((s + 1) / FIBRE_SEGMENTS), k + 3)
      }
    })
    resources.fibreGeo.attributes.position.needsUpdate = true
    resources.fibreGeo.computeBoundingSphere()

    return {
      pos,
      normal: resources.membraneGeo.attributes.normal.array,
      facet: facetOffset,
      center: [cx, cy, cz],
      unit,
      minY,
    }
  }

  useFrame((state, delta) => {
    if (!life) return
    const crystals = crystalsRef.current
    const frost = frostRef.current
    const group = groupRef.current
    if (!crystals || !frost || !group) return
    const now = state.clock.elapsedTime
    const time = timeRef?.current ?? now

    const seatState = seatRef.current
    const key = `${evaluator.seed}|${morphType}|${tempValue}|${plan.crystals.length}`
    const stale = seatState.key !== key || seatState.life !== life
    const rebuilt = seatState.resources !== resources
    if (!seatState.data || rebuilt || (stale && (seatState.key !== key || now - seatState.at > RESEAT_INTERVAL))) {
      seatState.data = seat()
      seatState.key = key
      seatState.life = life
      seatState.resources = resources
      seatState.at = now
    }
    const data = seatState.data
    const S = data.unit
    /* Placement: the hero floats at the clearing; kin follow their sim seat. */
    const place = placeRef?.current
    const k = place ? Math.max(0.0001, place.scale) : 1
    const phase = place?.phase ?? 0
    let gy = groundY
    if (place) {
      if (place.snap) {
        group.position.x = place.x
        group.position.z = place.z
      } else {
        const f = Math.min(1, delta * 2.2)
        group.position.x += (place.x - group.position.x) * f
        group.position.z += (place.z - group.position.z) * f
      }
      gy = habitatHeight(group.position.x, group.position.z)
      group.scale.setScalar(k)
      group.visible = k > 0.01
      group.rotation.y = place.spin
    } else {
      /* Hero: a slow, small wandering loop around the clearing. */
      group.position.x = Math.sin(time * 0.07) * 0.7
      group.position.z = Math.sin(time * 0.05 + 1.1) * 0.5
    }
    /* Float well above the sand: slow bob, a gentle sway. */
    const pulse = place?.pulse ?? 0.5
    const hover = gy + (-data.minY + 1.7 * S + Math.sin(time * pulse + phase) * 0.16 * S) * k + (place?.lift ?? 0)
    if (place?.snap || !group.userData.placed) {
      group.position.y = hover
      group.userData.placed = true
      if (place) place.snap = false
    } else {
      group.position.y += (hover - group.position.y) * Math.min(1, delta * 3)
    }
    group.rotation.z = Math.sin(time * 0.37 + phase) * 0.04
    group.rotation.x = Math.sin(time * 0.29 + 1.3 + phase) * 0.03

    const level = crystalRef.current?.level ?? 0
    const moisture = envRef.current?.moisture ?? 0.5
    const turbulence = envRef.current?.turbulence ?? 0
    const rime = rimeAmount(level, moisture)

    uniforms.uTime.value = time
    uniforms.uBreath.value = 0.035 * S * (1 - 0.85 * level) * (1 + turbulence * 1.5)
    const tentLift = 0.17 * S * smoothstep(0.12, 0.8, level)
    uniforms.uTent.value = tentLift
    uniforms.uRime.value = layers?.frost === false ? 0 : rime
    const facetAmt = smoothstep(0.22, 0.95, level)
    uniforms.uFacet.value = facetAmt
    nucleusUniforms.uTime.value = time
    nucleusUniforms.uLevel.value = level

    const { m, q, p, s, n, t, b, a, ref } = scratch
    const frame = (vertex) => {
      const j = vertex * 3
      n.set(data.normal[j], data.normal[j + 1], data.normal[j + 2]).normalize()
      ref.set(Math.abs(n.y) > 0.9 ? 1 : 0, Math.abs(n.y) > 0.9 ? 0 : 1, 0)
      t.crossVectors(n, ref).normalize()
      b.crossVectors(n, t)
      return j
    }

    /* Crystals: rooted inside, pierce the membrane as they grow. */
    for (let i = 0; i < plan.crystals.length; i++) {
      const c = plan.crystals[i]
      const j = frame(c.vertex)
      const g = crystalGrowth(level, c.th, 0.3)
      const depth = c.embed * S
      p.set(
        data.pos[j] + data.facet[j] * facetAmt,
        data.pos[j + 1] + data.facet[j + 1] * facetAmt,
        data.pos[j + 2] + data.facet[j + 2] * facetAmt,
      )
        .addScaledVector(n, -depth)
        .addScaledVector(t, c.offT * S)
        .addScaledVector(b, c.offB * S)
      a.copy(n).addScaledVector(t, c.tiltT).addScaledVector(b, c.tiltB).normalize()
      orientAlong(q, a, c.spin)
      const len = depth * 0.97 + c.protrude * S * g
      const w = (c.embed + c.protrude) * S * c.wr * (0.6 + 0.4 * g)
      s.set(w, len / PRISM_HEIGHT, w)
      m.compose(p, q, s)
      crystals.setMatrixAt(i, m)
    }
    crystals.count = plan.crystals.length
    crystals.instanceMatrix.needsUpdate = true

    /* Frost flowers: bead rosettes sitting on the membrane. */
    for (let i = 0; i < plan.beads.length; i++) {
      const f = plan.beads[i]
      const j = frame(f.vertex)
      const g = smoothstep(f.th, f.th + 0.14, rime * 1.05)
      const size = f.size * S * g
      orientAlong(q, n, 0)
      p.set(
        data.pos[j] + data.facet[j] * facetAmt,
        data.pos[j + 1] + data.facet[j + 1] * facetAmt,
        data.pos[j + 2] + data.facet[j + 2] * facetAmt,
      )
        .addScaledVector(t, f.offT * S)
        .addScaledVector(b, f.offB * S)
        .addScaledVector(n, plan.tent[f.vertex] * tentLift + f.lift * S * g - size * 0.2)
      s.set(size, size, size)
      m.compose(p, q, s)
      frost.setMatrixAt(i, m)
    }
    frost.count = plan.beads.length
    frost.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={resources.nucleusGeo} material={resources.nucleusMat} dispose={null} />
      <lineSegments
        geometry={resources.fibreGeo}
        material={resources.fibreMat}
        visible={layers?.fibres !== false}
        dispose={null}
      />
      <instancedMesh
        ref={frostRef}
        args={[resources.beadGeo, resources.frostMat, BEAD_MAX]}
        frustumCulled={false}
        visible={layers?.frost !== false}
        dispose={null}
      />
      <mesh geometry={resources.membraneGeo} material={resources.membraneMat} renderOrder={2} dispose={null} />
      <instancedMesh
        ref={crystalsRef}
        args={[resources.crystalGeo, resources.crystalMat, plan.crystals.length]}
        frustumCulled={false}
        visible={layers?.crystals !== false}
        renderOrder={3}
        dispose={null}
      />
      {/* Warm core light: tints the sand under the body (hero only). */}
      {coreLight ? <pointLight position={[0, 0, 0]} color="#ffd2c0" intensity={0.9} distance={4.5} decay={1.6} /> : null}
      {/* Final Form petals ride the same surface (same evaluator, same group). */}
      {children}
    </group>
  )
}
