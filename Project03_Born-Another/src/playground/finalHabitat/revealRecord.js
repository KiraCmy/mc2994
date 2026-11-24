/**
 * World Final end-of-life record: the numbers and words the reveal panel
 * shows, derived from the life's story (lifeLog.summarizeLife) and the water.
 * Pure (no React / three); every helper copes with a missing story (the lab
 * page, or a life the log never saw).
 */

const CHANNELS = ['temperature', 'moisture', 'turbulence']

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** "02:58" — minutes always two digits. */
export function clock(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '—'
  const s = Math.max(0, Math.round(Number(seconds)))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Mean water over its life (or the water now, without a timeline). */
export function averageEnvironment(story, env = {}) {
  const tl = story?.timeline ?? []
  const out = {}
  for (const k of CHANNELS) {
    out[k] = tl.length ? tl.reduce((sum, s) => sum + num(s[k]), 0) / tl.length : num(env[k], k === 'turbulence' ? 0 : 0.5)
    out[k] = Math.min(1, Math.max(0, out[k]))
  }
  return out
}

/** Crystallization it ended with (the last sample; `fallback` without one). */
export function finalLevel(story, fallback = 1) {
  const tl = story?.timeline ?? []
  return tl.length ? num(tl[tl.length - 1].level, fallback) : fallback
}

/** "Language · 3 / 2 heard", or "Silence" when nothing was said. */
export function interactionLabel(story) {
  const words = story?.words ?? []
  if (!story) return '—'
  if (!words.length) return 'Silence'
  const heard = words.filter((w) => w.applied).length
  return `Language · ${words.length} / ${heard} heard`
}

/**
 * The crystallization over its life as a smooth curve in a w × h box (and the
 * same curve closed to the baseline, for a soft fill), plus the peak (where
 * the marker sits). Null without at least two samples.
 */
export function lifecycleCurve(story, w = 260, h = 56, pad = 4) {
  const tl = story?.timeline ?? []
  if (tl.length < 2) return null
  const t0 = num(tl[0].t)
  const t1 = Math.max(t0 + 1e-6, num(tl[tl.length - 1].t))
  const raw = tl.map((s) => Math.min(1, Math.max(0, num(s.level))))
  /* Soften sampling noise (ends kept). */
  const vals = raw.map((v, i) => (i === 0 || i === raw.length - 1 ? v : (raw[i - 1] + 2 * v + raw[i + 1]) / 4))
  let peak = 0
  for (let i = 1; i < raw.length; i++) if (raw[i] > raw[peak]) peak = i
  const pts = tl.map((s, i) => [((num(s.t) - t0) / (t1 - t0)) * w, h - pad - vals[i] * (h - pad * 2)])
  /* Catmull-Rom through the points, as cubic Béziers. */
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  const area = `${d} L${w} ${h} L0 ${h} Z`
  return { d, area, peak: { x: pts[peak][0], y: pts[peak][1], t: num(tl[peak].t), level: raw[peak] } }
}

const THRESHOLD_LABEL = { 0.25: 'Crystals appear', 0.5: 'Mineralization', 0.75: 'Hardening', 0.95: 'Fully crystallized' }

function shortWords(text, max = 22) {
  const s = String(text ?? '').trim()
  return s.length > max ? `“${s.slice(0, max - 1)}…”` : `“${s}”`
}

/**
 * Key events in order: emergence, the words said to it, crystallization
 * thresholds, and the end. At most `max`, always keeping the first and last.
 */
export function keyEvents(story, max = 6) {
  if (!story) return []
  const list = [{ t: 0, label: 'Emergence', kind: 'birth' }]
  for (const w of story.words ?? []) list.push({ t: num(w.t), label: shortWords(w.text), kind: w.applied ? 'words' : 'unheard' })
  for (const e of story.events ?? []) {
    if (e.type === 'crystallization') list.push({ t: num(e.t), label: THRESHOLD_LABEL[e.threshold] ?? 'Crystallization', kind: 'crystal' })
  }
  const end = story.lived ?? null
  if (end != null) list.push({ t: num(end), label: story.witnessedEnd === false ? 'Died unwitnessed' : 'Decomposition', kind: 'end' })
  list.sort((a, b) => a.t - b.t)
  if (list.length <= max) return list
  const middle = list.slice(1, -1)
  /* Keep crystallization over words when trimming; then earliest first. */
  const ranked = middle
    .map((e, i) => ({ e, i, rank: e.kind === 'crystal' ? 0 : 1 }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, max - 2)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.e)
  return [list[0], ...ranked, list[list.length - 1]]
}

const HABIT = {
  spiral: 'druse prisms',
  segmented: 'satin plates',
  trilobite: 'iridescent blocks',
}

/** The three labels pointed at on the body, worded from its water and end. */
export function anatomyCallouts({ species = 'spiral', env = {}, level = 1 } = {}) {
  const t = num(env.temperature, 0.5)
  const m = num(env.moisture, 0.5)
  const u = num(env.turbulence, 0)
  const habit = HABIT[species] ?? HABIT.spiral
  const driver = m < 0.35 ? 'driven by low moisture' : t < 0.35 ? 'set by cold water' : u < 0.2 ? 'grown in calm water' : 'slowed by moving water'
  const membrane = u > 0.5 ? 'banded by turbulence' : u < 0.15 ? 'settled in still water' : 'marked by shifting water'
  const core = t > 0.65 ? 'ridged by warm water' : t < 0.35 ? 'contracted in the cold' : 'steady in mild water'
  return [
    { id: 'mineral', title: 'Mineral deposit', lines: [`${Math.round(level * 100)}% crystallized · ${habit}`, driver] },
    { id: 'membrane', title: 'Membrane', lines: ['Translucent layer', membrane] },
    { id: 'core', title: 'Core', lines: ['Growth node, sensitive', core] },
  ]
}
