/**
 * World Final — what a life remembers, and the layered body it grows from it.
 *
 * A life's species gives it family traits (its morphology, the spiral's coil),
 * but its final shape is its own: it keeps what happened to it. This module
 * (pure, no three.js) records a life's history and turns it into a character:
 *
 *   history    words / environment shifts (each leaves a mark where the
 *              viewer stood when it happened), where it was watched from and
 *              for how long, and the medium it lived in on average.
 *   character  how far the species form emerges (never all the way), how far
 *              a spiral coils, the marks pressed into or raised from the body,
 *              a flare on the side it was watched from, and its own axis
 *              (the mouth its fibres converge on).
 *
 * Two lives of one species keep family resemblance but end differently.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const q = (v, step) => Math.round(v / step) * step

function rng(seed) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function unit3(x, y, z) {
  const l = Math.hypot(x, y, z) || 1
  return [x / l, y / l, z / l]
}

function randomDir(r) {
  const z = r() * 2 - 1
  const a = r() * Math.PI * 2
  const s = Math.sqrt(1 - z * z)
  return [Math.cos(a) * s, z, Math.sin(a) * s]
}

export const MAX_MARKS = 10

export function createHistory(seed = 1) {
  return {
    seed,
    t: 0,
    marks: [],
    lp: null,
    lastMarkAt: -99,
    avg: { temperature: 0.5, moisture: 0.5, turbulence: 0 },
    watch: [0, 0, 0],
    watchTime: 0,
  }
}

/**
 * One step of a life's history.
 * env: { temperature, moisture, turbulence } (0..1)
 * viewer: unit direction from the body to the viewer (body frame) or null
 * near: viewer within notice range; focus: this life is being observed
 */
export function updateHistory(h, { dt, env, viewer = null, near = false, focus = false }) {
  if (!(dt > 0) || !env) return h
  const step = Math.min(dt, 0.25)
  h.t += step
  const e = { temperature: env.temperature ?? 0.5, moisture: env.moisture ?? 0.5, turbulence: env.turbulence ?? 0 }
  if (!h.lp) h.lp = { ...e }
  /* Long average: the medium it lived in. */
  const k = step / Math.max(20, h.t)
  for (const key of Object.keys(h.avg)) h.avg[key] += (e[key] - h.avg[key]) * k
  /* A shift of the medium (words, a storm) leaves a mark. */
  const dT = e.temperature - h.lp.temperature
  const dM = e.moisture - h.lp.moisture
  const dU = e.turbulence - h.lp.turbulence
  const shift = Math.abs(dT) + Math.abs(dM) * 0.7 + Math.abs(dU)
  if (shift > 0.07 && h.t - h.lastMarkAt > 3) {
    const r = rng((h.seed ^ Math.imul(h.marks.length + 1, 2654435761)) >>> 0)
    const dir = viewer && near ? unit3(viewer[0] + (r() - 0.5) * 0.5, viewer[1] + (r() - 0.5) * 0.5, viewer[2] + (r() - 0.5) * 0.5) : randomDir(r)
    /* Warmth swells the skin, cold presses it in; turbulence ripples it. */
    const sign = Math.abs(dT) >= Math.abs(dU) ? Math.sign(dT || 1) : r() < 0.5 ? 1 : -1
    h.marks.push({
      dir,
      amp: sign * clamp(0.05 + shift * 0.5, 0.05, 0.2),
      width: 0.22 + r() * 0.25 + Math.abs(dM) * 0.4,
      ripple: clamp(Math.abs(dU) * 3, 0, 1),
      at: h.t,
    })
    if (h.marks.length > MAX_MARKS) {
      /* Keep the strongest memories. */
      h.marks.sort((a, b) => Math.abs(b.amp) - Math.abs(a.amp))
      h.marks.length = MAX_MARKS
    }
    h.lastMarkAt = h.t
    h.lp = { ...e }
  } else {
    const f = Math.min(1, step / 6)
    h.lp.temperature += dT * f
    h.lp.moisture += dM * f
    h.lp.turbulence += dU * f
  }
  if (viewer && near) {
    const w = step * (focus ? 2 : 1)
    h.watch[0] += viewer[0] * w
    h.watch[1] += viewer[1] * w
    h.watch[2] += viewer[2] * w
    h.watchTime += w
  }
  return h
}

