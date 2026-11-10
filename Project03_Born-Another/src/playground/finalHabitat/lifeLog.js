/**
 * World Final life log: what happened to each life while it lived, so its
 * archive record can tell its story (when it was born and ended, how long it
 * was watched, what was said into the water, how the water and its
 * crystallization moved, and a few pictures along the way).
 *
 * Pure data, no React / three. Times are seconds on one clock (the page's
 * performance clock divided by 1000).
 */

export const SAMPLE_EVERY = 1 /* seconds between samples */
const MAX_SAMPLES = 900
const MAX_LIVES = 24
const MAX_WORDS = 200
const TIMELINE_POINTS = 64
const CRYSTAL_THRESHOLDS = [0.25, 0.5, 0.75, 0.95]

export function createLifeLog() {
  return { lives: new Map(), words: [] }
}

/** A life's record (created the first time the life is seen). */
export function lifeEntry(log, key, now, extra = {}) {
  let life = log.lives.get(key)
  if (!life) {
    life = { key, bornAt: now, endedAt: null, watched: 0, witnessedEnd: false, samples: [], stages: {}, events: [], ...extra }
    log.lives.set(key, life)
    if (log.lives.size > MAX_LIVES) {
      /* Forget the oldest finished lives first. */
      const old = [...log.lives.values()].sort((a, b) => (a.endedAt == null) - (b.endedAt == null) || a.bornAt - b.bornAt)
      for (const l of old) {
        if (log.lives.size <= MAX_LIVES) break
        if (l.key !== key) log.lives.delete(l.key)
      }
    }
  }
  return life
}

/**
 * One tick for one life: `level` its crystallization, `env` the water,
 * `watched` whether the viewer is observing it, `ended` whether it has ended.
 */
export function sampleLife(log, key, now, { level = 0, env = {}, watched = false, ended = false, dt = SAMPLE_EVERY } = {}) {
  const life = lifeEntry(log, key, now)
  if (life.endedAt != null) return life
  if (watched) life.watched += dt
  /* Biological events, as the simulation produced them: crystallization
     passing a threshold, and the end. */
  const prev = life.samples[life.samples.length - 1]
  if (prev) {
    for (const th of CRYSTAL_THRESHOLDS) {
      if (prev.level < th && level >= th) life.events.push({ t: round(now - life.bornAt, 1), type: 'crystallization', threshold: th })
    }
  }
  if (ended) life.events.push({ t: round(now - life.bornAt, 1), type: 'ended', watched: Boolean(watched) })
  life.samples.push({
    t: now - life.bornAt,
    level: round(level),
    temperature: round(env.temperature),
    moisture: round(env.moisture),
    turbulence: round(env.turbulence),
  })
  if (life.samples.length > MAX_SAMPLES) life.samples.splice(0, life.samples.length - MAX_SAMPLES)
  if (ended) {
    life.endedAt = now
    life.witnessedEnd = Boolean(watched)
  }
  return life
}

/**
 * Something said into the water (it reaches every life living then).
 * `impulses` are the changes actually applied to the environment (at full
 * strength); `interpretation` what the interpreter read; `ages` the AGE of
 * the lives at that moment; `envBefore` the water just before.
 */
export function logWords(log, now, { text, applied = false, impulses = {}, interpretation = null, ages = null, envBefore = null, durationSeconds = null }) {
  log.words.push({
    at: now,
    text: String(text ?? '').slice(0, 500),
    applied: Boolean(applied),
    impulses: cleanImpulses(impulses),
    interpretation,
    ages,
    envBefore: envBefore ? { temperature: round(envBefore.temperature), moisture: round(envBefore.moisture), turbulence: round(envBefore.turbulence) } : null,
    durationSeconds,
  })
  if (log.words.length > MAX_WORDS) log.words.splice(0, log.words.length - MAX_WORDS)
}

/** Keeps a picture of the life at a named stage (first one wins). */
export function setStage(log, key, now, name, image) {
  const life = log.lives.get(key)
  if (!life || !image || life.stages[name]) return
  life.stages[name] = { t: now - life.bornAt, image }
}

/**
 * The story of one life, ready for its archive record: plain JSON, with the
 * timeline thinned to a fixed number of points.
 */
export function summarizeLife(log, key, now) {
  const life = log.lives.get(key)
  if (!life) return null
  const end = life.endedAt ?? now
  const words = log.words
    .filter((w) => w.at >= life.bornAt && w.at <= end + 0.5)
    .map((w) => {
      const t = round(w.at - life.bornAt, 1)
      const window = (w.durationSeconds ?? 30) + 10
      return {
        t,
        text: w.text,
        applied: w.applied,
        impulses: w.impulses,
        interpretation: w.interpretation ?? null,
        ageAtWords: w.ages?.[life.key] ?? null,
        envBefore: w.envBefore ?? null,
        /* What this life's body did while the words were in the water. */
        followedBy: (life.events ?? []).filter((e) => e.t >= t && e.t <= t + window),
      }
    })
  return {
    lived: round(end - life.bornAt, 1),
    watched: round(life.watched, 1),
    witnessedEnd: life.witnessedEnd,
    words,
    timeline: thin(life.samples, TIMELINE_POINTS),
    events: (life.events ?? []).slice(0, 40),
    stages: Object.entries(life.stages).map(([name, s]) => ({ name, t: round(s.t, 1), image: s.image })),
  }
}

export function thin(samples, n) {
  if (samples.length <= n) return samples.slice()
  const out = []
  for (let i = 0; i < n; i++) out.push(samples[Math.round((i * (samples.length - 1)) / (n - 1))])
  return out
}

function cleanImpulses(imp = {}) {
  const out = {}
  for (const k of ['temperature', 'moisture', 'disturbance']) {
    const v = Number(imp[k])
    if (Number.isFinite(v) && Math.abs(v) > 1e-3) out[k] = round(v)
  }
  return out
}

function round(v, digits = 3) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  const k = 10 ** digits
  return Math.round(n * k) / k
}
