import { INTERPRETATION_JSON_SCHEMA } from '../schema.js'
import { SYSTEM_PROMPT, userPrompt } from '../prompt.js'
import { parseJsonText, postJson } from './http.js'

/** OpenAI Responses API with a strict JSON-schema output. */
export default {
  id: 'openai',
  needsKey: true,
  keyEnv: 'OPENAI_API_KEY',
  defaultModel: 'gpt-5.4-mini',
  async interpret({ text, model, apiKey, signal, fetchImpl, options = {} }) {
    const body = {
      model,
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(text) },
      ],
      text: {
        format: { type: 'json_schema', name: 'environment_interpretation', strict: true, schema: INTERPRETATION_JSON_SCHEMA },
      },
      max_output_tokens: options.maxOutputTokens ?? 2000,
    }
    if (options.reasoningEffort) body.reasoning = { effort: options.reasoningEffort }
    const data = await postJson(fetchImpl, `${options.baseUrl ?? 'https://api.openai.com/v1'}/responses`, {
      headers: { authorization: `Bearer ${apiKey}` },
      body,
      signal,
    })
    if (typeof data.output_text === 'string') return parseJsonText(data.output_text)
    for (const item of data.output ?? []) {
      for (const part of item.content ?? []) {
        if (part.type === 'refusal') throw new Error(`refused: ${part.refusal ?? ''}`)
        if (part.type === 'output_text') return parseJsonText(part.text)
      }
    }
    throw new Error(`no output text (status ${data.status ?? 'unknown'})`)
  },
}
