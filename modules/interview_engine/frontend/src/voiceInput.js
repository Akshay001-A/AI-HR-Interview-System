// Browser speech adapter, injectable for tests; it never records or uploads audio itself.
const messages = {
  'not-allowed': 'Microphone permission was denied. Allow it in your browser or type your answer.',
  'service-not-allowed': 'Your browser does not allow its speech service here. You can type your answer.',
  'audio-capture': 'No usable microphone was found. Check your device or type your answer.',
  network: 'The browser speech service could not connect. Your existing answer is safe; you can type instead.',
  'no-speech': 'No speech was detected. Try again or type your answer.',
  'language-not-supported': 'This speech language is unavailable. Choose another language or type your answer.',
}

export function createVoiceInput({ Recognition, onFinal, onInterim, onState, onError }) {
  let recognition = null
  let generation = 0
  let stoppingTimer = null
  function cancel() {
    generation += 1
    clearTimeout(stoppingTimer)
    const previous = recognition
    recognition = null
    if (previous) {
      previous.onresult = previous.onerror = previous.onend = previous.onstart = null
      try { previous.abort() } catch { /* Already stopped. */ }
    }
    onInterim('')
    onState('idle')
  }
  return {
    supported: Boolean(Recognition),
    start(language = 'en-US') {
      if (!Recognition) { onError('Speech recognition is unavailable in this browser. You can type your answer.'); return }
      if (recognition) return
      const token = ++generation
      const current = new Recognition()
      const committed = new Set()
      recognition = current
      current.lang = language
      current.continuous = true
      current.interimResults = true
      current.maxAlternatives = 1
      onState('starting')
      current.onstart = () => { if (generation === token) onState('listening') }
      current.onresult = event => {
        if (generation !== token) return
        const interim = []
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index]
          const transcript = result[0]?.transcript?.trim() || ''
          if (result.isFinal && !committed.has(index)) {
            committed.add(index)
            if (transcript) onFinal(transcript)
          } else if (!result.isFinal && transcript) interim.push(transcript)
        }
        onInterim(interim.join(' '))
      }
      current.onerror = event => {
        if (generation !== token) return
        if (event.error !== 'aborted') onError(messages[event.error] || 'Voice transcription stopped. Your existing answer is safe; you can type instead.')
        cancel()
      }
      current.onend = () => {
        if (generation !== token) return
        clearTimeout(stoppingTimer)
        recognition = null
        onInterim('')
        onState('idle')
      }
      try { current.start() } catch {
        cancel()
        onError('The microphone could not start. Check browser permissions or type your answer.')
      }
    },
    stop() {
      if (!recognition) return
      onState('stopping')
      try {
        // Some browser services fail to deliver onend. Discard unconfirmed text.
        stoppingTimer = setTimeout(cancel, 2500)
        recognition.stop()
      } catch { cancel() }
    },
    cancel,
  }
}
