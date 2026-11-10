/**
 * Words for the archive page, computed from a specimen record (pure).
 * Older records (before the life log) lack the story fields: every helper
 * falls back to what they do have.
 */
import { describeEnvironment, formatDuration } from '../playground/finalHabitat/archive.js'

export function specimenNumber(entries, key) {
  const i = entries.findIndex((e) => e.key === key)
  return i < 0 ? '—' : String(entries.length - i).padStart(3, '0')
}

export function lastWords(e) {
  const words = e?.words ?? []
  return words.length ? words[words.length - 1] : null
}

/** "Temperature −, Moisture +" from a parsed impulse. */
export function effectLabels(word) {
  if (!word?.applied) return ['Not understood']
  const out = []
  const imp = word.impulses ?? {}
  const sign = (v) => (v > 0 ? '+' : '−')
  if (imp.temperature) out.push(`Temperature ${sign(imp.temperature)}`)
  if (imp.moisture) out.push(`Moisture ${sign(imp.moisture)}`)
  if (imp.disturbance) out.push(`Turbulence ${sign(imp.disturbance)}`)
  return out.length ? out : ['Heard']
}

export function envWords(env = {}) {
  const t = Number(env.temperature ?? 0.5)
  const m = Number(env.moisture ?? 0.5)
  const u = Number(env.turbulence ?? 0)
  return {
    temperature: t < 0.35 ? 'cold' : t > 0.65 ? 'warm' : 'mild',
    moisture: m < 0.35 ? 'dry' : m > 0.65 ? 'wet' : 'temperate',
    turbulence: u > 0.5 ? 'stormy' : u < 0.15 ? 'still' : 'moving',
  }
}

export function duration(seconds) {
  return seconds == null ? '—' : formatDuration(seconds)
}

