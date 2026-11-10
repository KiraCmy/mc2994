/**
 * Offline interpreter: the existing rule-based parser (parseEnvironmentalLanguage)
 * mapped onto the shared interpretation schema. Used by the server's `local`
 * provider, by `mock` for unknown sentences, and by the browser when the
 * interpret API cannot be reached.
 */
import { parseEnvironmentalLanguage } from './parseEnvironmentalLanguage.js'
import { neutralInterpretation, normalizeInterpretation } from '../../../server/interpret/schema.js'

/** One concept hit gives an impulse of ~0.14; two stacked hits ≈ a full-scale delta. */
const IMPULSE_FULL_SCALE = 0.28

export function localInterpretation(text) {
  const parsed = parseEnvironmentalLanguage(text)
  if (!parsed.applied) return neutralInterpretation(parsed.explanation || 'No clear environmental meaning.')
  const imp = parsed.impulses ?? {}
  const t = clampUnit((imp.temperature ?? 0) / IMPULSE_FULL_SCALE)
  const m = clampUnit((imp.moisture ?? 0) / IMPULSE_FULL_SCALE)
  const u = clampUnit((imp.disturbance ?? 0) / IMPULSE_FULL_SCALE)
  const peak = Math.max(Math.abs(t), Math.abs(m), Math.abs(u))
  const labels = (parsed.conceptLabels ?? []).slice(0, 3).join(', ')
  return normalizeInterpretation({
    temperatureDelta: t,
    moistureDelta: m,
    turbulenceDelta: u,
    intensity: 0.35 + 0.45 * peak,
    confidence: 0.6,
    durationSeconds: 30,
    emotionalTone: u > 0.3 ? 'fear' : 'calm',
    semanticSummary: labels ? `Recognized ${labels}.` : 'Recognized environmental words.',
  })
}

function clampUnit(v) {
  return Math.max(-1, Math.min(1, Number(v) || 0))
}
