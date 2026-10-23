/**
 * Rule-based intent classification for Experiment 01 language input.
 * Prefer no impulse when uncertain. No LLM / network.
 */

/** @typedef {'environmental_description'|'environmental_request'|'question_to_organism'|'general_conversation'|'uncertain'} LanguageIntent */

export const INTENT_LABELS = Object.freeze({
  environmental_description: 'Environmental Description',
  environmental_request: 'Environmental Request',
  question_to_organism: 'Question to Organism',
  general_conversation: 'General Conversation',
  uncertain: 'Uncertain',
})

const ORGANISM_ADDRESS =
  /\b(you|your|yourself|yours|organism|creature|being)\b/i

const QUESTION_OPEN =
  /^(do|does|did|can|could|would|will|are|is|was|were|have|has|had|what|why|how|when|where|who|whom|which|should|may|might)\b/i

const REQUEST_VERB =
  /\b(make|set|create|add|give|bring|send|increase|decrease|raise|lower|turn|keep|let|put|please)\b/i

const ENV_FRAME =
  /\b(it'?s|it is|there is|there are|the (air|weather|sky|climate|wind|rain|storm|atmosphere)|weather|outside|environment|conditions?)\b/i

const APPROACHING =
  /\b(approaching|coming|arriving|forming|building|gathering)\b/i

const CONVERSATION =
  /\b(hope|wish|love|miss|hello|hi|hey|thanks|thank you|survive|alive|feel|feeling|sorry|please talk|listen to me|hear me)\b/i

const HEAR_SEE_NEED =
  /\b(hear|see|need|want|understand|know|remember|dream|think)\b/i

/**
 * @param {string} text
 * @param {{ id: string }[]} matchedConcepts  // non-negated env hits
 * @param {{ id: string }[]} allHits          // including negated
 */
export function classifyIntent(text, matchedConcepts = [], allHits = []) {
  const raw = String(text ?? '').trim()
  const lower = raw.toLowerCase()
  const hasQuestionMark = /\?/.test(raw)
  const opensAsQuestion = QUESTION_OPEN.test(lower)
  const addressesOrganism = ORGANISM_ADDRESS.test(lower)
  const hasEnvHits = matchedConcepts.length > 0 || allHits.length > 0
  const activeEnv = matchedConcepts.length > 0

  const isQuestion = hasQuestionMark || opensAsQuestion

  // Direct address questions → never drive the environment.
  if (isQuestion && addressesOrganism) {
    return {
      intent: 'question_to_organism',
      reason:
        'Addressed as a question to the organism; environmental words are not treated as commands.',
    }
  }

  // Other questions are not treated as environmental commands.
  if (isQuestion && !REQUEST_VERB.test(lower)) {
    return {
      intent: activeEnv || hasEnvHits ? 'uncertain' : 'general_conversation',
      reason:
        'Question form detected; preferring no environmental impulse.',
    }
  }

  // Conversational affect / survival talk without env framing.
  if (
    CONVERSATION.test(lower) &&
    addressesOrganism &&
    !ENV_FRAME.test(lower) &&
    !REQUEST_VERB.test(lower)
  ) {
    return {
      intent: 'general_conversation',
      reason: 'Conversational address; no environmental command detected.',
    }
  }

  // Explicit environmental requests / imperatives.
  if (REQUEST_VERB.test(lower) && activeEnv) {
    return {
      intent: 'environmental_request',
      reason: 'Imperative or request language with environmental concepts.',
    }
  }

  // Declarative environmental descriptions.
  if (activeEnv) {
    if (
      ENV_FRAME.test(lower) ||
      APPROACHING.test(lower) ||
      /\b(is|are|was|were|feels?|becomes?|getting|growing)\b/i.test(lower) ||
      // Compact weather phrases: "cold rainy storm", "storm rain"
      (matchedConcepts.length >= 1 &&
        !addressesOrganism &&
        !opensAsQuestion &&
        !hasQuestionMark)
    ) {
      return {
        intent: 'environmental_description',
        reason: 'Describes environmental conditions.',
      }
    }
  }

  // Env words present but only under negation / unclear framing.
  if (hasEnvHits && !activeEnv) {
    return {
      intent: 'environmental_description',
      reason:
        'Environmental wording found, but negation cancelled the active impulse.',
    }
  }

  if (hasEnvHits && addressesOrganism && !REQUEST_VERB.test(lower)) {
    return {
      intent: 'uncertain',
      reason:
        'Environmental words appear in organism-directed speech; impulse withheld.',
    }
  }

  if (!hasEnvHits && (CONVERSATION.test(lower) || addressesOrganism)) {
    return {
      intent: 'general_conversation',
      reason: 'No environmental concepts recognized.',
    }
  }

  if (!hasEnvHits) {
    return {
      intent: 'general_conversation',
      reason: 'No environmental concepts recognized.',
    }
  }

  return {
    intent: 'uncertain',
    reason: 'Interpretation unclear; preferring no environmental impulse.',
  }
}

export function intentAppliesEnvironment(intent) {
  return (
    intent === 'environmental_description' ||
    intent === 'environmental_request'
  )
}
