import { localInterpretation } from '../../../src/playground/languageAsEnvironment/localInterpretation.js'

/** Rule-based parser (offline, free, keyword-level understanding only). */
export default {
  id: 'local',
  needsKey: false,
  defaultModel: 'rules',
  async interpret({ text }) {
    return localInterpretation(text)
  },
}
