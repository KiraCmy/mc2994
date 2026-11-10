import { localInterpretation } from '../../../src/playground/languageAsEnvironment/localInterpretation.js'

/**
 * Mock provider: deterministic, no network, no cost. Known test sentences
 * return fixed, hand-written interpretations (what a good model should say);
 * anything else falls back to the rule-based parser.
 */
export const MOCK_FIXTURES = Object.freeze({
  "it's raining.": { temperatureDelta: -0.15, moistureDelta: 0.8, turbulenceDelta: 0.1, intensity: 0.6, confidence: 0.95, durationSeconds: 40, emotionalTone: 'calm', semanticSummary: 'Rain falling: the water turns wetter and a little cooler.' },
  'i miss the summer rain.': { temperatureDelta: 0.45, moistureDelta: 0.6, turbulenceDelta: -0.1, intensity: 0.55, confidence: 0.8, durationSeconds: 45, emotionalTone: 'longing', semanticSummary: 'A longing for warm summer rain: warm, wet, gentle.' },
  "i don't want you to disappear.": { temperatureDelta: 0.15, moistureDelta: 0.05, turbulenceDelta: 0.3, intensity: 0.5, confidence: 0.6, durationSeconds: 35, emotionalTone: 'fear', semanticSummary: 'Fear of loss stirs the water; a faint warmth of care.' },
  "i remember my grandmother's kitchen.": { temperatureDelta: 0.45, moistureDelta: 0.15, turbulenceDelta: -0.25, intensity: 0.45, confidence: 0.7, durationSeconds: 50, emotionalTone: 'tender', semanticSummary: 'A warm, steamy, calm memory of home.' },
  'hello.': { temperatureDelta: 0, moistureDelta: 0, turbulenceDelta: 0, intensity: 0.05, confidence: 0.9, durationSeconds: 10, emotionalTone: 'neutral', semanticSummary: 'A greeting; no environmental meaning.' },
  'everything feels quiet today.': { temperatureDelta: 0, moistureDelta: 0, turbulenceDelta: -0.55, intensity: 0.4, confidence: 0.8, durationSeconds: 45, emotionalTone: 'calm', semanticSummary: 'Quiet: the water stills.' },
  '今天我想起了小时候的一个下午。': { temperatureDelta: 0.3, moistureDelta: 0, turbulenceDelta: -0.3, intensity: 0.35, confidence: 0.6, durationSeconds: 45, emotionalTone: 'longing', semanticSummary: 'A remembered childhood afternoon: mild warmth and stillness.' },
})

export function mockKey(text) {
  return String(text ?? '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ')
}

export default {
  id: 'mock',
  needsKey: false,
  defaultModel: 'fixtures',
  async interpret({ text }) {
    return MOCK_FIXTURES[mockKey(text)] ?? localInterpretation(text)
  },
}
