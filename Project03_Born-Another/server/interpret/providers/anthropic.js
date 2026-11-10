import { INTERPRETATION_JSON_SCHEMA } from '../schema.js'
import { SYSTEM_PROMPT, userPrompt } from '../prompt.js'
import { postJson } from './http.js'

const TOOL = 'report_environment_interpretation'

/** Anthropic Messages API; the schema is enforced as a forced tool call. */
export default {
  id: 'anthropic',
  needsKey: true,
  keyEnv: 'ANTHROPIC_API_KEY',
  defaultModel: 'claude-haiku-5-5',
  async interpret({ text, model, apiKey, signal, fetchImpl, options = {} }) {
    const data = await postJson(fetchImpl, `${options.baseUrl ?? 'https://api.anthropic.com/v1'}/messages`, {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: {
        model,
        max_tokens: options.maxOutputTokens ?? 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt(text) }],
        tools: [{ name: TOOL, description: 'Report how the words affect the water.', input_schema: INTERPRETATION_JSON_SCHEMA }],
        tool_choice: { type: 'tool', name: TOOL },
      },
      signal,
    })
    const call = (data.content ?? []).find((c) => c.type === 'tool_use' && c.name === TOOL)
    if (!call) throw new Error(`no tool call (stop_reason ${data.stop_reason ?? 'unknown'})`)
    return call.input
  },
}