/** "02:32" (minutes always two digits) — the archive sheet's clock. */
export function clock(seconds) {
  if (seconds == null) return '—'
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** "4 min 12 s". */
export function lifeSpan(seconds) {
  if (seconds == null) return '—'
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  const m = Math.floor(s / 60)
  return m ? `${m} min ${s % 60} s` : `${s} s`
}

export function finalCondition(level) {
  const v = Number(level) || 0
  if (v >= 0.95) return 'Fully crystallized'
  if (v >= 0.5) return 'Partially crystallized'
  if (v >= 0.15) return 'Lightly crystallized'
  return 'Uncrystallized'
}

const CHANNELS = ['temperature', 'moisture', 'turbulence']

/** Per-channel series (0..1) over its life, with times; flat at the kept
 *  environment for records without a timeline. */
export function envSeries(e) {
  const tl = e?.timeline ?? []
  if (tl.length >= 2) {
    return CHANNELS.map((key) => ({ key, points: tl.map((s) => ({ t: s.t ?? 0, v: Number(s[key] ?? 0) })) }))
  }
  const env = e?.environment ?? {}
  return CHANNELS.map((key) => ({ key, points: [{ t: 0, v: Number(env[key] ?? 0) }, { t: 1, v: Number(env[key] ?? 0) }] }))
}

const MOVES = {
  temperature: { up: 'rise in temperature', down: 'fall in temperature', upFx: 'Its membrane contracted', downFx: 'Its growth slowed in the cold' },
  moisture: { up: 'rise in moisture', down: 'drying of its water', upFx: 'Its body swelled and grew quickly', downFx: 'Its skin dried and stiffened' },
  turbulence: { up: 'stirring of the water', down: 'stilling of the water', upFx: 'Its body was shaken and bruised', downFx: 'It settled and grew calmly' },
}

/** The biggest change it lived through and what remained — one short paragraph. */
export function lifeCaption(e) {
  const level = Number(e?.crystallization ?? 0)
  const remained =
    level >= 0.95 ? 'it crystallized completely' : level >= 0.5 ? 'crystalline traces remained' : 'little crystal formed on it'
  const tl = e?.timeline ?? []
  let best = null
  for (const key of CHANNELS) {
    if (tl.length < 2) break
    const vs = tl.map((s) => Number(s[key] ?? 0))
    let lo = 0
    let hi = 0
    for (let i = 1; i < vs.length; i++) {
      if (vs[i] < vs[lo]) lo = i
      if (vs[i] > vs[hi]) hi = i
    }
    const swing = vs[hi] - vs[lo]
    if (!best || swing > best.swing) {
      let jump = 0
      for (let i = 1; i < vs.length; i++) jump = Math.max(jump, Math.abs(vs[i] - vs[i - 1]))
      best = { key, swing, up: hi > lo, sudden: jump > 0.12 }
    }
  }
  if (!best || best.swing < 0.08) {
    return `It lived in ${describeEnvironment(e?.environment)} water that barely changed, and ${remained}.`
  }
  const move = MOVES[best.key]
  return `It lived through a ${best.sudden ? 'sudden' : 'slow'} ${best.up ? move.up : move.down}. ${best.up ? move.upFx : move.downFx}, and ${remained}.`
}

/** Birth → growth → crystallization → remains, each with its picture (or
 *  null) and time. Birth reuses the first picture, drawn small; a stage that
 *  was never photographed borrows the nearest later picture. */
export function lifeStages(e) {
  const byName = Object.fromEntries((e?.stages ?? []).map((s) => [s.name, s]))
  const first = byName.first ?? null
  const crys = byName.crystallizing ?? null
  const crysEvent = (e?.events ?? []).find((ev) => ev.type === 'crystallization')
  const remains = e?.image ?? null
  const crysImage = crys?.image ?? remains
  const firstImage = first?.image ?? crysImage
  return [
    { id: 'birth', label: 'Birth', t: e?.lived == null ? null : 0, image: firstImage, scale: 0.42 },
    { id: 'growth', label: 'Growth', t: first?.t ?? null, image: firstImage, scale: 0.7 },
    { id: 'crystallization', label: 'Crystallization', t: crys?.t ?? crysEvent?.t ?? null, image: crysImage, scale: 0.86 },
    { id: 'remains', label: 'Remains', t: e?.lived ?? null, image: remains, scale: 1 },
  ]
}

/** One line for the overview under a specimen. */
export function overviewLine(e) {
  const parts = [e.name]
  if (e.lived != null) parts.push(formatDuration(e.lived))
  const head = parts.join(' · ')
  const words = e.words ?? []
  let tail = `Lived in ${describeEnvironment(e.environment)} water.`
  if (e.witnessedEnd === false) tail = 'Died unwitnessed, and was found as a husk.'
  else if (e.lived != null && !words.length) tail = 'Nothing was ever said to it.'
  else if (words.length) {
    const heard = words.filter((w) => w.applied).length
    tail = `${words.length} ${words.length === 1 ? 'word' : 'words'} given, ${heard} understood.`
  }
  return `${head}. ${tail}`
}

/** A short account of its life for the specimen page. */
export function lifeSummary(e) {
  const env = describeEnvironment(e.environment)
  const level = Math.round((e.crystallization ?? 0) * 100)
  const words = e.words ?? []
  const rises = countRises(e.timeline ?? [])
  const said = words.length ? ` ${words.length === 1 ? 'One thing was' : `${words.length} things were`} said into its water.` : ' Nothing was said into its water.'
  const rose = rises ? ` Its crystallization rose ${rises === 1 ? 'once' : `${rises} times`}.` : ''
  return `Its body grew in ${env} water and ended ${level}% crystallized.${rose}${said}`
}

/** How many separate climbs the crystallization made (runs of rising
 *  samples that gained more than `step` in total). */
export function countRises(timeline, step = 0.06, eps = 0.003) {
  let rises = 0
  let gain = 0
  for (let i = 1; i < timeline.length; i++) {
    const d = (timeline[i].level ?? 0) - (timeline[i - 1].level ?? 0)
    if (d > eps) gain += d
    else {
      if (gain > step) rises += 1
      gain = 0
    }
  }
  if (gain > step) rises += 1
  return rises
}
