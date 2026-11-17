/**
 * One spoken utterance for "Tell it something".
 * Uses the browser Speech Recognition API (Chrome, Edge, Safari).
 * The audio stays with the browser's speech service; this module only
 * returns the transcript.
 */

export function transcriptFromResults(results) {
  if (!results) return { text: '', final: false }
  let finalText = ''
  let interim = ''
  const count = results.length ?? 0
  for (let i = 0; i < count; i += 1) {
    const result = results[i]
    const text = result?.[0]?.transcript ?? ''
    if (result?.isFinal) finalText += text
    else interim += text
  }
  const text = `${finalText}${interim}`.replace(/\s+/g, ' ').trim()
  return { text, final: interim.length === 0 && finalText.length > 0 }
}

export function speechRecognitionCtor(root = globalThis) {
  if (!root) return null
  return root.SpeechRecognition || root.webkitSpeechRecognition || null
}

export function speechErrorText(code) {
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return 'The microphone is blocked. Allow it for this page, or type instead.'
  }
  if (code === 'audio-capture') return 'No microphone was found. Type instead.'
  if (code === 'network') return 'Speech could not be heard just now. Try again, or type.'
  if (code === 'language-not-supported') return 'This browser cannot hear that language. Type instead.'
  return ''
}

/**
 * Wrap one recognition object. `onEnd` receives the utterance, or '' when
 * the listener cancelled or nothing was heard. `onError` skips the quiet
 * cases (abort, silence).
 */
export function createSpeechSession(recognition, { onUpdate, onEnd, onError } = {}) {
  let cancelled = false
  let latest = ''
  let settled = false
  const finish = (text) => {
    if (settled) return
    settled = true
    onEnd?.(cancelled ? '' : text)
  }

  recognition.interimResults = true
  recognition.continuous = false
  if (!recognition.lang && typeof navigator !== 'undefined' && navigator.language) {
    recognition.lang = navigator.language
  }

  recognition.onresult = (event) => {
    const heard = transcriptFromResults(event?.results)
    latest = heard.text
    onUpdate?.(heard.text, heard.final)
  }
  recognition.onerror = (event) => {
    const code = event?.error ?? ''
    if (code === 'aborted' || code === 'no-speech') return
    onError?.(code)
  }
  recognition.onend = () => finish(latest)

  return {
    start() {
      recognition.start()
    },
    /** End the utterance and keep what was heard. */
    stop() {
      try {
        recognition.stop()
      } catch {
        finish(latest)
      }
    },
    /** Drop the utterance. */
    cancel() {
      cancelled = true
      try {
        recognition.abort()
      } catch {
        finish('')
      }
    },
  }
}

/** Open one utterance against the browser, or null when speech is unavailable. */
export function openSpeechSession(handlers, root = globalThis) {
  const Ctor = speechRecognitionCtor(root)
  if (!Ctor) return null
  return createSpeechSession(new Ctor(), handlers)
}
