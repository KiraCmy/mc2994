/**
 * World Final: crystal spires — what the oldest lives became.
 *
 * Long before the three lives of the clearing, others lived and died in this
 * water. Their remains were buried, and over a very long time the mineral of
 * each species kept growing out of them, upward, toward the light:
 *  - spiral line (ammonite)   → clear quartz columns, jointed prisms;
 *  - segmented line (quilted) → satin selenite blades, segment on segment;
 *  - trilobite line           → apricot calcite towers of stacked rhombs.
 * Abstract, sparse and tall; mid / far distance only, never in the clearing.
 *
 * Pure (no three.js): placement, the parts each spire is built from, and the
 * colliders the explore camera keeps out of. Vectors are [x, y, z] arrays.
 */
import { habitatHeight, habitatRng, UNDERWORLD } from './habitatField.js'

/** Mineral each lineage grows (same mapping as the bodies' crystals). */
export const SPIRE_MINERAL = Object.freeze({ spiral: 'quartz', segmented: 'selenite', trilobite: 'calcite' })

/*
 * Each tree has a FORM (how its trunk branches) and a FROST (what grows on
 * it), picked from a few restrained kinds so the grove varies without
 * turning odd:
 *  forms — plume (airy crown up top), column (narrow, short branches all the
 *          way up), fork (the trunk splits into two or three leaders), broad
 *          (long, spreading branches: a wide crown);
 *  frost — needle (fine radial needles), feather (flat blades swept up along
 *          the branch), rime (short, stubby, dense granular ice).
 */
export const SPIRE_FORMS = Object.freeze(['plume', 'column', 'fork', 'broad'])
export const SPIRE_FROSTS = Object.freeze(['needle', 'feather', 'rime'])

const pickW = (r, list, weights) => {
  let acc = 0
  const sum = weights.reduce((x, y) => x + y, 0)
  for (let i = 0; i < list.length; i++) {
    acc += weights[i] / sum
    if (r < acc) return list[i]
  }
  return list[list.length - 1]
}

function makeSpire([x, z, height, species, form, frost], i, far = false) {
  const seed = (far ? 9300 : 7100) + i * 37
  const r = habitatRng(seed + 5)
  return Object.freeze({
    id: `${far ? 'far' : 'spire'}${i}`,
    x,
    z,
    height,
    species,
    seed,
    far,
    form: form ?? pickW(r(), SPIRE_FORMS, [3, 2.2, 2, 2]),
    frost: frost ?? pickW(r(), SPIRE_FROSTS, [3, 2, 1.6]),
  })
}

/**
 * The near and mid spires: [x, z, height, species, form?, frost?]. Scattered
 * loosely, singly and in twos, with heights from saplings to tall elders;
 * kept out of the clearing, the landing and the underworld hole.
 */
export const SPIRES = Object.freeze(
  [
    [-24, 4, 8, 'segmented', 'broad', 'feather'],
    [27, -2, 10, 'trilobite', 'plume', 'needle'],
    [31, 3, 6, 'trilobite', 'column', 'rime'],
    [-20, -29, 13, 'spiral', 'fork', 'needle'],
    [-26, -24, 7, 'spiral', 'plume', 'rime'],
    [13, -38, 16, 'segmented', 'column', 'feather'],
    [37, -22, 11, 'spiral', 'broad', 'needle'],
    [-44, -11, 14, 'trilobite', 'plume', 'feather'],
    [-4, -55, 19, 'trilobite', 'fork', 'needle'],
    [6, -50, 8, 'spiral', 'broad', 'rime'],
    [49, -47, 13, 'segmented', 'plume', 'needle'],
    [2, -79, 20, 'spiral', 'column', 'needle'],
    [-33, -64, 11, 'segmented', 'broad', 'rime'],
    [-58, -36, 16, 'spiral', 'fork', 'feather'],
    [62, -13, 12, 'trilobite', 'column', 'needle'],
    [24, 22, 9, 'segmented', 'plume', 'feather'],
    [-29, -44, 6, 'trilobite', 'column', 'needle'],
    [33, -62, 15, 'trilobite', 'broad', 'needle'],
  ].map((row, i) => makeSpire(row, i)),
)

