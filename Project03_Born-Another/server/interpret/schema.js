/**
 * The one shape every interpreter returns, whatever the provider.
 * Pure and browser-safe: the client imports it too (to re-validate).
 *
 * The model only describes the *environment* a sentence evokes. It never
 * touches geometry, crystallization, AGE, death or lifespan; how much the
 * world actually moves is decided later, by application rules
 * (src/playground/languageAsEnvironment/languageInfluence.js).
 */

export const EMOTIONAL_TONES = Object.freeze([
  'neutral',
  'calm',
  'tender',
  'longing',
  'grief',
  'joy',
  'fear',
  'anger',
  'other',
])

export const DURATION_RANGE = Object.freeze({ min: 15, max: 90, neutral: 30 })
export const SUMMARY_MAX = 160

const FIELD_DOCS = {
  temperatureDelta: 'Warmth the words evoke: -1 very cold … 0 none … 1 very warm.',
  moistureDelta: 'Wetness the words evoke: -1 very dry … 0 none … 1 very wet.',
  turbulenceDelta: 'Disturbance the words evoke: -1 very calm/still … 0 none … 1 very stormy/agitated.',
  intensity: 'How strongly the words carry that imagery or feeling: 0 none … 1 overwhelming.',
  confidence: 'How sure you are of this reading: 0 guess … 1 certain.',
  durationSeconds: `How long the influence should linger, ${DURATION_RANGE.min}–${DURATION_RANGE.max} seconds.`,
  emotionalTone: 'The dominant emotional tone.',
  semanticSummary: `One short sentence (under ${SUMMARY_MAX} characters, in English) of what the words evoke for the water.`,
}

/** JSON Schema (draft 2020-12 subset accepted by OpenAI strict mode and Anthropic tools). */
export const INTERPRETATION_JSON_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(FIELD_DOCS),
  properties: {
    temperatureDelta: { type: 'number', description: FIELD_DOCS.temperatureDelta },
    moistureDelta: { type: 'number', description: FIELD_DOCS.moistureDelta },
    turbulenceDelta: { type: 'number', description: FIELD_DOCS.turbulenceDelta },
    intensity: { type: 'number', description: FIELD_DOCS.intensity },
    confidence: { type: 'number', description: FIELD_DOCS.confidence },
    durationSeconds: { type: 'number', description: FIELD_DOCS.durationSeconds },
    emotionalTone: { type: 'string', enum: [...EMOTIONAL_TONES], description: FIELD_DOCS.emotionalTone },
    semanticSummary: { type: 'string', description: FIELD_DOCS.semanticSummary },
  },
})

/** The same schema in Gemini's OpenAPI-style dialect. */
export const INTERPRETATION_GEMINI_SCHEMA = Object.freeze({
  type: 'OBJECT',
  required: Object.keys(FIELD_DOCS),
  propertyOrdering: Object.keys(FIELD_DOCS),
  properties: {
    temperatureDelta: { type: 'NUMBER', description: FIELD_DOCS.temperatureDelta },
    moistureDelta: { type: 'NUMBER', description: FIELD_DOCS.moistureDelta },
    turbulenceDelta: { type: 'NUMBER', description: FIELD_DOCS.turbulenceDelta },
    intensity: { type: 'NUMBER', description: FIELD_DOCS.intensity },
    confidence: { type: 'NUMBER', description: FIELD_DOCS.confidence },
    durationSeconds: { type: 'NUMBER', description: FIELD_DOCS.durationSeconds },
    emotionalTone: { type: 'STRING', enum: [...EMOTIONAL_TONES], description: FIELD_DOCS.emotionalTone },
    semanticSummary: { type: 'STRING', description: FIELD_DOCS.semanticSummary },
  },
})

export function neutralInterpretation(summary = 'No clear environmental meaning.') {
  return {
    temperatureDelta: 0,
    moistureDelta: 0,
    turbulenceDelta: 0,
    intensity: 0,
    confidence: 1,
    durationSeconds: DURATION_RANGE.neutral,
    emotionalTone: 'neutral',
    semanticSummary: summary,
  }
}

function num(value, min, max, fallback) {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/**
 * Validates and clamps anything a provider returned into the schema.
 * Throws if it is not an object at all (the caller then falls back).
 */
export function normalizeInterpretation(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('interpretation is not an object')
  const tone = String(raw.emotionalTone ?? '').toLowerCase()
  const summary = String(raw.semanticSummary ?? '').replace(/\s+/g, ' ').trim().slice(0, SUMMARY_MAX)
  return {
    temperatureDelta: round(num(raw.temperatureDelta, -1, 1, 0)),
    moistureDelta: round(num(raw.moistureDelta, -1, 1, 0)),
    turbulenceDelta: round(num(raw.turbulenceDelta, -1, 1, 0)),
    intensity: round(num(raw.intensity, 0, 1, 0)),
    confidence: round(num(raw.confidence, 0, 1, 0.5)),
    durationSeconds: Math.round(num(raw.durationSeconds, DURATION_RANGE.min, DURATION_RANGE.max, DURATION_RANGE.neutral)),
    emotionalTone: EMOTIONAL_TONES.includes(tone) ? tone : 'other',
    semanticSummary: summary || 'No summary.',
  }
}

function round(v) {
  return Math.round(v * 1000) / 1000
}
