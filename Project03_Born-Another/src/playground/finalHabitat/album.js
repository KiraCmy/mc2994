/**
 * The world album: moments of World Final the viewer chose to capture (the
 * whole scene, no text). Pictures are too large for localStorage, so they
 * live in this browser's IndexedDB as Blobs; every call is guarded so the
 * page works where storage is unavailable (private windows, blocked data).
 */

export const ALBUM_DB = 'born-another'
export const ALBUM_STORE = 'album'
export const ALBUM_LIMIT = 120
/** Fired on window after the album changes (detail: { count }). */
export const ALBUM_EVENT = 'born-another:album'

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const req = indexedDB.open(ALBUM_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(ALBUM_STORE)) db.createObjectStore(ALBUM_STORE, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).catch((e) => {
    dbPromise = null
    throw e
  })
  return dbPromise
}

function run(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(ALBUM_STORE, mode)
        const store = tx.objectStore(ALBUM_STORE)
        let out
        Promise.resolve(fn(store)).then((v) => (out = v))
        tx.oncomplete = () => resolve(out)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

const req = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })

function announce(count) {
  try {
    window.dispatchEvent(new CustomEvent(ALBUM_EVENT, { detail: { count } }))
  } catch {
    /* no window */
  }
}

/** A capture record: the picture plus a little context (plain data + Blob). */
export function createCapture({ blob, width, height, savedAt = new Date(), environment = {}, crystallization = null, inCavern = false }) {
  const at = savedAt instanceof Date ? savedAt : new Date(savedAt)
  const r2 = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null)
  return {
    key: `moment-${at.getTime()}-${Math.floor(Math.random() * 1e6)}`,
    blob,
    width,
    height,
    savedAt: at.toISOString(),
    environment: {
      temperature: r2(environment.temperature),
      moisture: r2(environment.moisture),
      turbulence: r2(environment.turbulence),
    },
    crystallization: r2(crystallization),
    inCavern: Boolean(inCavern),
  }
}

/** All captures, newest first. Resolves [] if storage is unavailable. */
export async function listCaptures() {
  try {
    const all = await run('readonly', (store) => req(store.getAll()))
    return (all ?? []).filter((c) => c && c.blob).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
  } catch {
    return []
  }
}

export async function countCaptures() {
  try {
    return await run('readonly', (store) => req(store.count()))
  } catch {
    return 0
  }
}

/** Store a capture; the oldest go once the album is over ALBUM_LIMIT. */
export async function addCapture(capture) {
  await run('readwrite', (store) => req(store.put(capture)))
  const all = await listCaptures()
  if (all.length > ALBUM_LIMIT) {
    const extra = all.slice(ALBUM_LIMIT)
    await run('readwrite', (store) => Promise.all(extra.map((c) => req(store.delete(c.key)))))
  }
  const count = Math.min(all.length, ALBUM_LIMIT)
  announce(count)
  return count
}

export async function removeCapture(key) {
  try {
    await run('readwrite', (store) => req(store.delete(key)))
  } catch {
    /* ignore */
  }
  const count = await countCaptures()
  announce(count)
  return count
}