/**
 * The far grove: tall trees out in the fog (70–150 away), silhouettes for
 * depth. Mostly ahead of the landing view, a few around the sides and back.
 * Deterministic; kept off the underworld basin.
 */
export const FAR_SPIRES = Object.freeze(
  (() => {
    const rnd = habitatRng(9177)
    const species = ['spiral', 'segmented', 'trilobite']
    const out = []
    let tries = 0
    while (out.length < 24 && tries++ < 400) {
      /* Ahead (toward -z) is the main view: two thirds of the trees go there. */
      const ahead = rnd() < 0.68
      const a = ahead ? -Math.PI / 2 + (rnd() - 0.5) * 2.3 : rnd() * Math.PI * 2
      const d = 72 + rnd() * 78
      const x = Math.cos(a) * d
      const z = -5 + Math.sin(a) * d
      if (Math.hypot(x - UNDERWORLD.centre.x, z - UNDERWORLD.centre.z) < UNDERWORLD.radius + 18) continue
      if (out.some((o) => Math.hypot(o[0] - x, o[1] - z) < 14)) continue
      out.push([Math.round(x), Math.round(z), Math.round(15 + rnd() * 19), species[Math.floor(rnd() * 3)]])
    }
    return out.map((row, i) => makeSpire(row, i, true))
  })(),
)

/** Every tree, near and far. */
export const ALL_SPIRES = Object.freeze([...SPIRES, ...FAR_SPIRES])

/** Keep-clear zone: the clearing where the lives are born. */
export const SPIRE_CLEARING = Object.freeze({ centre: Object.freeze([0, -5]), radius: 14 })

/** Base width of a spire's main column for its height. */
export function spireWidth(height) {
  return 0.45 + height * 0.05
}

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

/**
 * One jointed column: `n` segments along a gently leaning axis. Each segment
 * is a part { p, dir, spin, s } (p = base point, dir = long axis, s = scale in
 * the habit geometry's units, spin around dir). Segments overlap a little and
 * are spun independently so every joint reads as a crisp crystal break.
 */
function column(out, rnd, base, height, width, lean, n, opts = {}) {
  const { taper = 0.55, unit = 1, flat = 0, spin0 = rnd() * Math.PI * 2, spinJitter = Math.PI * 2, overlap = 0.94, segs = null, bendDir = null } = opts
  let p = [...base]
  let spin = spin0
  for (let i = 0; i < n; i++) {
    const t = i / n
    const len = (height / n) * (0.88 + rnd() * 0.24)
    const w = width * (1 - taper * t) * (0.92 + rnd() * 0.16)
    const bend = t * t
    const dir = bendDir ? norm([bendDir[0] + lean[0] * bend, bendDir[1] + 0.35 * bend, bendDir[2] + lean[1] * bend]) : norm([lean[0] * (0.3 + bend), 1, lean[1] * (0.3 + bend)])
    const top = i === n - 1 ? 1.12 : 1
    out.push({ p: [...p], dir, spin, s: [w * (flat ? flat : 1), (len * top) / unit, w] })
    segs?.push({ p: [...p], dir, len, w })
    p = [p[0] + dir[0] * len * overlap, p[1] + dir[1] * len * overlap, p[2] + dir[2] * len * overlap]
    spin += (rnd() - 0.5) * spinJitter
  }
  return p
}



/**
 * Every part of one spire — a crystal TREE grown out of old remains, after the
 * frost trees on the reference: a slender jointed trunk of its lineage's
 * mineral that forks into branches toward the top (and twigs off those), so
 * the crown is a loose, airy cloud; frost needles (frostParts) cover it.
 *  - quartz: prism segments; selenite: satin plate segments; calcite: rhombs.
 * Returns parts (trunk + branches, in the mineral's habit units) and segs
 * (each segment's base, axis, length, width) for the frost.
 */
