import test from 'node:test'
import assert from 'node:assert/strict'
import { createVoiceInput } from './voiceInput.js'

function harness() {
  const instances = [], finals = [], interims = [], states = [], errors = []
  class Recognition {
    constructor() { instances.push(this) }
    start() { this.started = true }
    stop() { this.stopped = true }
    abort() { this.aborted = true }
  }
  const controller = createVoiceInput({ Recognition, onFinal: text => finals.push(text), onInterim: text => interims.push(text), onState: state => states.push(state), onError: error => errors.push(error) })
  return { controller, instances, finals, interims, states, errors }
}
function result(transcript, isFinal) { return Object.assign([{ transcript }], { isFinal }) }

test('only finalized segments append to the answer, and finals are not duplicated', () => {
  const h = harness()
  h.controller.start('en-IN')
  const recognition = h.instances[0]
  assert.equal(recognition.lang, 'en-IN')
  assert.equal(recognition.continuous, true)
  recognition.onstart()
  recognition.onresult({ results: [result('I worked with', false)], resultIndex: 0 })
  assert.deepEqual(h.finals, [])
  assert.equal(h.interims.at(-1), 'I worked with')
  recognition.onresult({ results: [result('I worked with my team.', true)], resultIndex: 0 })
  recognition.onresult({ results: [result('I worked with my team.', true), result('We clarified', false)], resultIndex: 1 })
  assert.deepEqual(h.finals, ['I worked with my team.'])
  assert.equal(h.interims.at(-1), 'We clarified')
  h.controller.cancel()
})

test('stopping permits final results and then returns to idle', () => {
  const h = harness()
  h.controller.start()
  const recognition = h.instances[0]
  recognition.onstart()
  h.controller.stop()
  assert.equal(h.states.at(-1), 'stopping')
  recognition.onresult({ results: [result('A confirmed final answer.', true)], resultIndex: 0 })
  recognition.onend()
  assert.deepEqual(h.finals, ['A confirmed final answer.'])
  assert.equal(h.states.at(-1), 'idle')
  assert.equal(h.interims.at(-1), '')
})

test('cancel rejects late callbacks so another question never receives old speech', () => {
  const h = harness()
  h.controller.start()
  const recognition = h.instances[0]
  const lateResult = recognition.onresult
  h.controller.cancel()
  lateResult({ results: [result('Old question transcript.', true)], resultIndex: 0 })
  assert.deepEqual(h.finals, [])
  assert.equal(recognition.aborted, true)
  assert.equal(recognition.onresult, null)
  h.controller.start()
  h.instances[1].onresult({ results: [result('New question transcript.', true)], resultIndex: 0 })
  assert.deepEqual(h.finals, ['New question transcript.'])
  h.controller.cancel()
})

test('permission and network errors keep typing available and clean up recognition', () => {
  for (const error of ['not-allowed', 'network', 'audio-capture', 'no-speech']) {
    const h = harness()
    h.controller.start()
    h.instances[0].onerror({ error })
    assert.equal(h.states.at(-1), 'idle')
    assert.equal(h.errors.length, 1)
    assert.deepEqual(h.finals, [])
  }
})

test('unsupported browsers receive a typed-answer instruction without starting audio', () => {
  const errors = []
  const voice = createVoiceInput({ Recognition: null, onFinal() {}, onInterim() {}, onState() {}, onError: message => errors.push(message) })
  assert.equal(voice.supported, false)
  voice.start()
  assert.match(errors[0], /type your answer/)
})

test('start exceptions return to idle and do not leak raw device errors', () => {
  const states = [], errors = []
  class Recognition { start() { throw new Error('raw device detail') } abort() {} }
  const voice = createVoiceInput({ Recognition, onFinal() {}, onInterim() {}, onState: state => states.push(state), onError: message => errors.push(message) })
  voice.start()
  assert.equal(states.at(-1), 'idle')
  assert.equal(errors[0].includes('raw device detail'), false)
})
