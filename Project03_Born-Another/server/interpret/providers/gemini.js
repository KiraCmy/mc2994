import { INTERPRETATION_GEMINI_SCHEMA } from '../schema.js'
import { SYSTEM_PROMPT, userPrompt } from '../prompt.js'
import { parseJsonText, postJson } from './http.js'

/** Gemini generateContent with a response schema (JSON mode). */
export default {
  id: 'gemini',
  needsKey: true,
  keyEnv: 'GEMINI_API_KEY',
  defaultModel: 'gemini-3.5-flash-lite',
  async interpret({ text, model, apiKey, signal, fetchImpl, options = {} }) {
    const base = options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta'
    const data = await postJson(fetchImpl, `${base}/models/${encodeURIComponent(model)}:generateContent`, {
      headers: { 'x-goog-api-key': apiKey },
      body: {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt(text) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: INTERPRETATION_GEMINI_SCHEMA,
          maxOutputTokens: options.maxOutputTokens ?? 1200,
        },
      },
      signal,
    })
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const textPart = parts.map((p) => p.text ?? '').join('')
    if (!textPart) throw new Error(`no output (finishReason ${data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? 'unknown'})`)
    return parseJsonText(textPart)
  },
}
