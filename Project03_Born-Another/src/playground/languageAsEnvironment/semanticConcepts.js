/**
 * Semantic environmental concept lexicon (Step 02B).
 * Modular: replaceable by a richer model later. Pure data + match helpers.
 */

/** @typedef {'temperature'|'moisture'|'disturbance'} EnvChannel */

/**
 * Six semantic categories → three continuous channels.
 * @type {{
 *   id: string,
 *   label: string,
 *   channel: EnvChannel,
 *   sign: 1|-1,
 *   patterns: RegExp[],
 * }[]}
 */
export const SEMANTIC_CONCEPTS = [
  {
    id: 'water',
    label: 'Water / Wetness',
    channel: 'moisture',
    sign: 1,
    patterns: [
      /\brain(ing|s|y)?\b/,
      /\bwater(s|y|ed|ing)?\b/,
      /\bwet(ter|ness|ting)?\b/,
      /\bhumid(ity)?\b/,
      /\bmoist(ure|en(ed|ing)?)?\b/,
      /\bdamp(ness|en)?\b/,
      /\bsogg(y|iness)\b/,
      /\bflood(ing|ed|s)?\b/,
      /\bpour(ing|s|ed)?\b/,
      /\bdrizzle(s|d|ing)?\b/,
      /\bdownpour\b/,
      /\bshower(s|y)?\b/,
      /\bpuddle(s)?\b/,
      /\bdew\b/,
      /\bsoak(ed|ing)?\b/,
      /\bsaturated?\b/,
    ],
  },
  {
    id: 'dryness',
    label: 'Dryness',
    channel: 'moisture',
    sign: -1,
    patterns: [
      /\bdry(er|est|ness|ing)?\b/,
      /\bdried\b/,
      /\barid(ity)?\b/,
      /\bdrought\b/,
      /\bparch(ed|ing)?\b/,
      /\bdesiccat(e|ed|ion)\b/,
      /\bdehydrat(e|ed|ion|ing)\b/,
      /\bdesert(-?\w+)?\b/,
      /\bbarren\b/,
      /\bcrumbly\b/,
      /\bwither(ed|ing)?\b/,
    ],
  },
  {
    id: 'heat',
    label: 'Heat',
    channel: 'temperature',
    sign: 1,
    patterns: [
      /\bheat(ed|ing|s)?\b/,
      /\bhot(ter|test)?\b/,
      /\bwarm(er|est|ing|th)?\b/,
      /\bfire(s)?\b/,
      /\bflame(s|d)?\b/,
      /\bburn(ing|s|ed|t)?\b/,
      /\bignite(d|s)?\b/,
      /\bblaz(e|ing)\b/,
      /\bscorch(ing|ed)?\b/,
      /\bsizzl(e|ing)\b/,
      /\bswelter(ing)?\b/,
      /\btropical\b/,
      /\bsultry\b/,
    ],
  },
  {
    id: 'cold',
    label: 'Cold',
    channel: 'temperature',
    sign: -1,
    patterns: [
      /\bcold(er|est)?\b/,
      /\bcool(er|est|ing)?\b/,
      /\bchill(y|ed|ing)?\b/,
      /\bfreez(e|es|ing|er)\b/,
      /\bfrozen\b/,
      /\bice\b/,
      /\bicy\b/,
      /\bfrost(y|ed)?\b/,
      /\bfrigid\b/,
      /\bwintry\b/,
      /\bsnow(y|ing|s)?\b/,
      /\bglacial\b/,
    ],
  },
  {
    id: 'turbulence',
    label: 'Turbulence',
    channel: 'disturbance',
    sign: 1,
    patterns: [
      /\bstorm(y|s)?\b/,
      /\bwind(y|s)?\b/,
      /\bgale(s)?\b/,
      /\bgust(y|s|ing)?\b/,
      /\bturbulen(t|ce)\b/,
      /\bchaotic\b/,
      /\bviolenc(e|t)\b/,
      /\brough\b/,
      /\bwild\b/,
      /\btumult(uous)?\b/,
      /\btempest(uous)?\b/,
      /\bhurricane\b/,
      /\btyphoon\b/,
      /\btornado\b/,
      /\bsquall(s)?\b/,
      /\bblow(ing|s|n)?\b/,
      /\broar(ing)?\b/,
      /\bhowl(ing)?\b/,
    ],
  },
  {
    id: 'stillness',
    label: 'Stillness',
    channel: 'disturbance',
    sign: -1,
    patterns: [
      /\bcalm(er|est|ly)?\b/,
      /\bquiet(er|est|ly)?\b/,
      /\bstill(ness|er)?\b/,
      /\bpeaceful\b/,
      /\bpeace\b/,
      /\bserene\b/,
      /\btranquil(l?ity)?\b/,
      /\bgentle\b/,
      /\bsettled\b/,
      /\bplacid\b/,
      /\bhushed\b/,
      /\bmotionless\b/,
      /\bunruffled\b/,
      /\bsheltered\b/,
    ],
  },
]

/**
 * Base impulse per concept hit (before Impulse Strength).
 * Kept moderate so repeated words can climb Temperature toward 1.0
 * instead of saturating on a single "hot".
 */
export const CONCEPT_IMPULSE = 0.14

/** Soft weight for the n-th repeated hit (1-based): full, then diminishing. */
export function stackWeightForHitIndex(index) {
  if (index <= 1) return 1
  if (index === 2) return 0.85
  if (index === 3) return 0.7
  if (index === 4) return 0.55
  return 0.45
}

/** Sum of stack weights for a hit count (how much stronger than a single word). */
export function stackedImpulseScale(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  let scale = 0
  for (let i = 1; i <= n; i += 1) scale += stackWeightForHitIndex(i)
  return scale
}

const NEGATION = /\b(no|not|never|without|n't|neither|nor)\b/i

export function conceptMatches(text, concept) {
  return countConceptMatches(text, concept) > 0
}

/**
 * Count lexicon token hits in text (repeats of "hot hot hot" stack).
 * Each pattern is matched globally; overlapping pattern families can all contribute.
 */
export function countConceptMatches(text, concept) {
  const lower = String(text ?? '').toLowerCase()
  let count = 0
  for (const pattern of concept.patterns) {
    const flags = pattern.flags.includes('g')
      ? pattern.flags
      : `${pattern.flags}g`
    const re = new RegExp(pattern.source, flags)
    const matches = lower.match(re)
    if (matches) count += matches.length
  }
  return count
}

export function clauseNegatesConcept(clause, concept) {
  if (!NEGATION.test(clause)) return false
  return conceptMatches(clause, concept)
}

/**
 * Collect matched categories from a clause with hit counts.
 * @returns {{ id: string, label: string, channel: EnvChannel, sign: 1|-1, negated: boolean, count: number }[]}
 */
export function matchConceptsInText(text) {
  const hits = []
  for (const concept of SEMANTIC_CONCEPTS) {
    const count = countConceptMatches(text, concept)
    if (count <= 0) continue
    const negated = clauseNegatesConcept(text, concept)
    hits.push({
      id: concept.id,
      label: concept.label,
      channel: concept.channel,
      sign: concept.sign,
      negated,
      count,
    })
  }
  return hits
}
