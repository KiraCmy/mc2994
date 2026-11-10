import anthropic from './anthropic.js'
import gemini from './gemini.js'
import local from './local.js'
import mock from './mock.js'
import openai from './openai.js'

/** Every interpreter the server knows. Add a provider here (same interface). */
export const PROVIDERS = Object.freeze({ openai, anthropic, gemini, mock, local })
