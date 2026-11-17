import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSpeechSession, speechErrorText, speechRecognitionCtor, transcriptFromResults } from './speechInput.js'

test('a result list joins final words and any still-forming words', () => {
  const heard = transcriptFromResults([
    { isFinal: true, 0: { transcript: 'the water ' } },
    { isFinal: false, 0: { transcript: 'is cold' } },
  ])
  assert.equal(heard.text, 'the water is cold')
  assert.equal(heard.final, false)
})

test('only final results count as a finished utterance', () => {
  const heard = transcriptFromResults([{ isFinal: true, 0: { transcript: '  a quiet tide  ' } }])
  assert.deepEqual(heard, { text: 'a quiet tide', final: true })
  assert.deepEqual(transcriptFromResults(null), { text: '', final: false })
})

test('missing speech APIs report as unavailable', () => {
  assert.equal(speechRecognitionCtor({}), null)
  assert.equal(speechRecognitionCtor({ webkitSpeechRecognition: function Webkit() {} }).name, 'Webkit')
})

test('a stopped session ends with the latest transcript', () => {
  const rec = fakeRecognition()
  const ends = []
  const updates = []
  const session = createSpeechSession(rec, {
    onUpdate: (text) => updates.push(text),
    onEnd: (text) => ends.push(text),
  })
  session.start()
  rec.onresult({ results: [{ isFinal: false, 0: { transcript: 'warm' } }] })
  rec.onresult({ results: [{ isFinal: true, 0: { transcript: 'warm rain' } }] })
  session.stop()
  assert.deepEqual(updates, ['warm', 'warm rain'])
  assert.deepEqual(ends, ['warm rain'])
  assert.equal(rec.interimResults, true)
  assert.equal(rec.continuous, false)
})

test('cancelling drops whatever was heard', () => {
  const rec = fakeRecognition()
  const ends = []
  const session = createSpeechSession(rec, { onEnd: (text) => ends.push(text) })
  rec.onresult({ results: [{ isFinal: false, 0: { transcript: 'wait' } }] })
  session.cancel()
  assert.deepEqual(ends, [''])
})

test('silence and abort stay quiet; a blocked microphone is explained', () => {
  assert.equal(speechErrorText('no-speech'), '')
  assert.equal(speechErrorText('not-allowed'), 'The microphone is blocked. Allow it for this page, or type instead.')
  const errors = []
  const rec = fakeRecognition()
  createSpeechSession(rec, { onError: (code) => errors.push(code), onEnd: () => {} })
  rec.onerror({ error: 'no-speech' })
  rec.onerror({ error: 'not-allowed' })
  assert.deepEqual(errors, ['not-allowed'])
})

function fakeRecognition() {
  return {
    lang: '',
    start() {},
    stop() {
      this.onend?.()
    },
    abort() {
      this.onerror?.({ error: 'aborted' })
      this.onend?.()
    },
  }
}