/** What the history makes of this life (deterministic, quantized). */
export function characterOf(h, seed = h?.seed ?? 1) {
  const r = rng((seed * 2246822519) >>> 0)
  const avg = h?.avg ?? { temperature: 0.5, moisture: 0.5, turbulence: 0 }
  const marks = h?.marks ?? []
  const watchLen = h ? Math.hypot(...h.watch) : 0
  const watched = watchLen > 1e-6 ? h.watch.map((v) => v / watchLen) : null
  const attention = smooth(5, 60, h?.watchTime ?? 0)
  const restless = clamp(avg.turbulence, 0, 1)
  const cold = clamp(0.5 - avg.temperature, 0, 0.5) * 2
  /* The species form never fully takes over: how far depends on the life. */
  const lobeCap = q(clamp(0.5 + r() * 0.25 + 0.2 * (1 - restless) - 0.04 * marks.length, 0.4, 0.88), 0.05)
  /* A spiral coils only partly, more in cold, calm water. */
  const coilMax = q(clamp(0.3 + 0.35 * cold + 0.15 * (1 - restless) + r() * 0.15, 0.25, 0.8), 0.05)
  const axis = watched && attention > 0.15 ? watched : randomDir(r)
  const opening = watched && attention > 0.05 ? { dir: unit3(...watched.map((v) => q(v, 0.34))), amount: q(attention, 0.25) } : null
  const key = [
    lobeCap, coilMax, marks.length,
    opening ? opening.amount + ':' + opening.dir.map((v) => v.toFixed(2)).join(',') : '-',
  ].join('|')
  return { lobeCap, coilMax, marks, opening, axis, restless, key }
}

/**
 * Radial factors for the body (one per direction): marks swell or press the
 * skin, ripples where turbulence struck, and a flared lip on the side it was
 * watched from (its rim lifts, its centre sinks).
 */
export function bodyFactors(character, dirs, out = new Float32Array(dirs.length / 3)) {
  const { marks, opening } = character
  for (let i = 0; i < out.length; i++) {
    const x = dirs[i * 3], y = dirs[i * 3 + 1], z = dirs[i * 3 + 2]
    let f = 0
    for (const m of marks) {
      const d = x * m.dir[0] + y * m.dir[1] + z * m.dir[2]
      const g = Math.exp((d - 1) / (m.width * m.width))
      f += m.amp * g * (1 + m.ripple * 0.5 * Math.sin(d * 12))
    }
    if (opening) {
      const d = x * opening.dir[0] + y * opening.dir[1] + z * opening.dir[2]
      f += opening.amount * (0.16 * Math.exp(-(((d - 0.78) / 0.09) ** 2)) - 0.14 * Math.exp(-(((d - 1) / 0.13) ** 2)))
    }
    out[i] = f
  }
  return out
}

/* ------------------------------------------------------------------------
 * The medium shapes the body (each is the form itself changing):
 *   warm   → ridges rise along the fibres
 *   cold   → the body contracts, tightening and wrinkling
 *   wet    → blisters swell out of the skin
 *   rough  → (turbulence) the body stratifies into stacked bands
 * What it lived through stays partly in it (a slowly fading memory), and
 * once it crystallizes the shape freezes. The dominant shape at that moment
 * decides how it crystallizes (see CRYSTAL_MODES).
 * ---------------------------------------------------------------------- */

export const MORPH_KEYS = ['ridge', 'shrink', 'bubble', 'strata']

export function morphTargets({ temperature = 0.5, moisture = 0.5, turbulence = 0 } = {}) {
  return {
    ridge: smooth(0.52, 0.9, temperature),
    shrink: smooth(0.48, 0.12, temperature),
    bubble: smooth(0.55, 0.95, moisture),
    strata: smooth(0.15, 0.75, turbulence),
  }
}

export function createMorph() {
  const zero = () => ({ ridge: 0, shrink: 0, bubble: 0, strata: 0 })
  return { live: zero(), memory: zero(), shown: zero(), mode: 'plain' }
}

/** One step: follow the medium, remember it, freeze as it crystallizes. */
export function stepMorph(m, env, dt, level = 0) {
  if (!(dt > 0)) return m
  const step = Math.min(dt, 0.25)
  const target = morphTargets(env)
  const open = 1 - smooth(0.35, 0.6, level) /* frozen once crystallized */
  const follow = (1 - Math.exp(-step / 4)) * open
  const fade = Math.exp(-step / 130)
  for (const k of MORPH_KEYS) {
    m.live[k] += (target[k] - m.live[k]) * follow
    m.memory[k] = Math.max(m.memory[k] * (open > 0.01 ? fade : 1), m.live[k])
    const want = Math.max(m.live[k], 0.6 * m.memory[k])
    m.shown[k] += (want - m.shown[k]) * Math.min(1, open * 4)
  }
  /* The crystal habit is decided as crystallization takes hold, and kept;
     it is reconsidered only if the body thaws again. */
  if (level < 0.1) m.mode = 'plain'
  else if (level > 0.25 && m.mode === 'plain') m.mode = crystalModeOf(m.shown)
  return m
}

export function crystalModeOf(shown) {
  let best = 'plain'
  let v = 0.2
  for (const k of MORPH_KEYS) {
    if (shown[k] > v) {
      v = shown[k]
      best = k
    }
  }
  return best
}

/**
 * How each shape crystallizes:
 *   facets   [deepest, proudest] cut of the facet planes; extra planes
 *   crystal  length / width multipliers; flat = tilt toward the surface
 */
