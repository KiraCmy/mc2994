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
export function createSpecimen({ fossil, species, seed, generation = 0, environment = {}, crystallization = 0, savedAt = new Date() }) {
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
  }
}

/** Adds a specimen (newest first). Returns { list, saved }. */
export function saveSpecimen(specimen, storage = defaultStorage()) {
  const list = [specimen, ...loadArchive(storage).filter((e) => e.key !== specimen.key)].slice(0, ARCHIVE_LIMIT)
  return { list, saved: write(list, storage) }
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
