/**
 * Rule-based environmental language parser (Step 02B).
 * Pure: same text → same parse. No env mutation / no LLM.
 *
 * Pipeline: clause split → concept match → intent classify → gated impulses.
 * Lexicon: semanticConcepts.js · Intent: classifyIntent.js
 */

import {
  classifyIntent,
  INTENT_LABELS,
  intentAppliesEnvironment,
} from './classifyIntent.js'
import {
  CONCEPT_IMPULSE,
  matchConceptsInText,
  SEMANTIC_CONCEPTS,
  stackedImpulseScale,
} from './semanticConcepts.js'

export {
  CONCEPT_IMPULSE,
  SEMANTIC_CONCEPTS,
  INTENT_LABELS,
  stackedImpulseScale,
}

function splitClauses(text) {
  return String(text ?? '')
    .split(/[.!?;]+|\band\b|\bthen\b/i)
    .map((part) => part.trim())
    .filter(Boolean)
}

function emptyImpulses() {
  return { temperature: 0, moisture: 0, disturbance: 0 }
}

function summarizeImpulses(impulses) {
  const parts = []
  if (impulses.temperature > 0) parts.push('Temperature +')
  if (impulses.temperature < 0) parts.push('Temperature −')
  if (impulses.moisture > 0) parts.push('Moisture +')
  if (impulses.moisture < 0) parts.push('Moisture −')
  if (impulses.disturbance > 0) parts.push('Disturbance +')
  if (impulses.disturbance < 0) parts.push('Disturbance −')
  if (!parts.length) return 'No net environmental impulse.'
  return `Impulses: ${parts.join(', ')}.`
}

function buildExplanation({
  intent,
  intentReason,
  concepts,
  cancelled,
  applied,
  impulses,
}) {
  const intentLabel = INTENT_LABELS[intent] ?? intent
  if (!concepts.length && !cancelled.length) {
    return `${intentLabel}: ${intentReason}`
  }

  const conceptPart =
    concepts.length > 0
      ? `Recognized ${concepts.join(', ')}.`
      : cancelled.length > 0
        ? `Detected ${cancelled.join(', ')} but negated.`
        : ''

  const impulsePart = applied
    ? summarizeImpulses(impulses)
    : 'Environmental impulse not applied.'

  return `${intentLabel}: ${intentReason} ${conceptPart} ${impulsePart}`
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {string} text
 * @returns {{
 *   text: string,
 *   intent: import('./classifyIntent.js').LanguageIntent,
 *   intentLabel: string,
 *   concepts: string[],
 *   conceptLabels: string[],
 *   cancelledConcepts: string[],
 *   impulses: { temperature: number, moisture: number, disturbance: number },
 *   directions: { temperature: number, moisture: number, disturbance: number },
 *   applied: boolean,
 *   explanation: string,
 *   unsupported: boolean,
 * }}
 */
export function parseEnvironmentalLanguage(text) {
  const raw = String(text ?? '').trim()
  const impulses = emptyImpulses()

  if (!raw) {
    return {
      text: raw,
      intent: 'uncertain',
      intentLabel: INTENT_LABELS.uncertain,
      concepts: [],
      conceptLabels: [],
      cancelledConcepts: [],
      impulses,
      directions: { ...impulses },
      applied: false,
      explanation: 'Empty input; no interpretation.',
      unsupported: true,
    }
  }

  const clauses = splitClauses(raw)
  /** @type {Map<string, { id: string, label: string, channel: string, sign: number, count: number }>} */
  const activeById = new Map()
  /** @type {Map<string, string>} */
  const cancelledById = new Map()

  for (const clause of clauses) {
    for (const hit of matchConceptsInText(clause)) {
      if (hit.negated) {
        if (!activeById.has(hit.id)) {
          cancelledById.set(hit.id, hit.label)
        }
        continue
      }
      cancelledById.delete(hit.id)
      // Stack repeated lexicon hits ("hot hot hot") and synonyms across clauses.
      const existing = activeById.get(hit.id)
      if (existing) {
        existing.count += hit.count
      } else {
        activeById.set(hit.id, {
          id: hit.id,
          label: hit.label,
          channel: hit.channel,
          sign: hit.sign,
          count: hit.count,
        })
      }
    }
  }

  const active = [...activeById.values()]
  const cancelled = [...cancelledById.entries()].map(([id, label]) => ({
    id,
    label,
  }))

  const { intent, reason } = classifyIntent(raw, active, [
    ...active,
    ...cancelled,
  ])
  const mayApply = intentAppliesEnvironment(intent)

  if (mayApply) {
    for (const hit of active) {
      const scale = stackedImpulseScale(hit.count)
      impulses[hit.channel] += CONCEPT_IMPULSE * hit.sign * scale
    }
  }

  const concepts = active.map((hit) => hit.id)
  const conceptLabels = active.map((hit) =>
    hit.count > 1 ? `${hit.label} ×${hit.count}` : hit.label,
  )
  const cancelledConcepts = cancelled.map((item) => item.id)
  const hasSignal = concepts.length > 0 || cancelledConcepts.length > 0
  const applied =
    mayApply &&
    (impulses.temperature !== 0 ||
      impulses.moisture !== 0 ||
      impulses.disturbance !== 0)

  const directions = {
    temperature: Math.sign(impulses.temperature),
    moisture: Math.sign(impulses.moisture),
    disturbance: Math.sign(impulses.disturbance),
  }

  return {
    text: raw,
    intent,
    intentLabel: INTENT_LABELS[intent],
    concepts,
    conceptLabels,
    cancelledConcepts,
    impulses,
    directions,
    applied,
    explanation: buildExplanation({
      intent,
      intentReason: reason,
      concepts: conceptLabels,
      cancelled: cancelled.map((item) => item.label),
      applied,
      impulses,
    }),
    unsupported: !applied && !hasSignal,
  }
}
