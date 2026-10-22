import { normalizeMemoryText } from './generateMockMemorySignature.js'

/** Stable uint32 seed from normalized memory text (FNV-1a). */
export function seedFromMemoryText(text) {
  const normalized = normalizeMemoryText(text)
  let hash = 2166136261
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const seed = hash >>> 0
  return seed === 0 ? 1 : seed
}
