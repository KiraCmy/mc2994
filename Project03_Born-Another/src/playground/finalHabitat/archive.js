/**
 * The viewer's archive: specimens they chose to keep after a life ended.
 * Stored in this browser (localStorage); every access is guarded so the page
 * works where storage is unavailable (private windows, blocked site data).
 */

export const ARCHIVE_KEY = 'born-another.archive.v1'
export const ARCHIVE_LIMIT = 60

function defaultStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function loadArchive(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(ARCHIVE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((e) => e && typeof e.key === 'string') : []
  } catch {
    return []
  }
}

function write(list, storage) {
  try {
    storage?.setItem(ARCHIVE_KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

/** A specimen record from the life that ended (plain JSON). */
export function createSpecimen({ fossil, species, seed, generation = 0, environment = {}, crystallization = 0, savedAt = new Date(), story = null, image = null }) {
  const at = savedAt instanceof Date ? savedAt : new Date(savedAt)
  const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100
  return {
    key: `${fossil?.id ?? species ?? 'life'}-${seed ?? 0}-${generation}-${at.getTime()}`,
    fossilId: fossil?.id ?? null,
    name: fossil?.name ?? 'Unknown life',
    latin: fossil?.latin ?? '',
    appeared: fossil?.appeared ?? '',
    vanished: fossil?.vanished ?? '',
    species: species ?? null,
    seed: seed ?? null,
    generation,
    environment: {
      temperature: r2(environment.temperature),
      moisture: r2(environment.moisture),
      turbulence: r2(environment.turbulence),
    },
    crystallization: r2(crystallization),
    savedAt: at.toISOString(),
    /* The life's story (World Final): see lifeLog.summarizeLife. */
    lived: story?.lived ?? null,
    watched: story?.watched ?? null,
    witnessedEnd: story?.witnessedEnd ?? null,
    words: story?.words ?? [],
    timeline: story?.timeline ?? [],
    events: story?.events ?? [],
    stages: story?.stages ?? [],
    /* A picture of the remains, cropped from the world (data URL). */
    image: typeof image === 'string' ? image : null,
  }
}

/** The same specimen without pictures (when storage runs out). */
function withoutPictures(specimen, keepRemains) {
  return { ...specimen, stages: (specimen.stages ?? []).map(({ image, ...rest }) => rest), image: keepRemains ? specimen.image : null }
}

/** Adds a specimen (newest first). Returns { list, saved }. */
export function saveSpecimen(specimen, storage = defaultStorage()) {
  const rest = loadArchive(storage).filter((e) => e.key !== specimen.key)
  /* Pictures are the heavy part: if the browser's storage is full, keep the
     record with fewer of them rather than not at all. */
  for (const s of [specimen, withoutPictures(specimen, true), withoutPictures(specimen, false)]) {
    const list = [s, ...rest].slice(0, ARCHIVE_LIMIT)
    if (write(list, storage)) return { list, saved: true }
  }
  return { list: [specimen, ...rest].slice(0, ARCHIVE_LIMIT), saved: false }
}

export function findSpecimen(key, storage = defaultStorage()) {
  return loadArchive(storage).find((e) => e.key === key) ?? null
}

/** "4:12" from seconds. */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function removeSpecimen(key, storage = defaultStorage()) {
  const list = loadArchive(storage).filter((e) => e.key !== key)
  write(list, storage)
  return list
}

/** The medium a specimen lived in, in words. */
export function describeEnvironment(env = {}) {
  const t = Number(env.temperature ?? 0.5)
  const m = Number(env.moisture ?? 0.5)
  const u = Number(env.turbulence ?? 0)
  const words = [t < 0.35 ? 'cold' : t > 0.65 ? 'warm' : 'mild', m < 0.35 ? 'dry' : m > 0.65 ? 'wet' : 'temperate']
  if (u > 0.5) words.push('stormy')
  else if (u < 0.15) words.push('still')
  return words.join(', ')
}
