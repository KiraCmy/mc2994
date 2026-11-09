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
  const { taper = 0.55, unit = 1, flat = 0, spin0 = rnd() * Math.PI * 2, spinJitter = Math.PI * 2, overlap = 0.94 } = opts
  let p = [...base]
  let spin = spin0
  for (let i = 0; i < n; i++) {
    const t = i / n
    const len = (height / n) * (0.88 + rnd() * 0.24)
    const w = width * (1 - taper * t) * (0.92 + rnd() * 0.16)
    const bend = t * t
    const dir = norm([lean[0] * (0.3 + bend), 1, lean[1] * (0.3 + bend)])
    const top = i === n - 1 ? 1.12 : 1
    out.push({ p: [...p], dir, spin, s: [w * (flat ? flat : 1), (len * top) / unit, w] })
    p = [p[0] + dir[0] * len * overlap, p[1] + dir[1] * len * overlap, p[2] + dir[2] * len * overlap]
    spin += (rnd() - 0.5) * spinJitter
  }
  return p
}

/** Calcite tower: rhombs stacked with a turn each, shrinking upward. */
function tower(out, rnd, base, height, width, lean) {
  const RHOMB_H = 0.9
  let p = [...base]
  let spin = rnd() * Math.PI * 2
  let made = 0
  while (made < 40) {
    const t = (p[1] - base[1]) / height
    if (t >= 1) break
    const s = width * 1.25 * (1 - 0.6 * t) * (0.94 + rnd() * 0.12)
    const dir = norm([lean[0] * (0.25 + t), 1, lean[1] * (0.25 + t)])
    out.push({ p: [...p], dir, spin, s: [s, s * (1.0 + rnd() * 0.15), s] })
    const step = s * RHOMB_H * 0.72
    p = [p[0] + dir[0] * step, p[1] + dir[1] * step, p[2] + dir[2] * step]
    spin += Math.PI / 3 + (rnd() - 0.5) * 0.15
    made++
  }
}

/** Small pieces of the same mineral at the foot, half in the sand. */
function foot(out, rnd, spire, groundAt, width, flat) {
  const count = 7 + Math.floor(rnd() * 5)
  for (let k = 0; k < count; k++) {
    const a = rnd() * Math.PI * 2
    const r = width * (0.9 + rnd() * 1.6)
    const x = spire.x + Math.cos(a) * r
    const z = spire.z + Math.sin(a) * r
    const out2 = 0.35 + rnd() * 0.6
    const len = width * (0.6 + rnd() * 1.3)
    const w = len * (0.28 + rnd() * 0.14)
    out.push({
      p: [x, groundAt(x, z) - 0.25, z],
      dir: norm([Math.cos(a) * out2, 1, Math.sin(a) * out2]),
      spin: rnd() * Math.PI * 2,
      s: [w * (flat || 1), len, w],
    })
  }
}

/**
 * Every part of one spire, in its mineral's habit geometry units:
 *  - quartz: prism (body 1 tall + tip), a main column and 2–3 satellites;
 *  - selenite: plate (1.5 tall incl. head), a fan of segmented blades;
 *  - calcite: rhomb (0.9 tall), a main tower and 1–2 smaller ones.
 */
export function spireParts(spire, groundAt = habitatHeight) {
  const rnd = habitatRng(spire.seed)
  const mineral = SPIRE_MINERAL[spire.species] ?? 'quartz'
  const out = []
  const g = groundAt(spire.x, spire.z) - 0.6
  const h = spire.height
  const w = spireWidth(h)
  const la = rnd() * Math.PI * 2
  const lean = [Math.cos(la) * 0.12, Math.sin(la) * 0.12]
  const satellite = (k, total, minH, maxH) => {
    const a = la + Math.PI * 0.6 + (k / total) * Math.PI * 1.4 + (rnd() - 0.5) * 0.6
    const off = w * (0.7 + rnd() * 0.5)
    const sl = 0.12 + rnd() * 0.16
    return {
      base: [spire.x + Math.cos(a) * off, g, spire.z + Math.sin(a) * off],
      lean: [Math.cos(a) * sl, Math.sin(a) * sl],
      height: h * (minH + rnd() * (maxH - minH)),
    }
  }
  if (mineral === 'selenite') {
    const blades = 3 + Math.floor(rnd() * 2)
    const spin0 = rnd() * Math.PI * 2
    column(out, rnd, [spire.x, g, spire.z], h, w * 1.05, lean, 5 + Math.floor(rnd() * 2), { unit: 1.5, flat: 1.7, spin0, spinJitter: 0.12, taper: 0.35, overlap: 0.9 })
    for (let k = 0; k < blades - 1; k++) {
      const s = satellite(k, blades - 1, 0.45, 0.8)
      column(out, rnd, s.base, s.height, w * 0.85, s.lean, 3 + Math.floor(rnd() * 2), { unit: 1.5, flat: 1.7, spin0: spin0 + 0.5 + k * 0.9, spinJitter: 0.12, taper: 0.35, overlap: 0.9 })
    }
    foot(out, rnd, spire, groundAt, w, 2)
  } else if (mineral === 'calcite') {
    tower(out, rnd, [spire.x, g, spire.z], h, w, lean)
    const extra = 1 + Math.floor(rnd() * 2)
    for (let k = 0; k < extra; k++) {
      const s = satellite(k, extra, 0.3, 0.55)
      tower(out, rnd, s.base, s.height, w * 0.7, s.lean)
    }
    foot(out, rnd, spire, groundAt, w * 0.8, 0)
  } else {
    column(out, rnd, [spire.x, g, spire.z], h, w, lean, 5 + Math.floor(rnd() * 2))
    const extra = 2 + Math.floor(rnd() * 2)
    for (let k = 0; k < extra; k++) {
      const s = satellite(k, extra, 0.3, 0.6)
      column(out, rnd, s.base, s.height, w * 0.62, s.lean, 2 + Math.floor(rnd() * 2))
    }
    foot(out, rnd, spire, groundAt, w * 0.7, 0)
  }
  return { mineral, parts: out }
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