export function spireParts(spire, groundAt = habitatHeight) {
  const rnd = habitatRng(spire.seed)
  const mineral = SPIRE_MINERAL[spire.species] ?? 'quartz'
  const form = spire.form ?? 'plume'
  const out = []
  const segs = []
  const g = groundAt(spire.x, spire.z) - 0.6
  const h = spire.height
  const w = spireWidth(h) * (form === 'column' ? 0.38 : form === 'broad' ? 0.48 : 0.42)
  const la = rnd() * Math.PI * 2
  const leanAmt = form === 'column' ? 0.05 : 0.06 + rnd() * 0.1
  const lean = [Math.cos(la) * leanAmt, Math.sin(la) * leanAmt]
  const habit =
    mineral === 'selenite'
      ? { unit: 1.5, flat: 1.6, spinJitter: 0.25, taper: 0.5, overlap: 0.9 }
      : mineral === 'calcite'
        ? { unit: 0.9, flat: 0, spinJitter: Math.PI / 3, taper: 0.55, overlap: 0.82 }
        : { unit: 1, flat: 0, spinJitter: Math.PI * 2, taper: 0.6, overlap: 0.94 }
  const along = (sg, f) => [sg.p[0] + sg.dir[0] * sg.len * f, sg.p[1] + sg.dir[1] * sg.len * f, sg.p[2] + sg.dir[2] * sg.len * f]
  const pointOn = (list, at) => {
    const sg = list[Math.min(list.length - 1, Math.floor(at * list.length))]
    return along(sg, rnd())
  }
  const crown = (list) => segs.push(...list.map((x) => ({ ...x, crown: true })))

  /* One branch (+ twigs) from `base`, heading `a` around the trunk. */
  const branch = (base, a, len, width, out2, up, twigs) => {
    const bendDir = norm([Math.cos(a) * out2, up, Math.sin(a) * out2])
    const bs = []
    column(out, rnd, base, len, width, lean, len > h * 0.18 ? 3 : 2, { ...habit, segs: bs, bendDir, taper: 0.5 })
    crown(bs)
    for (let k = 0; k < twigs; k++) {
      const tb = along(bs[Math.min(bs.length - 1, 1 + Math.floor(rnd() * bs.length))] ?? bs[bs.length - 1], 0.3 + rnd() * 0.6)
      const ta = a + (rnd() - 0.5) * 2.2
      const ts = []
      column(out, rnd, tb, len * (0.32 + rnd() * 0.3), width * 0.5, lean, 1, { ...habit, segs: ts, bendDir: norm([Math.cos(ta) * out2 * 0.8, up + 0.2, Math.sin(ta) * out2 * 0.8]) })
      crown(ts)
    }
  }

  if (form === 'fork') {
    /* A short trunk, then two or three leaders leaning apart, each crowned. */
    const forkAt = 0.38 + rnd() * 0.14
    const trunk = []
    column(out, rnd, [spire.x, g, spire.z], h * forkAt, w, lean, 4, { ...habit, segs: trunk })
    segs.push(...trunk.map((x) => ({ ...x, crown: false })))
    const top = along(trunk[trunk.length - 1], 0.9)
    const leaders = 2 + (rnd() < 0.45 ? 1 : 0)
    for (let l = 0; l < leaders; l++) {
      const a = la + (l / leaders) * Math.PI * 2 + (rnd() - 0.5) * 0.6
      const spread = 0.22 + rnd() * 0.16
      const ls = []
      column(out, rnd, top, h * (1 - forkAt) * (0.78 + rnd() * 0.24), w * 0.66, lean, 4, {
        ...habit,
        segs: ls,
        bendDir: norm([Math.cos(a) * spread, 1, Math.sin(a) * spread]),
      })
      segs.push(...ls.map((x, i) => ({ ...x, crown: i >= 1 })))
      const nb = 2 + Math.floor(rnd() * 2)
      for (let b = 0; b < nb; b++) {
        const at = 0.45 + (b / nb) * 0.45
        branch(pointOn(ls, at), a + (rnd() - 0.5) * 2.4, h * (0.1 + rnd() * 0.08), w * 0.3, 0.6, 0.9, rnd() < 0.5 ? 1 : 0)
      }
    }
    return { mineral, form, parts: out, segs }
  }

  const trunkSegs = []
  column(out, rnd, [spire.x, g, spire.z], h, w, lean, (form === 'column' ? 8 : 7) + Math.floor(rnd() * 3), { ...habit, segs: trunkSegs })
  segs.push(...trunkSegs.map((sg) => ({ ...sg, crown: false })))
  const spec =
    form === 'column'
      ? { n: 8 + Math.floor(rnd() * 4), from: 0.3, to: 0.95, len: [0.06, 0.06], out: 0.38, up: 1, twigs: 0.4 }
      : form === 'broad'
        ? { n: 6 + Math.floor(rnd() * 3), from: 0.4, to: 0.85, len: [0.22, 0.1], out: 1, up: 0.5, twigs: 2.2 }
        : { n: 5 + Math.floor(rnd() * 4), from: 0.45, to: 0.92, len: [0.14, 0.16], out: 0.8, up: 0.9, twigs: 1.5 }
  for (let b = 0; b < spec.n; b++) {
    const at = spec.from + (b / spec.n) * (spec.to - spec.from) + rnd() * 0.05
    const a = la + b * 2.4 + (rnd() - 0.5) * 0.7
    /* Column trees: branches shorten toward the top (a slim cone). */
    const shape = form === 'column' ? 1.3 - 0.8 * at : 1.15 - 0.6 * at
    const len = h * (spec.len[0] + rnd() * spec.len[1]) * shape
    const twigs = Math.floor(spec.twigs * (0.5 + rnd()))
    branch(pointOn(trunkSegs, at), a, len, w * 0.42, spec.out * (0.7 + rnd() * 0.6), spec.up + rnd() * 0.35, twigs)
  }
  return { mineral, form, parts: out, segs }
}

