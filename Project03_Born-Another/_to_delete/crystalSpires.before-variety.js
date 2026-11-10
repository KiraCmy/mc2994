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
import { habitatHeight, habitatRng } from './habitatField.js'

/** Mineral each lineage grows (same mapping as the bodies' crystals). */
export const SPIRE_MINERAL = Object.freeze({ spiral: 'quartz', segmented: 'selenite', trilobite: 'calcite' })

/**
 * The spires: [x, z, height, species]. Two at mid distance on the flanks (out
 * of the first view, found while exploring), the rest far beyond the lives.
 */
export const SPIRES = Object.freeze(
  [
    [-23, 3, 9, 'segmented'],
    [25, -3, 9, 'trilobite'],
    [-19, -27, 12, 'spiral'],
    [14, -36, 14, 'segmented'],
    [34, -21, 11, 'spiral'],
    [-41, -13, 13, 'trilobite'],
    [-7, -53, 16, 'trilobite'],
    [46, -45, 14, 'segmented'],
    [3, -76, 18, 'spiral'],
    [-31, -61, 12, 'segmented'],
    [-56, -38, 15, 'spiral'],
    [60, -12, 12, 'trilobite'],
  ].map(([x, z, height, species], i) => Object.freeze({ id: `spire${i}`, x, z, height, species, seed: 7100 + i * 37 })),
)

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
  const out = []
  const segs = []
  const g = groundAt(spire.x, spire.z) - 0.6
  const h = spire.height
  const w = spireWidth(h) * 0.42
  const la = rnd() * Math.PI * 2
  const lean = [Math.cos(la) * 0.1, Math.sin(la) * 0.1]
  const habit =
    mineral === 'selenite'
      ? { unit: 1.5, flat: 1.6, spinJitter: 0.25, taper: 0.5, overlap: 0.9 }
      : mineral === 'calcite'
        ? { unit: 0.9, flat: 0, spinJitter: Math.PI / 3, taper: 0.55, overlap: 0.82 }
        : { unit: 1, flat: 0, spinJitter: Math.PI * 2, taper: 0.6, overlap: 0.94 }
  const trunkSegs = []
  column(out, rnd, [spire.x, g, spire.z], h, w, lean, 7 + Math.floor(rnd() * 3), { ...habit, segs: trunkSegs })
  segs.push(...trunkSegs.map((sg) => ({ ...sg, crown: false })))
  /* Branches from the upper trunk, reaching out and up; twigs off each. */
  const branches = 5 + Math.floor(rnd() * 4)
  for (let b = 0; b < branches; b++) {
    const at = 0.42 + (b / branches) * 0.5 + rnd() * 0.06
    const sg = trunkSegs[Math.min(trunkSegs.length - 1, Math.floor(at * trunkSegs.length))]
    const f = rnd()
    const base = [sg.p[0] + sg.dir[0] * sg.len * f, sg.p[1] + sg.dir[1] * sg.len * f, sg.p[2] + sg.dir[2] * sg.len * f]
    const a = la + b * 2.4 + (rnd() - 0.5) * 0.7
    const out2 = 0.55 + rnd() * 0.6
    const bendDir = norm([Math.cos(a) * out2, 0.75 + rnd() * 0.4, Math.sin(a) * out2])
    const bl = h * (0.14 + rnd() * 0.16) * (1.15 - 0.6 * at)
    const bs = []
    column(out, rnd, base, bl, w * 0.42, lean, 2 + Math.floor(rnd() * 2), { ...habit, segs: bs, bendDir, taper: 0.5 })
    segs.push(...bs.map((x) => ({ ...x, crown: true })))
    const twigs = 1 + Math.floor(rnd() * 2)
    for (let k = 0; k < twigs; k++) {
      const tsg = bs[bs.length - 1]
      const tf = 0.3 + rnd() * 0.6
      const tb = [tsg.p[0] + tsg.dir[0] * tsg.len * tf, tsg.p[1] + tsg.dir[1] * tsg.len * tf, tsg.p[2] + tsg.dir[2] * tsg.len * tf]
      const ta = a + (rnd() - 0.5) * 2.2
      const td = norm([Math.cos(ta) * 0.6, 0.9, Math.sin(ta) * 0.6])
      const ts = []
      column(out, rnd, tb, bl * (0.35 + rnd() * 0.3), w * 0.22, lean, 1, { ...habit, segs: ts, bendDir: td })
      segs.push(...ts.map((x) => ({ ...x, crown: true })))
    }
  }
  return { mineral, parts: out, segs }
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
  const scale = h / 12
  const g = groundAt(spire.x, spire.z)
  for (const sg of segs) {
    const yt = Math.min(1, Math.max(0, (sg.p[1] - g) / h))
    const density = sg.crown ? 26 : 6 + 22 * yt * yt
    const n = Math.max(2, Math.round(sg.len * density))
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
      const up = 0.35 + rnd() * 0.5
      const dir = norm([rad[0] * 0.9 + sg.dir[0] * up, rad[1] * 0.9 + sg.dir[1] * up + 0.15, rad[2] * 0.9 + sg.dir[2] * up])
      const len = scale * (sg.crown ? 0.25 + rnd() * 0.55 : 0.12 + rnd() * 0.35) * (0.6 + 0.6 * yt)
      const wd = len * (0.05 + rnd() * 0.04)
      out.push({ p, dir, spin: rnd() * Math.PI, s: [wd, len, wd], tone: rnd() })
    }
    /* A burst at the end of each crown segment. */
    if (sg.crown) {
      const tip = [sg.p[0] + sg.dir[0] * sg.len, sg.p[1] + sg.dir[1] * sg.len, sg.p[2] + sg.dir[2] * sg.len]
      for (let k = 0; k < 9; k++) {
        const a = rnd() * Math.PI * 2
        const dir = norm([sg.dir[0] + Math.cos(a) * 0.9, sg.dir[1] + 0.2, sg.dir[2] + Math.sin(a) * 0.9])
        const len = scale * (0.3 + rnd() * 0.5)
        out.push({ p: tip, dir, spin: rnd() * Math.PI, s: [len * 0.06, len, len * 0.06], tone: rnd() })
      }
    }
  }
  /* Frost tufts on the sand: fans of blades around the foot. */
  const tufts = 7 + Math.floor(rnd() * 6)
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
  return SPIRES.map((s) => ({ x: s.x, z: s.z, r: spireWidth(s.height) * 1.9 + 0.8, top: groundAt(s.x, s.z) + s.height + 1 }))
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
