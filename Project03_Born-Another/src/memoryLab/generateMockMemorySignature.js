/**
 * Mock Memory Signature — local, deterministic, replaceable by an AI service later.
 * Values are experimental parameters (0–1), not objective emotion scores.
 */

export const DEFAULT_MEMORY_TEXT =
  'I remember the last summer before I left home. Every evening I walked along the same street.'

/** Fixed signature for the default summer memory (Step 01 brief). */
export const DEFAULT_MEMORY_SIGNATURE = Object.freeze({
  repetition: 0.85,
  transition: 0.7,
  duration: 0.65,
  intensity: 0.4,
  uncertainty: 0.3,
})

const FALLBACK_SIGNATURE = Object.freeze({
  repetition: 0.45,
  transition: 0.45,
  duration: 0.5,
  intensity: 0.45,
  uncertainty: 0.5,
})

/** Keyword heuristics → feature nudges. Same text → same signature. */
const KEYWORD_RULES = [
  {
    pattern: /\b(every|always|same|again|routine|habit|daily|repeated|walked)\b/i,
    bump: { repetition: 0.22 },
  },
  {
    pattern: /\b(left|leaving|before|after|change|moved|goodbye|depart)\b/i,
    bump: { transition: 0.2 },
  },
  {
    pattern: /\b(summer|winter|year|years|long|months|season|evening)\b/i,
    bump: { duration: 0.18 },
  },
  {
    pattern: /\b(loud|bright|sharp|intense|fire|crash|scream|hurt)\b/i,
    bump: { intensity: 0.25 },
  },
  {
    pattern: /\b(soft|quiet|gentle|calm|faint|whisper)\b/i,
    bump: { intensity: -0.15 },
  },
  {
    pattern: /\b(maybe|perhaps|unclear|forgot|fog|uncertain|almost|seemed)\b/i,
    bump: { uncertainty: 0.22 },
  },
  {
    pattern: /\b(home|street|room|house|city|school)\b/i,
    bump: { repetition: 0.08, duration: 0.06 },
  },
]

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function normalizeMemoryText(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/\s+/g, ' ')
}

function isDefaultMemory(text) {
  return normalizeMemoryText(text) === normalizeMemoryText(DEFAULT_MEMORY_TEXT)
}

/**
 * @param {string} text
 * @returns {{ repetition: number, transition: number, duration: number, intensity: number, uncertainty: number }}
 */
export function generateMockMemorySignature(text) {
  const normalized = normalizeMemoryText(text)
  if (!normalized) {
    return { ...FALLBACK_SIGNATURE }
  }
  if (isDefaultMemory(normalized)) {
    return { ...DEFAULT_MEMORY_SIGNATURE }
  }

  const next = { ...FALLBACK_SIGNATURE }
  for (const rule of KEYWORD_RULES) {
    if (!rule.pattern.test(normalized)) continue
    for (const [key, delta] of Object.entries(rule.bump)) {
      next[key] = clamp01(next[key] + delta)
    }
  }

  // Length softens duration / uncertainty slightly so short vs long notes differ.
  const lengthFactor = clamp01(normalized.length / 280)
  next.duration = clamp01(next.duration + (lengthFactor - 0.5) * 0.12)
  next.uncertainty = clamp01(next.uncertainty + (0.5 - lengthFactor) * 0.08)

  return {
    repetition: clamp01(next.repetition),
    transition: clamp01(next.transition),
    duration: clamp01(next.duration),
    intensity: clamp01(next.intensity),
    uncertainty: clamp01(next.uncertainty),
  }
}

export { normalizeMemoryText }