export const CRYSTAL_MODES = Object.freeze({
  plain: { facets: [0.86, 1.04], extra: null, len: 1, width: 1, flat: 0 },
  ridge: { facets: [0.86, 1.04], extra: 'prism', len: 1.55, width: 0.72, flat: 0 },
  shrink: { facets: [0.78, 1.0], extra: null, len: 0.62, width: 0.85, flat: 0 },
  bubble: { facets: [0.95, 1.03], extra: null, len: 0.42, width: 1.5, flat: 0 },
  strata: { facets: [0.86, 1.04], extra: 'tabular', len: 0.55, width: 1.7, flat: 0.65 },
})

/* --- JS mirror of the membrane shader's shape (habitatShaders.js) ------- */

const fract = (x) => x - Math.floor(x)
function bnHash(x, y, z) {
  x = fract(x * 0.3183099 + 0.1) * 17
  y = fract(y * 0.3183099 + 0.1) * 17
  z = fract(z * 0.3183099 + 0.1) * 17
  return fract(x * y * z * (x + y + z))
}
function bnNoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  let fx = x - ix, fy = y - iy, fz = z - iz
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz)
  const h = (a, b, c) => bnHash(ix + a, iy + b, iz + c)
  const l = (a, b, t) => a + (b - a) * t
  return l(l(l(h(0, 0, 0), h(1, 0, 0), fx), l(h(0, 1, 0), h(1, 1, 0), fx), fy), l(l(h(0, 0, 1), h(1, 0, 1), fx), l(h(0, 1, 1), h(1, 1, 1), fx), fy), fz)
}
function bnFrame(ax) {
  const c = Math.abs(ax[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]
  const t1 = unit3(ax[1] * c[2] - ax[2] * c[1], ax[2] * c[0] - ax[0] * c[2], ax[0] * c[1] - ax[1] * c[0])
  const t2 = [ax[1] * t1[2] - ax[2] * t1[1], ax[2] * t1[0] - ax[0] * t1[2], ax[0] * t1[1] - ax[1] * t1[0]]
  return [t1, t2]
}
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** u: { unit, openDir, flowTime, swirl } */
export function shapeRidge(fc, local, u) {
  const [t1, t2] = bnFrame(u.openDir)
  const ang = Math.atan2(dot3(fc, t2), dot3(fc, t1))
  const lat = Math.acos(clamp(dot3(fc, u.openDir), -1, 1))
  const k = 1.6 / Math.max(u.unit, 1e-4)
  const warp = bnNoise(local[0] * k * 1.3, local[1] * k * 1.3 + u.flowTime * 0.03, local[2] * k * 1.3) * 2 - 1
  const mer = ang * 9 + warp * (1.4 + 2.4 * u.swirl) + lat * (1.2 + 2.6 * u.swirl)
  const fade = smooth(0.18, 0.55, lat) * (1 - smooth(2.55, 3.05, lat))
  const b = 0.5 + 0.5 * Math.sin(mer)
  const sub = 0.5 + 0.5 * Math.sin(mer * 3 + 1.3)
  return (b ** 1.6 * 0.75 + sub ** 2 * 0.25 - 0.36) * fade
}

export function shapeBubble(fc) {
  const px = fc[0] * 3.2 + 5.3, py = fc[1] * 3.2 + 1.7, pz = fc[2] * 3.2 + 9.1
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz)
  const fx = px - ix, fy = py - iy, fz = pz - iz
  let best = 0
  for (let z = -1; z <= 1; z++) for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
    const cx = ix + x, cy = iy + y, cz = iz + z
    const dx = x + bnHash(cx, cy, cz) - fx
    const dy = y + bnHash(cx + 17, cy + 3, cz + 11) - fy
    const dz = z + bnHash(cx + 5, cy + 29, cz + 7) - fz
    const r = 0.32 + 0.3 * bnHash(cx + 41, cy + 13, cz + 2)
    const q2 = 1 - (dx * dx + dy * dy + dz * dz) / (r * r)
    if (q2 > 0) best = Math.max(best, (Math.sqrt(q2) * r) / 0.62)
  }
  return best
}

export function shapeStrata(local, u) {
  const k = 1 / Math.max(u.unit, 1e-4)
  const t = local[1] * k * 3.2 + (bnNoise(local[0] * k * 1.1 + 3, local[1] * k * 1.1, local[2] * k * 1.1) - 0.5) * 0.9
  const f = fract(t)
  return smooth(0, 0.2, f) * (1 - smooth(0.72, 1, f)) - 0.55
}

/** Total relief along the normal (local units), as the shader computes it. */
export function shapeHeight(fc, local, u) {
  let h = 0
  if (u.fold > 1e-6) h += u.fold * shapeRidge(fc, local, u)
  if (u.bubble > 1e-6) h += u.bubble * shapeBubble(fc)
  if (u.strata > 1e-6) h += u.strata * shapeStrata(local, u)
  return h
}
