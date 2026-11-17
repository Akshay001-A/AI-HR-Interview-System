import { useCallback, useEffect, useRef, useState } from 'react'
import { DRAFT_KEY, parseDraft, pauseSession, serializeDraft } from './interviewSession'

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return { draft: null, error: '', raw: '' }
    try { return { draft: parseDraft(raw), error: '', raw: '' } }
    catch { return { draft: null, error: 'A saved recovery draft could not be read. It has not been overwritten. You can download it before starting a new interview.', raw } }
  } catch {
    return { draft: null, error: 'Browser recovery storage is unavailable. You can practise in memory and download a backup.', raw: '' }
  }
}

export function useInterviewDraft() {
  const [loaded] = useState(loadDraft)
  const [draft, setDraft] = useState(loaded.draft)
  const [recoveryError, setRecoveryError] = useState(loaded.error)
  const [unreadable, setUnreadable] = useState(loaded.raw)
  const [saveState, setSaveState] = useState(loaded.draft ? 'recovered' : 'idle')
  const [savedAt, setSavedAt] = useState(null)
  const ref = useRef(draft)
  ref.current = draft

  const flush = useCallback(value => {
    const current = value ?? ref.current
    if (!current) return
    if (!current.persist) { setSaveState('off'); return }
    try {
      localStorage.setItem(DRAFT_KEY, serializeDraft(current))
      setSaveState('saved')
      setSavedAt(Date.now())
    } catch {
      setSaveState('error')
      setRecoveryError('Your draft could not be saved to this browser. Your in-memory answers are safe; download a draft backup before leaving.')
    }
  }, [])

  useEffect(() => {
    if (!draft) return
    if (!draft.persist) { setSaveState('off'); return }
    setSaveState('saving')
    const timer = setTimeout(() => flush(draft), 350)
    return () => clearTimeout(timer)
  }, [draft, flush])

  useEffect(() => {
    const timer = setInterval(() => {
      if (ref.current?.status === 'running') flush()
    }, 5000)
    const leave = () => flush()
    window.addEventListener('pagehide', leave)
    window.addEventListener('beforeunload', leave)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('beforeunload', leave)
    }
  }, [flush])

  function install(value) {
    if (!value.persist) {
      try { localStorage.removeItem(DRAFT_KEY) }
      catch { setRecoveryError('An older browser draft could not be cleared. Recovery is off for this interview.') }
    } else setRecoveryError('')
    setUnreadable('')
    ref.current = value
    setDraft(value)
    flush(value)
  }

  function clear() {
    try { localStorage.removeItem(DRAFT_KEY) }
    catch { setRecoveryError('The browser would not clear its saved draft. Please use your browser storage controls.'); return }
    ref.current = null
    setDraft(null)
    setRecoveryError('')
    setUnreadable('')
    setSaveState('idle')
    setSavedAt(null)
  }

  const pause = useCallback(() => {
    const current = ref.current
    const next = pauseSession(current)
    if (next !== current) {
      ref.current = next
      setDraft(next)
      flush(next)
    }
  }, [flush])

  return { draft, setDraft, ref, install, clear, pause, flush, saveState, savedAt, recoveryError, unreadable }
}
