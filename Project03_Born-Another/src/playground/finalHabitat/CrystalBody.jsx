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
import { LIGHT_DIR, nucleusFragment, nucleusVertex, patchMembrane } from './habitatShaders.js'
import { bodyFactors, characterOf, createHistory, createMorph, CRYSTAL_MODES, shapeHeight, speciesForm, stepMorph, updateHistory } from './unfoldForm.js'
import { KIN_TINTS } from './habitatKin.js'
import { ammoniteRadius, coilAmount, deathPhases, witherAmount } from './habitatFossil.js'
import { glowFragment, glowVertex } from './worldShaders.js'
import { noticeRadius, pickResponse, responseCooldown, responseEnvelope, RESPONSE_SECONDS } from './worldOpening.js'
import {

  createBeadMaterial,
  createBluntPrismGeometry,

  createFrostGeometry,
  createBodyCrystalMaterial,
  createBlockGeometry,
  createHabitGeometry,
  crystalStyleFor,
  styleMaterialParams,
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
const BEAD_MAX = 650
/** Below 1 so the membrane reads as a dense body: frost and crystals on the
 *  far side must not show through it. */
const MEMBRANE_TRANSMISSION = 0.5
/** Stone-lilac the husk clouds toward. */
const HUSK_TINT = new THREE.Color('#d6cfda')
/** Nucleus colours (alive) and the fossil grey they fade to in the husk. */
const NUCLEUS_ALIVE = { uGold: new THREE.Color('#ffd2ad'), uPink: new THREE.Color('#f5b3cf'), uBlue: new THREE.Color('#cfe0ff') }
const NUCLEUS_FOSSIL = new THREE.Color('#bdb4bf')
const RESEAT_INTERVAL = 0.6
/** Reseat spacing while the medium (temperature / morph inputs) is changing. */
const KEY_RESEAT_INTERVAL = 0.18
/** Per-second rate the visible skin eases toward a new seat. */
const MORPH_EASE_RATE = 3.2
/* Shared by every CrystalBody: when the last (non-urgent) reseat ran. */
const seatClock = { last: 0 }
const SEAT_SPACING_MS = 60
const NUCLEUS_SCALE = 0.76

const GLOW_WHITE = new THREE.Color('#ffffff')

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
/** A petal: a thin cupped ellipse lying on the skin (one side lifted). */
function createPetalGeometry() {
  const geo = new THREE.CircleGeometry(1, 18)
  geo.rotateX(-Math.PI / 2)
  const p = geo.attributes.position.array
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2]
    p[i] = x * 0.62
    p[i + 2] = z + 1
    p[i + 1] = (x * x) * 0.25 + (z + 1) * (z + 1) * 0.06
  }
  geo.computeVertexNormals()
  return geo
}

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
  /* Neighbour lists (CSR), for the baked cavity shading. */
  const index = geo.index.array.slice()
  const sets = Array.from({ length: count }, () => new Set())
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2]
    sets[a].add(b); sets[a].add(c); sets[b].add(a); sets[b].add(c); sets[c].add(a); sets[c].add(b)
  }
  const nbStart = new Uint32Array(count + 1)
  for (let i = 0; i < count; i++) nbStart[i + 1] = nbStart[i] + sets[i].size
  const nb = new Uint32Array(nbStart[count])
  for (let i = 0; i < count; i++) {
    let k = nbStart[i]
    for (const j of sets[i]) nb[k++] = j
  }
  return { index, count, dirs, dirList, nbStart, nb }
}

/**
 * Baked cavity (ambient occlusion from the shape): how much each vertex sits
 * in a hollow relative to its ring, smoothed a little. Computed at reseat
 * only — free at render time.
 */
function bakeCavity(base, pos, nrm, out) {
  const n = base.count
  const raw = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const j = i * 3
    let sum = 0
    let len = 0
    const s0 = base.nbStart[i], s1 = base.nbStart[i + 1]
    for (let k = s0; k < s1; k++) {
      const q = base.nb[k] * 3
      const dx = pos[q] - pos[j], dy = pos[q + 1] - pos[j + 1], dz = pos[q + 2] - pos[j + 2]
      const l = Math.hypot(dx, dy, dz) || 1
      sum += (dx * nrm[j] + dy * nrm[j + 1] + dz * nrm[j + 2]) / l
      len++
    }
    raw[i] = len ? sum / len : 0
  }
  /* Two smoothing passes: occlusion is broader than one ring. */
  let a = raw
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      let acc = a[i]
      const s0 = base.nbStart[i], s1 = base.nbStart[i + 1]
      for (let k = s0; k < s1; k++) acc += a[base.nb[k]]
      b[i] = acc / (1 + s1 - s0)
    }
    a = b
  }
  for (let i = 0; i < n; i++) out[i] = smoothstep(0.01, 0.16, a[i])
  return out
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
function buildPlan(base, seed, siteDirections, habit = 'prisms') {
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
      reach: 0.56 + r() * 0.16,
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

  /* Each species crystallizes in its own habit: every crystal site grows a
     spray of needles, a stack of blades, or a knot of blocks. */
  const grown = []
  for (const c of crystals) {
    if (habit === 'prisms') {
      /* A druse: stout terminated columns, nearly parallel, of mixed size. */
      const k = 3 + Math.floor(r() * 3)
      for (let i = 0; i < k; i++) {
        const a = r() * Math.PI * 2
        const cone = 0.06 + r() * 0.3
        const rr = i === 0 ? 0 : 0.02 + r() * 0.05
        grown.push({ ...c, offT: c.offT + Math.cos(a) * rr, offB: c.offB + Math.sin(a) * rr, tiltT: c.tiltT * 0.7 + Math.cos(a) * cone, tiltB: c.tiltB * 0.7 + Math.sin(a) * cone, spin: r() * Math.PI, protrude: c.protrude * (i === 0 ? 0.9 : 0.35 + r() * 0.5), wr: c.wr * (0.55 + r() * 0.25), th: c.th + r() * 0.08 })
      }
    } else if (habit === 'plates') {
      const k = 2 + Math.floor(r() * 3)
      for (let i = 0; i < k; i++) {
        grown.push({ ...c, offT: c.offT + (i - k / 2) * 0.03, offB: c.offB + (r() - 0.5) * 0.02, tiltT: c.tiltT * 0.6 + (r() - 0.5) * 0.25, tiltB: c.tiltB * 0.6 + (r() - 0.5) * 0.25, spin: c.spin + i * 0.18, protrude: c.protrude * (0.55 + r() * 0.45), wr: c.wr * (0.9 + r() * 0.3), th: c.th + i * 0.03 })
      }
    } else {
      const k = 3 + Math.floor(r() * 3)
      for (let i = 0; i < k; i++) {
        const a = r() * Math.PI * 2
        const rr = 0.02 + r() * 0.06
        grown.push({ ...c, offT: c.offT + Math.cos(a) * rr, offB: c.offB + Math.sin(a) * rr, tiltT: (r() - 0.5) * 1.6, tiltB: (r() - 0.5) * 1.6, spin: r() * Math.PI, protrude: c.protrude * (0.25 + r() * 0.25), wr: c.wr * (1.1 + r() * 0.6), th: c.th + r() * 0.1, block: true })
      }
    }
  }

  /* Petals: translucent scales lying on the skin; wet water grows more. */
  const petals = []
  for (let i = 0; i < 320; i++) {
    const vertex = Math.floor(r() * base.count)
    petals.push({
      vertex,
      offT: (r() - 0.5) * 0.03,
      offB: (r() - 0.5) * 0.03,
      size: 0.035 + Math.pow(r(), 2) * 0.05,
      lift: 0.25 + r() * 0.6,
      spin: r() * Math.PI * 2,
      th: r(),
    })
  }

  return { eruptions, crystals: grown, beads, fibres, tent, frost, facets, petals }
}

