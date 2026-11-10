/**
 * Language → environment, the application side. An interpretation (shared
 * schema, from any provider) becomes one bounded *effect* on the water:
 * it eases in, holds for its duration, then relaxes back. Effects overlap
 * and add up, but their total per channel is capped, and the result always
 * stays inside the normalized [0, 1] range of each parameter.
 *
 * Pure (no React / DOM); time in seconds on any monotonic clock.
 */

export const INFLUENCE_RULES = Object.freeze({
  /** Largest change one expression can make to a channel. */
  maxStep: 0.5,
  /** Changes smaller than this are dropped (neutral language stays neutral). */
  deadzone: 0.008,
  /** Cap on the summed influence of all live effects, per channel. */
  maxTotal: 0.6,
  /**
   * Per-channel weight. Temperature drives crystallization most, so feelings
   * (carried mostly as warmth / coldness) reach the body through it.
   */
  channelGain: Object.freeze({ temperature: 1.3, moisture: 1, turbulence: 1.1 }),
  /** Shortest / longest time an expression holds. */
  minDuration: 15,
  maxDuration: 90,
  /** Seconds to ease in. */
  attack: 3,
  /** Relax time = duration × releaseFraction (at least minRelease s). */
  releaseFraction: 0.9,
  minRelease: 15,
})

const CHANNELS = ['temperature', 'moisture', 'turbulence']

let nextId = 1

/** Interpretation → effect (with the deltas it will actually apply at full strength). */
export function effectFromInterpretation(interp, now, rules = INFLUENCE_RULES) {
  const intensity = clamp(interp?.intensity, 0, 1)
  const confidence = clamp(interp?.confidence ?? 0.5, 0, 1)
  /* Quiet feelings still reach the water a little; confidence tempers it. */
  const scale = (0.3 + 0.7 * intensity) * (0.4 + 0.6 * confidence) * rules.maxStep
  const raw = {
    temperature: clamp(interp?.temperatureDelta, -1, 1),
    moisture: clamp(interp?.moistureDelta, -1, 1),
    turbulence: clamp(interp?.turbulenceDelta, -1, 1),
  }
  const deltas = {}
  for (const c of CHANNELS) {
    const d = clamp(raw[c] * scale * (rules.channelGain?.[c] ?? 1), -rules.maxStep, rules.maxStep)
    deltas[c] = Math.abs(d) < rules.deadzone ? 0 : round(d)
  }
  const duration = clamp(interp?.durationSeconds ?? 30, rules.minDuration ?? 5, rules.maxDuration ?? 90)
  return {
    id: nextId++,
    start: now,
    duration,
    release: Math.max(rules.minRelease, duration * rules.releaseFraction),
    attack: rules.attack,
    deltas,
    active: CHANNELS.some((c) => deltas[c] !== 0),
  }
}

/** 0 → 1 → 0 over an effect's life. */
export function envelope(effect, now) {
  const t = now - effect.start
  if (t <= 0) return 0
  const rise = smooth(0, effect.attack, t)
  if (t <= effect.duration) return rise
  return rise * (1 - smooth(effect.duration, effect.duration + effect.release, t))
}

/** Summed, capped influence of every live effect at `now`. */
export function influenceAt(effects, now, rules = INFLUENCE_RULES) {
  const out = { temperature: 0, moisture: 0, turbulence: 0 }
  for (const e of effects) {
    const k = envelope(e, now)
    if (k <= 0) continue
    for (const c of CHANNELS) out[c] += e.deltas[c] * k
  }
  for (const c of CHANNELS) out[c] = clamp(out[c], -rules.maxTotal, rules.maxTotal)
  return out
}

export function pruneEffects(effects, now) {
  return effects.filter((e) => now < e.start + e.duration + e.release)
}

/** Manual base values + language influence → the effective environment. */
export function composeEnvironment(base, influence) {
  return {
    temperature: clamp(base.temperature + influence.temperature, 0, 1),
    moisture: clamp(base.moisture + influence.moisture, 0, 1),
    turbulence: clamp(base.turbulence + influence.turbulence, 0, 1),
  }
}

/** "Moisture +, Temperature −" for an effect's deltas. */
export function influenceLabels(deltas = {}) {
  const names = { temperature: 'Temperature', moisture: 'Moisture', turbulence: 'Turbulence' }
  return CHANNELS.filter((c) => deltas[c]).map((c) => `${names[c]} ${deltas[c] > 0 ? '+' : '−'}`)
}

function smooth(e0, e1, x) {
  if (e1 <= e0) return x >= e1 ? 1 : 0
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

function clamp(v, min, max) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0
}

function round(v) {
  return Math.round(v * 10000) / 10000
}