/** Frost needle geometry: a slim four-sided bipyramid, base 0 → tip 1. */
export const NEEDLE_SHOULDER = 0.22

/**
 * Hoarfrost on a spire, after the reference: countless fine needles bristling
 * out of the trunk and, densest, the crown; and frost tufts on the sand
 * around its foot (fans of blades). Parts are { p, dir, spin, s, tone } in
 * needle units (1 long); tone 0..1 varies their glitter / tint.
 */
export function frostParts(spire, segs, groundAt = habitatHeight) {
  const rnd = habitatRng(spire.seed + 991)
  const out = []
  const h = spire.height
  /* Needle shape per frost kind; far trees: fewer, larger (they read in fog). */
  const style =
    spire.frost === 'feather'
      ? { dens: 0.8, len: 1.2, wid: 2.4, thin: 0.45, up: 1.1, radial: 0.55 }
      : spire.frost === 'rime'
        ? { dens: 1.35, len: 0.42, wid: 3.2, thin: 1, up: 0.35, radial: 1 }
        : { dens: 1, len: 1, wid: 1, thin: 1, up: 0.6, radial: 0.9 }
  const farK = spire.far ? 0.3 : 1
  const scale = (h / 12) * (spire.far ? 1.5 : 1) * Math.min(1.25, Math.max(0.75, 12 / Math.max(6, h)) ** 0.5)
  const g = groundAt(spire.x, spire.z)
  for (const sg of segs) {
    const yt = Math.min(1, Math.max(0, (sg.p[1] - g) / h))
    const density = (sg.crown ? 26 : 6 + 22 * yt * yt) * style.dens * farK
    const n = Math.max(1, Math.round(sg.len * density))
    const ref = Math.abs(sg.dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    const t1 = norm([sg.dir[1] * ref[2] - sg.dir[2] * ref[1], sg.dir[2] * ref[0] - sg.dir[0] * ref[2], sg.dir[0] * ref[1] - sg.dir[1] * ref[0]])
    const t2 = [sg.dir[1] * t1[2] - sg.dir[2] * t1[1], sg.dir[2] * t1[0] - sg.dir[0] * t1[2], sg.dir[0] * t1[1] - sg.dir[1] * t1[0]]
    for (let i = 0; i < n; i++) {
      const u = rnd()
      const a = rnd() * Math.PI * 2
      const rad = [t1[0] * Math.cos(a) + t2[0] * Math.sin(a), t1[1] * Math.cos(a) + t2[1] * Math.sin(a), t1[2] * Math.cos(a) + t2[2] * Math.sin(a)]
      const p = [
        sg.p[0] + sg.dir[0] * sg.len * u + rad[0] * sg.w * 0.4,
        sg.p[1] + sg.dir[1] * sg.len * u + rad[1] * sg.w * 0.4,
        sg.p[2] + sg.dir[2] * sg.len * u + rad[2] * sg.w * 0.4,
      ]
      const up = style.up * (0.6 + rnd() * 0.8)
      const rr = style.radial
      const dir = norm([rad[0] * rr + sg.dir[0] * up, rad[1] * rr + sg.dir[1] * up + 0.15, rad[2] * rr + sg.dir[2] * up])
      const len = scale * style.len * (sg.crown ? 0.25 + rnd() * 0.55 : 0.12 + rnd() * 0.35) * (0.6 + 0.6 * yt)
      const wd = len * (0.05 + rnd() * 0.04)
      /* Feather blades lie flat across the branch: spin them to face along it. */
      const spin = spire.frost === 'feather' ? a + Math.PI / 2 : rnd() * Math.PI
      out.push({ p, dir, spin, s: [wd * style.wid, len, wd * style.thin * (spire.frost === 'rime' ? style.wid : 1)], tone: rnd() })
    }
    /* A burst at the end of each crown segment. */
    if (sg.crown) {
      const tip = [sg.p[0] + sg.dir[0] * sg.len, sg.p[1] + sg.dir[1] * sg.len, sg.p[2] + sg.dir[2] * sg.len]
      const burst = Math.round((spire.frost === 'rime' ? 5 : 9) * (spire.far ? 0.5 : 1))
      for (let k = 0; k < burst; k++) {
        const a = rnd() * Math.PI * 2
        const dir = norm([sg.dir[0] + Math.cos(a) * 0.9, sg.dir[1] + 0.2, sg.dir[2] + Math.sin(a) * 0.9])
        const len = scale * style.len * (0.3 + rnd() * 0.5)
        const bw = len * 0.06 * (spire.frost === 'rime' ? 2.6 : 1)
        out.push({ p: tip, dir, spin: rnd() * Math.PI, s: [bw * (spire.frost === 'feather' ? 2 : 1), len, bw], tone: rnd() })
      }
    }
  }
  /* Frost tufts on the sand: fans of blades around the foot. */
  const tufts = spire.far ? 2 + Math.floor(rnd() * 3) : 5 + Math.floor(rnd() * 7)
  const w = spireWidth(h)
  for (let t = 0; t < tufts; t++) {
    const a = rnd() * Math.PI * 2
    const r = w * (0.8 + rnd() * 3.2)
    const cx = spire.x + Math.cos(a) * r
    const cz = spire.z + Math.sin(a) * r
    const size = scale * (0.4 + rnd() * 0.9)
    const blades = 8 + Math.floor(rnd() * 10)
    const gy = groundAt(cx, cz) - 0.05
    for (let k = 0; k < blades; k++) {
      const ba = rnd() * Math.PI * 2
      const spread = 0.15 + rnd() * 0.7
      const dir = norm([Math.cos(ba) * spread, 1, Math.sin(ba) * spread])
      const len = size * (0.35 + rnd() * 0.9)
      out.push({ p: [cx + Math.cos(ba) * 0.05, gy, cz + Math.sin(ba) * 0.05], dir, spin: rnd() * Math.PI, s: [len * 0.08, len, len * 0.08], tone: rnd() })
    }
  }
  return out
}

/** Where the explore camera may not go: { x, z, r, top } per spire. */
export function spireColliders(groundAt = habitatHeight) {
  return ALL_SPIRES.map((s) => ({ x: s.x, z: s.z, r: spireWidth(s.height) * 1.9 + 0.8, top: groundAt(s.x, s.z) + s.height + 1 }))
}

/** Push a camera position [x, y, z] out of any spire (horizontally); returns [dx, dz]. */
export function pushOutOfSpires(pos, colliders) {
  let dx = 0
  let dz = 0
  for (const c of colliders) {
    if (pos[1] > c.top) continue
    const ex = pos[0] + dx - c.x
    const ez = pos[2] + dz - c.z
    const d = Math.hypot(ex, ez)
    if (d >= c.r) continue
    const k = d > 1e-4 ? (c.r - d) / d : 0
    if (d > 1e-4) {
      dx += ex * k
      dz += ez * k
    } else {
      dx += c.r
    }
  }
  return [dx, dz]
}
