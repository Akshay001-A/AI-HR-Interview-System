import { useEffect, useRef, useState } from 'react'
import { createVoiceInput } from './voiceInput'

export function useVoiceAnswer({ active, draftRef, setDraft, onPause, editAnswer }) {
  const [state, setState] = useState('idle')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const controller = useRef(null)
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const supported = Boolean(Recognition)

  function cancel() {
    controller.current?.cancel()
    controller.current = null
  }

  function start(language) {
    const draft = draftRef.current
    if (!active || draft?.status !== 'running') return
    cancel()
    setError('')
    const sessionId = draft.session_id
    const questionId = draft.questions[draft.current_index].question_id
    controller.current = createVoiceInput({
      Recognition,
      onFinal: transcript => {
        const snapshot = draftRef.current
        if (snapshot?.session_id === sessionId && snapshot.answers[questionId]
          && snapshot.answers[questionId].text.length + transcript.length + 1 > 20000) {
          setError('The answer reached its 20,000-character limit. Stop the microphone and review the text.')
          return
        }
        setDraft(current => {
        if (current?.session_id !== sessionId || current.status !== 'running' || current.questions[current.current_index].question_id !== questionId) return current
        const existing = current.answers[questionId].text
        const combined = [existing.trimEnd(), transcript].filter(Boolean).join(' ')
        if (combined.length > 20000) return current
        return editAnswer(current, questionId, combined, 'voice')
        })
      },
      onInterim: setInterim, onState: setState, onError: setError,
    })
    controller.current.start(language)
  }

  useEffect(() => {
    if (!active) { controller.current?.cancel(); onPause() }
  }, [active, onPause])

  useEffect(() => {
    const hidden = () => { if (document.hidden) { controller.current?.cancel(); onPause() } }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      controller.current?.cancel()
    }
  }, [onPause])

  return { state, interim, error, supported, start, stop: () => controller.current?.stop(), cancel, clearError: () => setError('') }
}
