/**
 * Experiment 04 Population — proximity (contact) deformation.
 *
 * When two bodies come close, the facing sides of both membranes yield: a
 * soft dent on the side toward the neighbour and a slight bulge opposite.
 * Implemented as transient entries appended to the Life snapshot's
 * `outputs.form.localDeformations` — the same field World / Exp05 already use
 * for stimulus bumps — so body, petals and particle seats all follow it.
 * Nothing is written to Life history (fully reversible when bodies part).
 */

/** Quantisation of contact strength — limits CPU membrane re-morphs. */
const AMOUNT_STEP = 0.1

const DENT = -0.2
const BULGE = 0.05
const DENT_RADIUS = 0.42
const BULGE_RADIUS = 0.6

function rotateYInverse(dir, angle) {
  /* World → organism local (group spins about +Y). */
  const c = Math.cos(-angle)
  const s = Math.sin(-angle)
  return [dir[0] * c + dir[2] * s, dir[1], -dir[0] * s + dir[2] * c]
}

function quantise(amount) {
  return Math.round(Math.min(1, Math.max(0, amount)) / AMOUNT_STEP) * AMOUNT_STEP
}

/**
 * Local-space deformation regions for one organism's current contacts.
 * @param {{ spin: number, contacts: Array<{ id: string, direction: number[], amount: number }> }} org
 */
export function contactDeformations(org) {
  const out = []
  for (const c of org?.contacts || []) {
    const amount = quantise(c.amount)
    if (amount <= 0) continue
    const local = rotateYInverse(c.direction, org.spin || 0)
    out.push({
      id: `contact-${c.id}`,
      direction: local,
      radius: DENT_RADIUS,
      deformation: DENT * amount,
      response: amount,
    })
    out.push({
      id: `contact-${c.id}-far`,
      direction: [-local[0], -local[1], -local[2]],
      radius: BULGE_RADIUS,
      deformation: BULGE * amount,
      response: amount,
    })
  }
  return out
}

/** Stable key for a contact set (spin quantised to ~3°). */
export function contactKey(org) {
  if (!org?.contacts?.length) return ''
  const spin = Math.round((org.spin || 0) / 0.05)
  return (
    `${spin}|` +
    org.contacts
      .map((c) => `${c.id}:${quantise(c.amount).toFixed(1)}:${c.direction.map((v) => v.toFixed(1)).join(',')}`)
      .sort()
      .join(';')
  )
}

/**
 * Life snapshot with this organism's contact dents layered on top.
 * Returns `life` unchanged (same identity) when there is no contact.
 */
export function withContactDeformation(life, org) {
  if (!life?.outputs?.form) return life
  const extra = contactDeformations(org)
  if (extra.length === 0) return life
  return {
    ...life,
    outputs: {
      ...life.outputs,
      form: {
        ...life.outputs.form,
        localDeformations: [...(life.outputs.form.localDeformations || []), ...extra],
      },
    },
  }
}

/**
 * Memoising builder: only produces a new object when the base life or the
 * quantised contact set changed (keeps React / membrane work minimal).
 */
export function createContactLifeCache() {
  const cache = new Map()
  return function contactLives(organisms, lives, enabled = true) {
    /** @type {Record<string, object|null>} */
    const out = {}
    for (const org of organisms || []) {
      const base = lives?.[org.id]
      const key = enabled ? contactKey(org) : ''
      const prev = cache.get(org.id)
      if (prev && prev.base === base && prev.key === key) {
        out[org.id] = prev.value
        continue
      }
      const value = key && base ? withContactDeformation(base, org) : null
      cache.set(org.id, { base, key, value })
      out[org.id] = value
    }
    return out
  }
}