/* ---------- shaders ---------- */

export default function CrystalBody({
  life,
  crystalRef,
  envRef,
  temperature = 0.5,
  morphologyType = EXP05_DEFAULT_MORPHOLOGY_TYPE,
  /** Morphology amplitude — must match the petals' (they share the surface). */
  lobeAmplitude = 1,
  /** Hero size (World Final: the same size law as the kin). */
  bodyScale = 1,
  groundY = 0,
  layers,
  timeRef,
  /** Kin: live placement { x, z, lift, spin, phase, pulse, scale, snap } (hero: none). */
  placeRef = null,
  coreLight = true,
  /** Palette shift for this individual (KIN_TINTS entry). */
  tint = KIN_TINTS[0],
  /** Hero: publishes { x, y, z, r } each frame and reads `contacts` back. */
  bodyRef = null,
  /** { t }: seconds since this life ended (−1 while alive). */
  deathRef = null,
  /** Hero: wander around this [x, z] instead of the clearing (World Final). */
  home = null,
  /** World Final: shared registry / hover / focus / dimming (see HabitatScene). */
  world = null,
  /** Id of this life in `world` ('hero' or a kin id). */
  selfId = 'hero',
  /** Notice the viewer nearby and respond (World Final). */
  responsive = false,
  /** Faint light signal visible through the haze (World Final). */
  glow = false,
  children = null,
}) {
  const seed = life?.seed
  const morphType = normalizeExp05MorphologyType(morphologyType)
  const crystalStyle = crystalStyleFor(morphType)
  const tempValue = normalizeExp05Temperature(temperature)

  /* Temperature is passed per seat — rebuilding the evaluator re-samples the
     whole radius field, which stalled every slider tick. */
  const evaluator = useMemo(
    () => createExp05SurfaceEvaluator({ seed, morphologyType: morphType }),
    [seed, morphType],
  )
  useLayoutEffect(() => () => evaluator.dispose(), [evaluator])

  const base = useMemo(createBase, [])
  const sites = life?.outputs?.surface?.spatialGrowthSites
  const siteKey = (sites ?? []).map((s) => s.id).join('|')
  const plan = useMemo(
    () => buildPlan(base, seed, (sites ?? []).map((s) => s.direction), speciesForm(morphType).habit),
    // siteKey captures the site set; directions are stable per id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, seed, siteKey, morphType],
  )

  /* ---------- GPU resources ---------- */
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBreath: { value: 0.03 },
      uTent: { value: 0 },
      uRime: { value: 0 },
      uCore: { value: new THREE.Color('#ffd2c0') },
      uCoreGlow: { value: 0.13 },
      uFilm: { value: 0.24 },
      uFacet: { value: 0 },
      uRim: { value: 0.32 },
      uRimColor: { value: new THREE.Color('#e2f4ff') },
      uContactDir: { value: [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1)] },
      uContactAmt: { value: [0, 0, 0] },
      uContactDepth: { value: 0 },
      uBodyCentre: { value: new THREE.Vector3() },
      uDrift: { value: new THREE.Vector3() },
      uCoil: { value: 0 },
      /* Unfolding (folds, flow strands, an aperture onto the light inside). */
      uUnit: { value: 1 },
      uFold: { value: 0 },
      uOpen: { value: 0 },
      uOpenDir: { value: new THREE.Vector3(0, 0, 1) },
      uFlow: { value: 1 },
      uFlowTime: { value: 0 },
      uSwirl: { value: 0 },
      uInnerLight: { value: new THREE.Color('#ffa24a') },
      uBubble: { value: 0 },
      uStrata: { value: 0 },
      uShrink: { value: 0 },
      uRidgeMode: { value: 0 },
      uBubbleScale: { value: 3.2 },
      uLightView: { value: new THREE.Vector3(0.4, 0.6, 0.5) },
      uDeep: { value: new THREE.Color('#d98aa8') },
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
      uOpen: { value: 0 },
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
    membraneGeo.setAttribute('aCoilOffset', new THREE.BufferAttribute(new Float32Array(base.count * 3), 3))
    membraneGeo.setAttribute('aCoilNormal', new THREE.BufferAttribute(new Float32Array(base.count * 3), 3))
    membraneGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(base.count * 3), 3))
    membraneGeo.setAttribute('aCavity', new THREE.BufferAttribute(new Float32Array(base.count), 1))

    const nucleusGeo = new THREE.BufferGeometry()
    nucleusGeo.setIndex(new THREE.BufferAttribute(base.index, 1))
    nucleusGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base.count * 3), 3))
    nucleusGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(base.count * 3), 3))

    /* Reseats land here; the visible skin eases toward them each frame. */
    const targetGeo = new THREE.BufferGeometry()
    targetGeo.setIndex(membraneGeo.index)
    targetGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base.count * 3), 3))
    const targetNucleusGeo = new THREE.BufferGeometry()
    targetNucleusGeo.setIndex(nucleusGeo.index)
    targetNucleusGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base.count * 3), 3))
    const targetFacet = new Float32Array(base.count * 3)

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
      color: '#fbe9f0',
      metalness: 0,
      roughness: 0.12,
      transmission: MEMBRANE_TRANSMISSION,
      thickness: 1.8,
      ior: 1.32,
      iridescence: 0.75,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [100, 1000],
      attenuationColor: new THREE.Color('#f1aecd'),
      attenuationDistance: 0.9,
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
    const fibreMat = new THREE.LineBasicMaterial({ vertexColors: true, fog: false, transparent: true })

    return {
      membraneGeo,
      nucleusGeo,
      targetGeo,
      targetNucleusGeo,
      targetFacet,
      fibreGeo,
      membraneMat,
      nucleusMat,
      fibreMat,
      /* Each species grows its own mineral (habit, frost, material). */
      /* Habit by species: needle sprays, stacked blades, cubic blocks. */
      crystalGeo: (() => {
        const habit = speciesForm(morphType).habit
        if (habit === 'prisms') return createBluntPrismGeometry()
        if (habit === 'blocks') return createBlockGeometry()
        return createHabitGeometry('plate')
      })(),
      petalGeo: createPetalGeometry(),
      petalMat: new THREE.MeshPhysicalMaterial({
        color: '#fdf8ff',
        metalness: 0,
        roughness: 0.16,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
        iridescence: 0.85,
        iridescenceIOR: 1.35,
        iridescenceThicknessRange: [180, 820],
        sheen: 0.6,
        sheenColor: new THREE.Color('#ffffff'),
        envMapIntensity: 1.3,
      }),
      beadGeo: createFrostGeometry(crystalStyle.frost),
      /* Real crystal: refracting, with an inside, bright edges, a frosted root. */
      crystalMat: createBodyCrystalMaterial(speciesForm(morphType).habit),
      frostMat: createBeadMaterial({
        emissiveIntensity: 0,
        ...styleMaterialParams(crystalStyle.frostMat),
      }),
    }
  }, [base, plan, uniforms, nucleusUniforms, crystalStyle, morphType])

  useEffect(
    () => () => {
      for (const value of Object.values(resources)) value.dispose?.()
    },
    [resources],
  )

  const tintAttenuation = useMemo(() => new THREE.Color(tint.attenuation), [tint])
  const coreLightRef = useRef(null)
  const glowRef = useRef(null)
  const pickRef = useRef(null)
  const respRef = useRef({ t0: -100, kind: 'still', strength: 0, pendingAt: -1, cooldownUntil: 0, hover: 0, radius: 1.4, dist: undefined })
  const glowMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(tint.core).lerp(GLOW_WHITE, 0.2) },
          uAlpha: { value: 0 },
        },
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    [tint],
  )
  useEffect(() => () => glowMaterial.dispose(), [glowMaterial])
  const pickMaterial = useMemo(() => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), [])
  useEffect(() => () => pickMaterial.dispose(), [pickMaterial])
  const huskLightRef = useRef(null)
  const unfoldRef = useRef({ open: 0, dir: new THREE.Vector3(0, 0, 1), flowTime: 0 })
  /* This life's history and what it makes of the body (see unfoldForm.js). */
  /* How the medium is shaping the body now / has shaped it (unfoldForm.js). */
  const morphRef = useRef(createMorph())
  const historyRef = useRef({ seed: null, history: null, character: null, at: -99, marks: 0, pulse: 0, waves: [0, 0, 0], axis: new THREE.Vector3(0, 1, 0) })
  const effLobeRef = useRef(lobeAmplitude)

  /* Individual palette shift (same material family, small hue moves). */
  useEffect(() => {
    resources.membraneMat.attenuationColor.set(tint.attenuation)
    resources.membraneMat.sheenColor.set(tint.sheen)
    uniforms.uCore.value.set(tint.core)
    uniforms.uInnerLight.value.set('#ffa24a').lerp(new THREE.Color(tint.core), 0.2)
    uniforms.uDeep.value.set(tint.attenuation)
    /* The body's crystals: clear, faintly tinted by the life, rooted in its skin. */
    const cmat = resources.crystalMat
    cmat.attenuationColor.set('#ece2f4').lerp(new THREE.Color(tint.attenuation), 0.35)
    cmat.userData.uniforms.uSkin.value.set(tint.sheen).lerp(new THREE.Color(tint.attenuation), 0.35)
  }, [resources, tint, uniforms, crystalStyle, morphType])

  const groupRef = useRef(null)
  const crystalsRef = useRef(null)
  const frostRef = useRef(null)
  /* Nucleus + fibres: contract with the skin so nothing pokes through. */
  const innerRef = useRef(null)
  const petalsRef = useRef(null)
  const seatRef = useRef({ data: null, key: null, life: null, resources: null, at: -1, facetAmt: 0, coil: 0 })

  /* Remains: a frozen copy of this body as it is now (husk skin + crystals,
     world transform). The habitat lays it on the seabed when the life ends. */
  const snapshot = () => {
    const data = seatRef.current.data
    const group = groupRef.current
    const crystals = crystalsRef.current
    if (!data || !group) return null
    const { facetAmt, coil } = seatRef.current
    const n = data.pos.length
    const pos = new Float32Array(n)
    for (let i = 0; i < n; i++) pos[i] = data.pos[i] + data.facet[i] * facetAmt + data.coil[i] * coil
    /* Keep the shape the medium gave it (relief along the normal, contraction). */
    {
      const tmp = new THREE.BufferGeometry()
      tmp.setIndex(new THREE.BufferAttribute(base.index, 1))
      tmp.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3))
      tmp.computeVertexNormals()
      const nrm = tmp.attributes.normal.array
      const [cx, cy, cz] = data.center
      const u = {
        unit: data.unit,
        openDir: uniforms.uOpenDir.value.toArray(),
        flowTime: uniforms.uFlowTime.value,
        swirl: uniforms.uSwirl.value,
        fold: uniforms.uFold.value,
        bubble: uniforms.uBubble.value,
        strata: uniforms.uStrata.value,
        ridgeMode: uniforms.uRidgeMode.value,
        bubbleScale: uniforms.uBubbleScale.value,
      }
      const shrink = 1 - 0.14 * uniforms.uShrink.value
      for (let i = 0; i < n; i += 3) {
        const lx = data.pos[i], ly = data.pos[i + 1], lz = data.pos[i + 2]
        const fx = lx - cx, fy = ly - cy, fz = lz - cz
        const fl = Math.hypot(fx, fy, fz) || 1
        const h = shapeHeight([fx / fl, fy / fl, fz / fl], [lx, ly, lz], u)
        pos[i] = cx + (pos[i] + nrm[i] * h - cx) * shrink
        pos[i + 1] = cy + (pos[i + 1] + nrm[i + 1] * h - cy) * shrink
        pos[i + 2] = cz + (pos[i + 2] + nrm[i + 2] * h - cz) * shrink
      }
      tmp.dispose()
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setIndex(new THREE.BufferAttribute(base.index.slice(), 1))
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    group.updateMatrixWorld()
    return {
      geometry,
      crystalGeometry: resources.crystalGeo.clone(),
      crystalMatrices: crystals ? crystals.instanceMatrix.array.slice(0, crystals.count * 16) : new Float32Array(0),
      crystalCount: crystals ? crystals.count : 0,
      matrix: group.matrixWorld.clone(),
      species: morphType,
      style: crystalStyle,
      tint,
    }
  }
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
      inv: new THREE.Quaternion(),
      vel: new THREE.Vector3(),
      drift: new THREE.Vector3(),
      lastPos: new THREE.Vector3(),
      lean: new THREE.Vector2(),
      centre: new THREE.Vector3(),
    }),
    [],
  )

  useLayoutEffect(() => {
    if (crystalsRef.current) crystalsRef.current.count = 0
    if (frostRef.current) frostRef.current.count = 0
  }, [resources])

  /** Evaluates the surface into the target buffers (not the visible skin). */
  function seat() {
    const seated = evaluator.evaluateMany(base.dirList, life, {
      finiteDifferenceNormal: false,
      lobeAmplitude: effLobeRef.current,
      temperature: tempValue,
    })
    const pos = resources.targetGeo.attributes.position.array
    let cx = 0, cy = 0, cz = 0
    for (let i = 0; i < base.count; i++) {
      const p = seated[i]?.position ?? base.dirList[i]
      pos[i * 3] = p[0]
      pos[i * 3 + 1] = p[1]
      pos[i * 3 + 2] = p[2]
      cx += p[0]; cy += p[1]; cz += p[2]
    }
    cx /= base.count; cy /= base.count; cz /= base.count
    /* What happened to this life: marks swell or press the skin, and the
       side it was watched from flares into a lip. */
    const character = historyRef.current.character
    if (character) {
      const f = bodyFactors(character, base.dirs)
      let ax = 0, ay = 0, az = 0
      for (let i = 0; i < base.count; i++) {
        const j = i * 3
        const k = 1 + f[i]
        pos[j] = cx + (pos[j] - cx) * k
        pos[j + 1] = cy + (pos[j + 1] - cy) * k
        pos[j + 2] = cz + (pos[j + 2] - cz) * k
        ax += pos[j]; ay += pos[j + 1]; az += pos[j + 2]
      }
      cx = ax / base.count; cy = ay / base.count; cz = az / base.count
    }
    let unit = 0
    let minY = Infinity
    const nuc = resources.targetNucleusGeo.attributes.position.array
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
    let rmax = 0
    for (let i = 0; i < base.count; i++) {
      const j = i * 3
      rmax = Math.max(rmax, Math.hypot(pos[j] - cx, pos[j + 1] - cy, pos[j + 2] - cz))
    }
    resources.targetGeo.computeVertexNormals()
    resources.targetNucleusGeo.computeVertexNormals()
    bakeCavity(base, pos, resources.targetGeo.attributes.normal.array, resources.membraneGeo.attributes.aCavity.array)
    resources.membraneGeo.attributes.aCavity.needsUpdate = true
    /* The visible skin sits between the old and new shape while easing. */
    for (const [shown, target] of [
      [resources.membraneGeo, resources.targetGeo],
      [resources.nucleusGeo, resources.targetNucleusGeo],
    ]) {
      target.computeBoundingSphere()
      shown.boundingSphere = target.boundingSphere.clone()
      shown.boundingSphere.radius *= 1.25
    }

    /* Faceted (crystallized) target: each ray from the centre stops at the
       nearest facet plane, never deeper than 14% or prouder than 4%. */
    const facetOffset = resources.targetFacet
    const planes = plan.facets.map((f) => {
      const v = f.vertex * 3
      const h = ((pos[v] - cx) * f.n[0] + (pos[v + 1] - cy) * f.n[1] + (pos[v + 2] - cz) * f.n[2]) * f.depth
      return { n: f.n, h }
    })
    /* The crystal habit follows the shape it froze in: warm ridges → a prism
       along its axis; turbulent strata → tabular (flat top and bottom). */
    const crystalMode = CRYSTAL_MODES[morphRef.current.mode] ?? CRYSTAL_MODES.plain
    if (crystalMode.extra) {
      const reach = (nx, ny, nz) => {
        let best = 0
        for (let i = 0; i < base.count; i++) {
          const j = i * 3
          best = Math.max(best, (pos[j] - cx) * nx + (pos[j + 1] - cy) * ny + (pos[j + 2] - cz) * nz)
        }
        return best
      }
      if (crystalMode.extra === 'tabular') {
        for (const ny of [1, -1]) planes.push({ n: [0, ny, 0], h: reach(0, ny, 0) * 0.78 })
      } else {
        const ax = historyRef.current.axis
        const ref = Math.abs(ax.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
        const t1 = new THREE.Vector3().crossVectors(ax, ref).normalize()
        const t2 = new THREE.Vector3().crossVectors(ax, t1)
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2
          const nx = t1.x * Math.cos(a) + t2.x * Math.sin(a)
          const ny = t1.y * Math.cos(a) + t2.y * Math.sin(a)
          const nz = t1.z * Math.cos(a) + t2.z * Math.sin(a)
          planes.push({ n: [nx, ny, nz], h: reach(nx, ny, nz) * 0.86 })
        }
      }
    }
    const [facetLo, facetHi] = crystalMode.facets
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
      const rt = Math.max(rs * facetLo, Math.min(rs * facetHi, rf))
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
    facetGeo.dispose()

    /* End of life: the crystallized husk coils into a ribbed planispiral
       (ammonite) shell — the Exp03 Spiral rule wound flat. Only computed in
       the last stretch of life (cheap otherwise). Keeps a trace of the facets. */
    const coilOffset = resources.membraneGeo.attributes.aCoilOffset.array
    /* Only the spiral closes into an ammonite. Dickinsonia and the trilobite
       crystallize in the silhouette they already have. */
    const wantsCoil = morphType === 'spiral' && (life?.dead || (life?.age ?? 0) >= 0.84)
    if (wantsCoil) {
      const coilPos = new Float32Array(base.count * 3)
      /* Only partly: the shell keeps the life's own shape under the coil. */
      const coilMax = character?.coilMax ?? 0.6
      for (let i = 0; i < base.count; i++) {
        const j = i * 3
        const dx = base.dirs[j], dy = base.dirs[j + 1], dz = base.dirs[j + 2]
        const r = unit * ammoniteRadius(dx, dy, dz)
        const ox = pos[j] + facetOffset[j], oy = pos[j + 1] + facetOffset[j + 1], oz = pos[j + 2] + facetOffset[j + 2]
        const tx = ox + (cx + dx * r + facetOffset[j] * 0.35 - ox) * coilMax
        const ty = oy + (cy + dy * r + facetOffset[j + 1] * 0.35 - oy) * coilMax
        const tz = oz + (cz + dz * r + facetOffset[j + 2] * 0.35 - oz) * coilMax
        coilOffset[j] = tx - (pos[j] + facetOffset[j])
        coilOffset[j + 1] = ty - (pos[j + 1] + facetOffset[j + 1])
        coilOffset[j + 2] = tz - (pos[j + 2] + facetOffset[j + 2])
        coilPos[j] = tx
        coilPos[j + 1] = ty
        coilPos[j + 2] = tz
      }
      const coilGeo = new THREE.BufferGeometry()
      coilGeo.setIndex(resources.membraneGeo.index)
      coilGeo.setAttribute('position', new THREE.BufferAttribute(coilPos, 3))
      coilGeo.computeVertexNormals()
      resources.membraneGeo.attributes.aCoilNormal.array.set(coilGeo.attributes.normal.array)
      coilGeo.dispose()
    } else {
      coilOffset.fill(0)
      resources.membraneGeo.attributes.aCoilNormal.array.set(resources.targetGeo.attributes.normal.array)
    }
    resources.membraneGeo.attributes.aCoilOffset.needsUpdate = true
    resources.membraneGeo.attributes.aCoilNormal.needsUpdate = true

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

    return { hasCoil: wantsCoil, center: [cx, cy, cz], unit, minY, rmax }
  }

  /** Move the visible skin (and its shape scalars) a step toward the last seat.
   *  Returns the largest remaining gap so easing can stop once settled. */
  function easeSurface(data, target, k) {
    const m = resources.membraneGeo.attributes
    const n = resources.nucleusGeo.attributes
    const pairs = [
      [m.position, resources.targetGeo.attributes.position.array],
      [m.normal, resources.targetGeo.attributes.normal.array],
      [m.aFacetOffset, resources.targetFacet],
      [n.position, resources.targetNucleusGeo.attributes.position.array],
      [n.normal, resources.targetNucleusGeo.attributes.normal.array],
    ]
    let gap = 0
    for (const [attr, to] of pairs) {
      const from = attr.array
      for (let i = 0; i < from.length; i++) {
        const d = to[i] - from[i]
        from[i] += d * k
        const ad = d < 0 ? -d : d
        if (ad > gap) gap = ad
      }
      attr.needsUpdate = true
    }
    for (let i = 0; i < 3; i++) data.center[i] += (target.center[i] - data.center[i]) * k
    data.unit += (target.unit - data.unit) * k
    data.minY += (target.minY - data.minY) * k
    data.rmax += (target.rmax - data.rmax) * k
    return gap * (1 - k)
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
    /* History → character (every ~2 s; quantized, so reseats stay rare). */
    {
      const hist = historyRef.current
      if (hist.seed !== life.seed) {
        hist.seed = life.seed
        hist.history = createHistory(life.seed)
        hist.character = characterOf(hist.history, life.seed, morphType)
        hist.at = now
        hist.marks = 0
        hist.pulse = 0
        morphRef.current = createMorph()
        unfoldRef.current.rime = undefined
        unfoldRef.current.wet = 0
      }
      if (!life.dead && now - hist.at > 4) {
        hist.at = now
        hist.character = characterOf(hist.history, life.seed, morphType)
      }
      /* The species form emerges, but only as far as this life lets it. */
      effLobeRef.current = Math.min(lobeAmplitude, hist.character.lobeCap)
    }
    const key = `${evaluator.seed}|${morphType}|${tempValue}|${plan.crystals.length}|${effLobeRef.current}|${historyRef.current.character.key}|${morphRef.current.mode}`
    const stale = seatState.key !== key || seatState.life !== life
    const rebuilt = seatState.resources !== resources
    const mustSeat = !seatState.data || rebuilt
    /* Env changes (slider drags) reseat at most every KEY_RESEAT_INTERVAL;
       the easing below fills the gaps, so a drag reads as one motion. */
    const wantSeat = stale && now - seatState.at > (seatState.key !== key ? KEY_RESEAT_INTERVAL : RESEAT_INTERVAL)
    /* A reseat costs tens of ms (8k-vertex surface evaluation + normals).
       Several lives reseating in the same frame stacked into a visible hitch
       (read as flicker), so non-urgent reseats take turns: one per ~60 ms. */
    const wallNow = performance.now()
    if (mustSeat || (wantSeat && wallNow - seatClock.last > SEAT_SPACING_MS)) {
      seatClock.last = wallNow
      const target = seat()
      if (mustSeat) {
        const m = resources.membraneGeo.attributes
        seatState.data = {
          pos: m.position.array,
          normal: m.normal.array,
          facet: m.aFacetOffset.array,
          coil: m.aCoilOffset.array,
          center: [...target.center],
          unit: target.unit,
          minY: target.minY,
          rmax: target.rmax,
          hasCoil: target.hasCoil,
        }
      }
      seatState.data.hasCoil = target.hasCoil
      seatState.target = target
      seatState.settling = true
      seatState.key = key
      seatState.life = life
      seatState.resources = resources
      seatState.at = now
    }
    const data = seatState.data
    if (seatState.settling) {
      /* First seat snaps; later ones ease in (~0.3 s) instead of jumping. */
      const ease = mustSeat ? 1 : 1 - Math.exp(-Math.min(0.1, delta) * MORPH_EASE_RATE)
      seatState.settling = easeSurface(data, seatState.target, ease) > 1e-5
    }
    const S = data.unit
    /* End of life: wither (last stretch of AGE), then coil, sink and rest. */
    const age = life.age ?? 0
    const deathT = life.dead ? Math.max(0, deathRef?.current?.t ?? 0) : -1
    const wither = life.dead ? 1 : witherAmount(age)
    const phases = deathPhases(deathT)
    const coil = data.hasCoil ? (life.dead ? 1 : coilAmount(age)) : 0
    /* Placement: the hero floats at the clearing; kin follow their sim seat. */
    const place = placeRef?.current
    const k = place ? Math.max(0.0001, place.scale) : bodyScale
    const phase = place?.phase ?? 0
    let gy = groundY
    if (place) {
      if (place.snap || place.direct) {
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
      /* Hero: a slow, small wandering loop around its home, turning lazily. */
      const hx = home ? home[0] : 0
      const hz = home ? home[1] : 0
      group.position.x = hx + Math.sin(time * 0.07) * (home ? 1.4 : 0.7)
      group.position.z = hz + Math.sin(time * 0.05 + 1.1) * (home ? 1.0 : 0.5)
      group.rotation.y = Math.sin(time * 0.031) * 0.7
      if (home) gy = habitatHeight(group.position.x, group.position.z)
    }

    /* Encounter: a viewer nearby is noticed — after a small, uneven delay a
       delicate response (contract / expand / shimmer / stillness), then a
       cooldown. Measured against last frame's centre. */
    const resp = respRef.current
    const nowReal = now
    if (responsive && !life.dead) {
      const dist = state.camera.position.distanceTo(scratch.centre)
      resp.dist = dist
      const near = dist < noticeRadius(resp.radius || 1.4)
      if (near && nowReal > resp.cooldownUntil && resp.pendingAt < 0 && nowReal - resp.t0 > RESPONSE_SECONDS) {
        resp.pendingAt = nowReal + 0.2 + Math.random() * 1.1
      }
      if (resp.pendingAt >= 0 && nowReal >= resp.pendingAt) {
        resp.pendingAt = -1
        if (Math.random() < 0.85) {
          resp.t0 = nowReal
          resp.kind = pickResponse(Math.random())
          resp.strength = 0.6 + Math.random() * 0.4
        }
        resp.cooldownUntil = nowReal + RESPONSE_SECONDS + responseCooldown(Math.random())
      }
    }
    const re = responsive ? responseEnvelope(nowReal - resp.t0) * resp.strength : 0
    const still = resp.kind === 'still' ? re : 0
    /* Hover: a slight brightening only. */
    const hoverTarget = world?.current?.hoverId === selfId ? 1 : 0
    resp.hover += (hoverTarget - resp.hover) * Math.min(1, delta * 5)
    /* Suspended in water: slow, deep buoyant bob. */
    const pulse = place?.pulse ?? 0.3
    const hover = gy + (-data.minY + (2.6 - 2.05 * phases.sink) * S + Math.sin(time * pulse + phase) * 0.22 * S * (1 - 0.8 * wither) * (1 - 0.85 * still) + 0.12 * S * still) * k + (place?.lift ?? 0)
    if (place?.snap || place?.direct || !group.userData.placed) {
      group.position.y = hover
      group.userData.placed = true
      if (place) place.snap = false
    } else {
      group.position.y += (hover - group.position.y) * Math.min(1, delta * 3)
    }
    /* Velocity (world): kin from physics, hero from its own motion. */
    const dtc = Math.max(1e-3, Math.min(0.1, delta))
    if (place?.vel) scratch.vel.set(place.vel[0], place.vel[1], place.vel[2])
    else if (group.userData.hasLast) scratch.vel.copy(group.position).sub(scratch.lastPos).divideScalar(dtc)
    scratch.lastPos.copy(group.position)
    group.userData.hasLast = true
    /* Lean into the motion like a drifting jellyfish, sway with the swell. */
    const leanK = 1 - Math.exp(-dtc * 1.5)
    scratch.lean.x += (THREE.MathUtils.clamp(scratch.vel.z * 0.22, -0.22, 0.22) - scratch.lean.x) * leanK
    scratch.lean.y += (THREE.MathUtils.clamp(-scratch.vel.x * 0.22, -0.22, 0.22) - scratch.lean.y) * leanK
    group.rotation.z = Math.sin(time * 0.23 + phase) * 0.05 + scratch.lean.y
    group.rotation.x = Math.sin(time * 0.19 + 1.3 + phase) * 0.04 + scratch.lean.x
    /* Drag: the membrane trails its motion (local units, eased so it lags). */
    scratch.inv.copy(group.quaternion).invert()
    const want = scratch.p.copy(scratch.vel).applyQuaternion(scratch.inv).multiplyScalar(0.09 / k)
    if (want.length() > 0.16 * S) want.setLength(0.16 * S)
    scratch.drift.lerp(want, 1 - Math.exp(-dtc * 2))
    uniforms.uDrift.value.copy(scratch.drift)

    /* Collision body (centre height above the sand, radius; local units). */
    const bodyRadius = 0.4 * S + 0.6 * data.rmax
    const centreLocal = -data.minY + 2.6 * S + data.center[1]
    if (place) place.body = { centre: centreLocal, radius: bodyRadius }
    scratch.centre.set(data.center[0], data.center[1], data.center[2]).multiplyScalar(k).add(group.position)
    resp.radius = bodyRadius * k
    if (bodyRef?.current) {
      const hb = bodyRef.current
      hb.x = scratch.centre.x
      hb.y = scratch.centre.y
      hb.z = scratch.centre.z
      hb.r = bodyRadius * k
    }
    /* World Final registry: where each life is, for focus / brackets / dimming. */
    if (world?.current) {
      let entry = world.current.bodies.get(selfId)
      if (!entry) {
        entry = { x: 0, y: 0, z: 0, r: 1, dead: false, age: 0 }
        world.current.bodies.set(selfId, entry)
      }
      entry.x = scratch.centre.x
      entry.y = scratch.centre.y
      entry.z = scratch.centre.z
      entry.r = bodyRadius * k
      entry.dead = Boolean(life.dead)
      entry.age = age
      entry.species = morphType
      entry.snapshot = snapshot
    }
    /* Response shape: contraction / expansion of the membrane (subtle). */
    const sign = resp.kind === 'contract' ? -1 : resp.kind === 'expand' ? 1 : 0
    const sq = sign * re
    /* When another life's end dims the world, this one fades with it. */
    const dim = world?.current?.dimming
    const fade = !place && dim && dim.id && dim.id !== selfId ? 1 - dim.dusk : 1
    /* A new life (new seed) grows in from nothing where it is born. */
    if (resp.seed === undefined) resp.seed = life.seed
    if (resp.seed !== life.seed) {
      resp.seed = life.seed
      resp.bornAt = now
    }
    const birth = resp.bornAt === undefined ? 1 : smoothstep(0, 4.5, now - resp.bornAt)
    if (!place) {
      const kb = k * fade * Math.max(0.0001, birth)
      group.scale.set(kb * (1 + 0.07 * sq), kb * (1 - 0.035 * sq), kb * (1 + 0.07 * sq))
      group.visible = fade > 0.01 && birth > 0.005
    } else if (sq) {
      group.scale.set(k * (1 + 0.07 * sq), k * (1 - 0.035 * sq), k * (1 + 0.07 * sq))
    }
    if (pickRef.current) {
      pickRef.current.position.set(data.center[0], data.center[1], data.center[2])
      pickRef.current.scale.setScalar(bodyRadius * 1.08)
    }
    /* Contact dents: neighbours press the membrane in where they touch. */
    const contacts = place?.contacts ?? bodyRef?.current?.contacts ?? []
    scratch.inv.copy(group.quaternion).invert()
    for (let ci = 0; ci < 3; ci++) {
      const c = contacts[ci]
      uniforms.uContactAmt.value[ci] = c ? c.amount : 0
      if (c) uniforms.uContactDir.value[ci].set(c.dir[0], c.dir[1], c.dir[2]).applyQuaternion(scratch.inv).normalize()
    }
    uniforms.uContactDepth.value = 0.24 * S
    uniforms.uBodyCentre.value.set(data.center[0], data.center[1], data.center[2])

    /* A withering body crystallizes completely, whatever the medium. */
    const level = Math.max(crystalRef.current?.level ?? 0, wither)
    const moisture = envRef.current?.moisture ?? 0.5
    const turbulence = envRef.current?.turbulence ?? 0
    /* After death the surface keeps the frost it had. */
    const frozenState = unfoldRef.current
    if (!life.dead || frozenState.rime === undefined) frozenState.rime = rimeAmount(level, moisture)
    const rime = frozenState.rime

    uniforms.uTime.value = time
    uniforms.uBreath.value = 0.035 * S * (1 - 0.85 * level) * (1 + turbulence * 1.5) * (1 - wither)
    uniforms.uCoil.value = coil
    /* The husk: clouded, stony crystal; the warm core and the film go out. */
    const mm = resources.membraneMat
    mm.transmission = MEMBRANE_TRANSMISSION * (1 - 0.45 * wither)
    mm.roughness = 0.12 + 0.2 * wither
    mm.iridescence = 0.75 - 0.45 * wither
    mm.sheen = 0.25 * (1 - 0.6 * wither)
    mm.attenuationColor.copy(tintAttenuation).lerp(HUSK_TINT, wither)
    const shimmer = resp.kind === 'shimmer' ? re : 0
    uniforms.uCoreGlow.value = 0.13 * (1 - wither) + 0.12 * shimmer
    uniforms.uFilm.value = 0.24 - 0.18 * wither + 0.32 * shimmer + 0.06 * resp.hover
    uniforms.uRim.value = 0.32 + 0.16 * wither + 0.22 * shimmer + 0.18 * resp.hover
    mm.iridescence += 0.3 * shimmer
    if (sq) uniforms.uBreath.value *= 1 + 2 * Math.abs(sq)
    /* Light signal: breathes slowly, stronger from afar (it is how a life is
       first sensed), quiet up close, gone with the life. */
    if (glowRef.current) {
      const gm = glowRef.current
      const dist = resp.dist ?? state.camera.position.distanceTo(scratch.centre)
      const breath = 0.62 + 0.38 * Math.sin(now * (0.9 + pulse) + phase * 2.1)
      const far = 0.35 + 0.65 * smoothstep(5, 24, dist)
      const fadeFar = 1 - smoothstep(80, 150, dist)
      gm.material.uniforms.uAlpha.value =
        (0.34 * breath * far * fadeFar + 0.18 * resp.hover + 0.24 * shimmer + 0.45 * (1 - birth)) * (1 - wither) * fade
      gm.position.set(data.center[0], data.center[1], data.center[2])
      gm.scale.setScalar(bodyRadius * 6)
      gm.quaternion.copy(group.quaternion).invert().multiply(state.camera.quaternion)
    }
    resources.fibreMat.opacity = 0.7 * (1 - wither)
    if (coreLightRef.current) coreLightRef.current.intensity = 0.9 * (1 - wither)
    if (huskLightRef.current) huskLightRef.current.intensity = 2.6 * phases.dusk
    for (const key of Object.keys(NUCLEUS_ALIVE)) nucleusUniforms[key].value.copy(NUCLEUS_ALIVE[key]).lerp(NUCLEUS_FOSSIL, wither * 0.85)
    const tentLift = 0.17 * S * smoothstep(0.12, 0.8, level)
    uniforms.uTent.value = tentLift
    uniforms.uRime.value = layers?.frost === false ? 0 : rime
    const facetAmt = smoothstep(0.12, 0.92, level)
    seatState.facetAmt = facetAmt
    seatState.coil = coil
    uniforms.uFacet.value = facetAmt
    nucleusUniforms.uTime.value = time
    nucleusUniforms.uLevel.value = level

    /* Unfolding. Folds multiply as the life grows; fibres stream while it
       lives and freeze as it crystallizes; turbulence twists them. Near the
       viewer (or in focus) the skin slowly opens toward them onto the light
       inside; crystallizing closes it, and at the end it opens once more. */
    {
      const unf = unfoldRef.current
      const camDist = resp.dist ?? state.camera.position.distanceTo(scratch.centre)
      const notice = noticeRadius(resp.radius || 1.4)
      let openTarget = smoothstep(notice, notice * 0.3, camDist) * 0.75
      if (world?.current?.focusId === selfId) openTarget = Math.max(openTarget, 0.9)
      openTarget = Math.min(1, openTarget + 0.12 * resp.hover)
      openTarget *= (1 - 0.85 * level) * (1 - wither)
      if (deathT >= 0) openTarget = 0
      unf.open += (openTarget - unf.open) * Math.min(1, delta * 0.9)
      uniforms.uOpen.value = unf.open
      nucleusUniforms.uOpen.value = unf.open
      /* Turn the opening toward the viewer, slowly; unwatched, the fibres'
         pole wanders on its own. */
      /* The mouth is the life's own axis, turning partly toward the viewer. */
      const ownAxis = historyRef.current.axis
      if (openTarget > 0.05) {
        scratch.p.copy(state.camera.position).sub(scratch.centre).applyQuaternion(scratch.inv).normalize()
        scratch.p.lerp(ownAxis, 0.6)
      } else scratch.p.copy(ownAxis)
      if (scratch.p.lengthSq() > 1e-6) {
        scratch.p.normalize()
        unf.dir.lerp(scratch.p, Math.min(1, delta * 0.7))
        if (unf.dir.lengthSq() > 1e-6) unf.dir.normalize()
        else unf.dir.copy(scratch.p)
      }
      uniforms.uOpenDir.value.copy(unf.dir)
      /* Record this moment of the life. */
      if (!life.dead) {
        const viewer = scratch.a.copy(state.camera.position).sub(scratch.centre).applyQuaternion(scratch.inv)
        const vl = viewer.length()
        updateHistory(historyRef.current.history, {
          dt: Math.min(0.1, delta),
          env: { temperature: tempValue, moisture, turbulence },
          viewer: vl > 1e-6 ? [viewer.x / vl, viewer.y / vl, viewer.z / vl] : null,
          near: camDist < notice,
          focus: world?.current?.focusId === selfId,
        })
      }
      /* The life's own axis (its mouth) settles toward where it was watched from. */
      const hist = historyRef.current
      if (hist.character) {
        scratch.b.set(hist.character.axis[0], hist.character.axis[1], hist.character.axis[2])
        hist.axis.lerp(scratch.b, Math.min(1, delta * 0.3)).normalize()
      }
      uniforms.uUnit.value = S
      /* The medium shapes the body: warm → ridges, cold → contraction,
         wet → blisters, turbulent → strata. Remembered, then frozen as it
         crystallizes (see unfoldForm.js). */
      const form = speciesForm(morphType)
      uniforms.uRidgeMode.value = form.ridgeCode
      uniforms.uBubbleScale.value = form.bubbleScale
      scratch.t.copy(LIGHT_DIR).transformDirection(state.camera.matrixWorldInverse)
      uniforms.uLightView.value.copy(scratch.t)
      const morph = stepMorph(morphRef.current, { temperature: tempValue, moisture, turbulence }, life.dead ? 0 : Math.min(0.1, delta), level, morphType)
      /* The strongest shaping leads; the others recede, so the body reads as
         one thing at a time instead of everything at once. */
      const raw = morph.shown
      const top = Math.max(raw.ridge, raw.shrink, raw.bubble, raw.strata, 1e-4)
      const lead = (v) => v * Math.pow(v / top, 1.5)
      const sh = { ridge: lead(raw.ridge), shrink: lead(raw.shrink), bubble: lead(raw.bubble), strata: lead(raw.strata) }
      const grown = smoothstep(0, 0.6, age)
      uniforms.uFold.value = S * ((0.02 + 0.025 * grown) * (1 - 0.7 * Math.max(sh.bubble, sh.strata)) + 0.13 * sh.ridge) * (1 - 0.35 * sh.shrink)
      uniforms.uBubble.value = S * 0.17 * sh.bubble * (0.4 + 0.6 * grown)
      uniforms.uStrata.value = S * 0.11 * sh.strata * (0.4 + 0.6 * grown)
      uniforms.uShrink.value = sh.shrink
      if (innerRef.current) {
        const k = 1 - 0.14 * sh.shrink
        const [cx, cy, cz] = data.center
        innerRef.current.scale.setScalar(k)
        innerRef.current.position.set(cx * (1 - k), cy * (1 - k), cz * (1 - k))
      }
      const flow = (1 - 0.9 * level) * (1 - wither)
      unf.flowTime += Math.min(0.1, delta) * (0.35 + 1.4 * turbulence) * flow
      uniforms.uFlowTime.value = unf.flowTime
      uniforms.uFlow.value = 0.25 + 0.75 * flow
      uniforms.uSwirl.value += (turbulence - uniforms.uSwirl.value) * Math.min(1, delta * 0.5)
      if (coreLightRef.current) coreLightRef.current.intensity = 0.9 * (1 - wither) + 1.3 * unf.open
    }

    const { m, q, p, s, n, t, b, a, ref } = scratch
    /* Growths ride the membrane: the same drag and contact dents the shader
       applies to the skin, so crystals and frost never float off it. */
    const cx0 = data.center[0], cy0 = data.center[1], cz0 = data.center[2]
    const drift = uniforms.uDrift.value
    const driftLen = drift.length()
    const dentDepth = uniforms.uContactDepth.value
    const dentAmt = uniforms.uContactAmt.value
    const dentDir = uniforms.uContactDir.value
    const ride = (v) => {
      let fx = v.x - cx0, fy = v.y - cy0, fz = v.z - cz0
      const fl = Math.hypot(fx, fy, fz) || 1
      fx /= fl; fy /= fl; fz /= fl
      if (driftLen > 1e-5) {
        const lead = (fx * drift.x + fy * drift.y + fz * drift.z) / driftLen
        const k2 = 0.75 * smoothstep(0, 1, -lead) + 0.2 * smoothstep(0, 1, lead)
        v.x -= drift.x * k2; v.y -= drift.y * k2; v.z -= drift.z * k2
      }
      for (let ci = 0; ci < 3; ci++) {
        const amt = dentAmt[ci]
        if (!amt) continue
        const d = dentDir[ci]
        const cd = fx * d.x + fy * d.y + fz * d.z
        const press = smoothstep(0.5, 1, cd)
        const swell = smoothstep(0.1, 0.5, cd) * (1 - smoothstep(0.5, 0.78, cd))
        const off = amt * dentDepth * (0.3 * swell - press)
        v.x += fx * off; v.y += fy * off; v.z += fz * off
      }
      return v
    }

    const frame = (vertex) => {
      const j = vertex * 3
      n.set(data.normal[j], data.normal[j + 1], data.normal[j + 2]).normalize()
      ref.set(Math.abs(n.y) > 0.9 ? 1 : 0, Math.abs(n.y) > 0.9 ? 0 : 1, 0)
      t.crossVectors(n, ref).normalize()
      b.crossVectors(n, t)
      return j
    }

    /* Crystals: rooted inside, pierce the membrane as they grow. Their habit
       follows the shape the body froze in; they sit on its relief. */
    const cm = CRYSTAL_MODES[morphRef.current.mode] ?? CRYSTAL_MODES.plain
    const shapeU = {
      unit: S,
      openDir: uniforms.uOpenDir.value.toArray(),
      flowTime: uniforms.uFlowTime.value,
      swirl: uniforms.uSwirl.value,
      fold: uniforms.uFold.value,
      bubble: uniforms.uBubble.value,
      strata: uniforms.uStrata.value,
      ridgeMode: uniforms.uRidgeMode.value,
      bubbleScale: uniforms.uBubbleScale.value,
    }
    const shrinkK = 1 - 0.14 * uniforms.uShrink.value
    const openAmt = uniforms.uOpen.value
    const openDir = uniforms.uOpenDir.value
    const [ccx, ccy, ccz] = data.center
    /* Where the skin actually is (as the shader moves it): on its relief,
       sunk into the mouth, contracted — crystals root there. */
    const settle = (v, j) => {
      const fx = data.pos[j] - ccx, fy = data.pos[j + 1] - ccy, fz = data.pos[j + 2] - ccz
      const fl = Math.hypot(fx, fy, fz) || 1
      const ux = fx / fl, uy = fy / fl, uz = fz / fl
      v.addScaledVector(n, relief(j))
      const apW = 0.03 + 0.5 * openAmt
      const inCap = smoothstep(1 - apW, 1, ux * openDir.x + uy * openDir.y + uz * openDir.z)
      const sink = inCap * openAmt * S * 0.39
      v.x -= ux * sink; v.y -= uy * sink; v.z -= uz * sink
      v.x = ccx + (v.x - ccx) * shrinkK
      v.y = ccy + (v.y - ccy) * shrinkK
      v.z = ccz + (v.z - ccz) * shrinkK
      return v
    }
    const relief = (j) => {
      const lx = data.pos[j], ly = data.pos[j + 1], lz = data.pos[j + 2]
      const fx = lx - data.center[0], fy = ly - data.center[1], fz = lz - data.center[2]
      const fl = Math.hypot(fx, fy, fz) || 1
      return shapeHeight([fx / fl, fy / fl, fz / fl], [lx, ly, lz], shapeU)
    }
    for (let i = 0; i < plan.crystals.length; i++) {
      const c = plan.crystals[i]
      const j = frame(c.vertex)
      const g = crystalGrowth(level, c.th, 0.3)
      const depth = c.embed * S
      p.set(
        data.pos[j] + data.facet[j] * facetAmt + data.coil[j] * coil,
        data.pos[j + 1] + data.facet[j + 1] * facetAmt + data.coil[j + 1] * coil,
        data.pos[j + 2] + data.facet[j + 2] * facetAmt + data.coil[j + 2] * coil,
      )
      ride(p)
      settle(p, j)
      p.addScaledVector(n, -depth)
        .addScaledVector(t, c.offT * S)
        .addScaledVector(b, c.offB * S)
      a.copy(n).addScaledVector(t, c.tiltT).addScaledVector(b, c.tiltB).normalize()
      if (cm.flat) a.lerp(t, cm.flat).normalize()
      orientAlong(q, a, c.spin)
      /* Emerging from the skin rather than spiking out of it. */
      const len = depth * 0.97 + c.protrude * 0.6 * S * g * crystalStyle.len * cm.len
      const w = (c.embed + c.protrude * 0.6) * S * c.wr * 1.15 * (0.6 + 0.4 * g) * crystalStyle.width * cm.width
      s.set(w, len / PRISM_HEIGHT, w)
      m.compose(p, q, s)
      crystals.setMatrixAt(i, m)
    }
    crystals.count = plan.crystals.length
    crystals.instanceMatrix.needsUpdate = true

    /* Frost flowers: bead rosettes sitting on the membrane. Wet water grows
       more of these translucent petals, not only crystallization; after
       death they stay as they were. */
    const unfState = unfoldRef.current
    if (!life.dead) unfState.wet = layers?.frost === false ? 0 : smoothstep(0.5, 0.95, moisture) * 0.95 * (0.35 + 0.65 * smoothstep(0, 0.4, age))
    const wetPetals = unfState.wet ?? 0
    for (let i = 0; i < plan.beads.length; i++) {
      const f = plan.beads[i]
      const j = frame(f.vertex)
      const g = smoothstep(f.th, f.th + 0.14, rime * 1.05)
      const size = f.size * S * g
      orientAlong(q, n, 0)
      p.set(
        data.pos[j] + data.facet[j] * facetAmt + data.coil[j] * coil,
        data.pos[j + 1] + data.facet[j + 1] * facetAmt + data.coil[j + 1] * coil,
        data.pos[j + 2] + data.facet[j + 2] * facetAmt + data.coil[j + 2] * coil,
      )
      ride(p)
      settle(p, j)
      p.addScaledVector(t, f.offT * S)
        .addScaledVector(b, f.offB * S)
        .addScaledVector(n, plan.tent[f.vertex] * tentLift + f.lift * S * g - size * 0.2)
      s.set(size, size, size)
      m.compose(p, q, s)
      frost.setMatrixAt(i, m)
    }
    frost.count = plan.beads.length
    frost.instanceMatrix.needsUpdate = true

    /* Petals: translucent scales on the skin. A few always; wet water grows
       many more. They sit exactly where the skin is (never apart from it). */
    const petalsMesh = petalsRef.current
    if (petalsMesh) {
      const amount = Math.min(1, 0.12 + wetPetals)
      for (let i = 0; i < plan.petals.length; i++) {
        const f = plan.petals[i]
        const j = frame(f.vertex)
        const g = smoothstep(f.th, f.th + 0.08, amount) * (1 - 0.6 * level)
        const size = f.size * S * g * (0.8 + 0.5 * wetPetals)
        p.set(
          data.pos[j] + data.facet[j] * facetAmt + data.coil[j] * coil,
          data.pos[j + 1] + data.facet[j + 1] * facetAmt + data.coil[j + 1] * coil,
          data.pos[j + 2] + data.facet[j + 2] * facetAmt + data.coil[j + 2] * coil,
        )
        ride(p)
        settle(p, j)
        p.addScaledVector(t, f.offT * S).addScaledVector(b, f.offB * S).addScaledVector(n, size * 0.05)
        /* Lying on the skin, one edge lifted. */
        a.copy(n).multiplyScalar(Math.cos(f.lift)).addScaledVector(t, Math.sin(f.lift) * Math.cos(f.spin)).addScaledVector(b, Math.sin(f.lift) * Math.sin(f.spin)).normalize()
        orientAlong(q, a, f.spin)
        s.set(size, size, size)
        m.compose(p, q, s)
        petalsMesh.setMatrixAt(i, m)
      }
      petalsMesh.count = plan.petals.length
      petalsMesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        <mesh geometry={resources.nucleusGeo} material={resources.nucleusMat} dispose={null} />
        <lineSegments
          geometry={resources.fibreGeo}
          material={resources.fibreMat}
          visible={layers?.fibres !== false}
          dispose={null}
        />
      </group>
      <instancedMesh
        ref={frostRef}
        args={[resources.beadGeo, resources.frostMat, BEAD_MAX]}
        frustumCulled={false}
        visible={layers?.frost !== false}
        dispose={null}
      />
      <mesh geometry={resources.membraneGeo} material={resources.membraneMat} renderOrder={2} dispose={null} />
      <instancedMesh
        ref={petalsRef}
        args={[resources.petalGeo, resources.petalMat, plan.petals.length]}
        frustumCulled={false}
        visible={layers?.petals !== false}
        renderOrder={4}
        dispose={null}
      />
      <instancedMesh
        ref={crystalsRef}
        args={[resources.crystalGeo, resources.crystalMat, plan.crystals.length]}
        frustumCulled={false}
        visible={layers?.crystals !== false}
        renderOrder={3}
        dispose={null}
      />
      {/* Warm core light: tints the sand under the body (hero only). */}
      {coreLight ? <pointLight ref={coreLightRef} position={[0, 0, 0]} color="#ffd2c0" intensity={0.9} distance={4.5} decay={1.6} /> : null}
      {/* After death: a cool light stays on the husk while the habitat dims. */}
      {coreLight ? <pointLight ref={huskLightRef} position={[0.6, 3.2, 2.4]} color="#e6ebff" intensity={0} distance={14} decay={1.2} /> : null}
      {glow ? (
        <mesh ref={glowRef} material={glowMaterial} renderOrder={8} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ) : null}
      {world ? (
        <mesh
          ref={pickRef}
          material={pickMaterial}
          onPointerOver={(e) => {
            e.stopPropagation()
            world.current?.setHover?.(selfId)
          }}
          onPointerOut={() => world.current?.clearHover?.(selfId)}
          onClick={(e) => {
            if (e.delta > 6) return
            e.stopPropagation()
            world.current?.select?.(selfId)
          }}
        >
          <sphereGeometry args={[1, 16, 12]} />
        </mesh>
      ) : null}
      {/* Final Form petals ride the same surface (same evaluator, same group). */}
      {children}
    </group>
  )
}
