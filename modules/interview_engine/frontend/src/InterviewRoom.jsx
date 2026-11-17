import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, CheckCircle2, CircleHelp, Clock3, FileText, Flag, LoaderCircle, MessageSquarePlus, Mic, MicOff, Pause, Play, RotateCcw, ShieldCheck, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { api, errorMessage } from './api'
import { addFollowup, checkpoint, completionRequest, editAnswer, elapsedMilliseconds, formatTime, hasFollowup, MAX_DRAFT_BYTES, MAX_FOLLOWUPS, navigateQuestion, newSession, parseDraft, pauseSession, removeFollowup, resumeSession, reviewSession, serializeDraft, validatePlan } from './interviewSession'
import { useInterviewDraft } from './useInterviewDraft'
import { useVoiceAnswer } from './useVoiceAnswer'
import './interview-room.css'

function download(value, filename) {
  const url = URL.createObjectURL(new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ConfirmAction({ title, description, action, onConfirm, onCancel }) {
  const cancelRef = useRef(null)
  const dialogRef = useRef(null)
  useEffect(() => { cancelRef.current?.focus() }, [])
  return <div className="room-modal-backdrop" onKeyDown={event => {
    if (event.key === 'Escape') onCancel()
    if (event.key === 'Tab') {
      const buttons = [...dialogRef.current.querySelectorAll('button')]
      const first = buttons[0], last = buttons.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
  }}><section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="room-confirm-title" aria-describedby="room-confirm-description" className="room-confirm"><h2 id="room-confirm-title">{title}</h2><p id="room-confirm-description">{description}</p><div><button ref={cancelRef} className="button button-outline" onClick={onCancel}>Keep current work</button><button className="button room-danger" onClick={onConfirm}>{action}</button></div></section></div>
}

export default function InterviewRoom({ active, launchPlan, onLaunchConsumed, onGenerate, onComplete, onSummary }) {
  const store = useInterviewDraft()
  const { draft, setDraft, ref: draftRef, pause, flush } = store
  const [candidate, setCandidate] = useState(null)
  const [persist, setPersist] = useState(true)
  const [language, setLanguage] = useState('en-IN')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const [now, setNow] = useState(Date.now())
  const network = useRef(null)
  const voice = useVoiceAnswer({ active, draftRef, setDraft, onPause: pause, editAnswer })
  const voiceBusy = voice.state !== 'idle'
  const question = draft?.questions[draft.current_index]
  const answer = question ? draft.answers[question.question_id] : null
  const answered = draft ? draft.questions.filter(item => draft.answers[item.question_id].text.trim()).length : 0
  const primaryCount = draft?.plan.settings.question_count || 0
  const followups = draft?.questions.filter(item => item.parent_question_id) || []
  const locked = draft && question ? hasFollowup(draft, question.question_id) : false

  useEffect(() => {
    if (launchPlan) {
      pause()
      const start = () => {
        voice.cancel()
        network.current?.abort()
        store.install(newSession(launchPlan.plan, { persist: launchPlan.persist }))
        setNow(Date.now())
        setCandidate(null)
        setConfirmation(null)
      }
      setError('')
      if (draftRef.current || store.unreadable) {
        setConfirmation({ title: 'Start a new interview?', description: 'This replaces the saved interview on this browser. Cancel and download a backup first if you want to keep it.', action: 'Replace and start', run: start })
      } else start()
      onLaunchConsumed()
    }
  }, [launchPlan, onLaunchConsumed, pause])

  useEffect(() => {
    if (!active) {
      network.current?.abort()
      setBusy('')
      voice.cancel()
      pause()
    }
  }, [active, pause])

  useEffect(() => {
    if (!active || draft?.status !== 'running') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active, draft?.status])

  useEffect(() => {
    onSummary?.({ exists: Boolean(draft), status: draft?.status, answered, total: draft?.questions.length || 0, recoveryError: Boolean(store.recoveryError) })
  }, [draft?.session_id, draft?.status, answered, draft?.questions.length, store.recoveryError, onSummary])

  useEffect(() => () => network.current?.abort(), [])

  function installCandidate() {
    voice.cancel()
    network.current?.abort()
    try {
      const value = candidate.draft
        ? { ...candidate.draft, persist, status: candidate.draft.status === 'completed' ? 'completed' : 'paused', active_since: null }
        : newSession(candidate.plan, { persist })
      store.install(value)
      setNow(Date.now())
      setCandidate(null)
      setConfirmation(null)
      setError('')
    } catch (failure) { setError(failure.message) }
  }

  async function importFile(file) {
    if (!file || file.size > MAX_DRAFT_BYTES || !file.name.toLowerCase().endsWith('.json')) { setError('Choose a question-plan or draft JSON file no larger than 2 MB.'); return }
    voice.cancel()
    pause()
    setBusy('import')
    setError('')
    const controller = new AbortController()
    network.current = controller
    try {
      const json = await file.text()
      const parsed = JSON.parse(json)
      const recovered = parsed.draft_version === 1 ? parseDraft(json) : null
      const plan = validatePlan(recovered ? recovered.plan : parsed)
      const { data } = recovered
        ? await api.post('/interview/draft/validate', { plan, followups: recovered.questions.filter(question => question.parent_question_id) }, { signal: controller.signal })
        : await api.post('/interview/plan/validate', plan, { signal: controller.signal })
      setCandidate(recovered ? { plan: data, draft: { ...recovered, plan: data } } : { plan: data })
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.response ? errorMessage(failure) : failure.message || 'This JSON could not be read.')
    } finally { if (!controller.signal.aborted) setBusy('') }
  }

  async function askFollowup() {
    const current = draftRef.current
    if (!current || voiceBusy || busy) return
    const parent = current.questions[current.current_index]
    const submitted = current.answers[parent.question_id].text.trim()
    const snapshot = pauseSession(current)
    setDraft(snapshot)
    flush(snapshot)
    setError('')
    setBusy('followup')
    const controller = new AbortController()
    network.current = controller
    try {
      const { data } = await api.post('/interview/followup', {
        plan: snapshot.plan, question_id: parent.question_id, answer: submitted,
        followups: snapshot.questions.filter(item => item.parent_question_id),
      }, { timeout: 110000, signal: controller.signal })
      if (controller.signal.aborted) return
      setDraft(latest => {
        if (latest?.session_id !== snapshot.session_id || latest.answers[parent.question_id].text.trim() !== submitted) return latest
        return addFollowup(latest, data.followup)
      })
    } catch (failure) { if (!controller.signal.aborted) setError(errorMessage(failure)) }
    finally { if (!controller.signal.aborted) setBusy('') }
  }

  async function finish() {
    if (voiceBusy || busy) return
    setError('')
    const snapshot = reviewSession(draftRef.current)
    setDraft(snapshot)
    flush(snapshot)
    let body
    try { body = completionRequest(snapshot) } catch (failure) { setError(failure.message); return }
    const controller = new AbortController()
    network.current = controller
    setBusy('complete')
    try {
      const { data } = await api.post('/interview/complete', body, { signal: controller.signal })
      if (controller.signal.aborted || draftRef.current?.session_id !== snapshot.session_id) return
      const complete = { ...snapshot, status: 'completed', active_since: null, completed_at: new Date().toISOString(), completed_session: data }
      store.install(complete)
      onComplete?.(data)
    } catch (failure) { if (!controller.signal.aborted) setError(errorMessage(failure)) }
    finally { if (!controller.signal.aborted) setBusy('') }
  }

  function changeQuestion(index, resume = false) {
    if (voiceBusy || busy) return
    voice.cancel()
    voice.clearError()
    setError('')
    setDraft(current => navigateQuestion(current, index, Date.now(), resume))
    setNow(Date.now())
  }

  function togglePause() {
    if (voiceBusy || busy) return
    if (draft.status === 'running') pause()
    else { setDraft(current => resumeSession(current)); setNow(Date.now()) }
  }

  function reviewAnswers() {
    if (voiceBusy || busy) return
    voice.cancel()
    const snapshot = reviewSession(draftRef.current)
    setDraft(snapshot)
    flush(snapshot)
  }

  const saveLabel = !draft ? '' : store.saveState === 'error' ? 'Recovery could not be saved' : !draft.persist ? 'Browser recovery off' : store.saveState === 'saving' ? 'Saving recovery draft…' : store.savedAt ? `Recovery saved ${new Date(store.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Recovered browser draft'
  const importControl = <label className="room-import"><Upload size={15} /> {busy === 'import' ? 'Checking JSON…' : 'Load saved plan or draft'}<input type="file" accept=".json,application/json" aria-label="Load saved plan or draft" disabled={Boolean(busy)} onChange={event => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = '' }} /></label>

  return <div className="interview-room">
    {store.recoveryError && <div className="room-alert" role="alert"><CircleHelp size={19} /><div><strong>Browser recovery needs attention.</strong><p>{store.recoveryError}</p>{store.unreadable && <button className="text-button" onClick={() => download(store.unreadable, 'unreadable-interview-draft.json')}>Download existing recovery data</button>}</div></div>}
    {error && <div className="room-alert" role="alert"><CircleHelp size={19} /><p>{error}</p><button onClick={() => setError('')} aria-label="Dismiss interview error"><X size={16} /></button></div>}

    {(candidate || !draft) && <section className="panel room-preflight"><span className="eyebrow">YOUR INTERVIEW ROOM</span><h2>{candidate?.draft ? 'Pick up where you left off.' : candidate ? 'Ready to tell your story?' : 'Your next practice starts here.'}</h2><p>{candidate ? `${candidate.plan.settings.role} · ${candidate.plan.settings.category} · ${candidate.plan.settings.difficulty} · ${candidate.plan.questions.length} primary questions` : 'Create a personalized HR question plan or load one you downloaded earlier.'}</p>
      {candidate && <><div className="room-preflight-notes"><span><CheckCircle2 size={17} /> One question at a time, with text or voice answers</span><span><CheckCircle2 size={17} /> Timer pauses when you pause, leave this page or hide the tab</span><span><CheckCircle2 size={17} /> Optional HR follow-ups based on your answer</span></div><label className="room-checkbox"><input type="checkbox" checked={persist} onChange={event => setPersist(event.target.checked)} /><span><strong>Keep a recovery draft on this browser.</strong><small>Includes resume/JD context and answers. Only one interview draft is retained; you can clear it from this room.</small></span></label><div className="room-actions"><button className="button button-primary" disabled={Boolean(busy)} onClick={() => {
        if (draft || store.unreadable) setConfirmation({ title: 'Replace the current browser draft?', description: 'Download the existing interview or a draft backup first if you want to keep it. Starting this interview replaces the current draft on this browser.', action: 'Replace and start', run: installCandidate })
        else installCandidate()
      }}><Play size={16} />{candidate.draft ? 'Restore imported draft' : 'Start interview'}</button><button className="button button-outline" onClick={() => setCandidate(null)}>{draft ? 'Return to current interview' : 'Cancel plan'}</button></div></>}
      {!candidate && <div className="room-actions"><button className="button button-primary" onClick={onGenerate}><Sparkles size={16} /> Create HR questions</button>{importControl}</div>}
    </section>}

    {draft && !candidate && <>
      <header className="room-session-header"><div><span className="eyebrow">{draft.status === 'completed' ? 'INTERVIEW COMPLETE' : 'YOUR HR PRACTICE'}</span><h2>{draft.plan.settings.role}</h2><p>{primaryCount} primary questions · {followups.length} follow-up{followups.length === 1 ? '' : 's'} · {draft.plan.settings.category}</p></div><div className="room-timer" aria-live="off"><Clock3 size={17} /><strong>{formatTime(elapsedMilliseconds(draft, now))}</strong><small>{draft.status === 'running' ? 'Running' : draft.status === 'completed' ? 'Final active time' : 'Paused'}</small></div></header>
      <div className="room-progress"><div><span>{answered} of {draft.questions.length} answered</span><span className={store.saveState === 'error' ? 'room-save-error' : ''}><ShieldCheck size={12} />{saveLabel}</span></div><progress max={draft.questions.length} value={answered} aria-label="Interview answer progress" /></div>

      {draft.status === 'completed' ? <section className="panel room-complete"><span className="room-complete-icon"><CheckCircle2 size={36} /></span><span className="eyebrow">YOU SHOWED UP. YOU PRACTISED.</span><h2>Your interview is ready for feedback.</h2><p>Your {draft.questions.length} answers are ready. Download your interview to use with the feedback module.</p><div className="room-complete-stats"><div><strong>{primaryCount}</strong><span>Primary questions</span></div><div><strong>{followups.length}</strong><span>Adaptive follow-ups</span></div><div><strong>{formatTime(elapsedMilliseconds(draft))}</strong><span>Active time</span></div></div><div className="room-actions"><button className="button button-primary" onClick={() => download(draft.completed_session, 'completed-interview.json')}><ArrowDownToLine size={16} /> Download completed interview</button></div><details className="room-completed-answers"><summary>Review completed answers</summary>{draft.questions.map((item, index) => <article key={item.question_id}><h3>{index + 1}. {item.question}</h3><p>{draft.answers[item.question_id].text}</p></article>)}</details><p className="room-session-id">Session: {draft.session_id}</p></section> : draft.status === 'review' ? <section className="panel room-review"><span className="eyebrow">TAKE ONE LAST LOOK</span><h2>Review your answers.</h2><p>Complete every question before finishing. Timing includes reading and editing, so it is not used as speaking time.</p><ol>{draft.questions.map((item, index) => <li key={item.question_id}><div><span className="room-question-label">{item.parent_question_id ? 'FOLLOW-UP' : `QUESTION ${index + 1}`} · {draft.answers[item.question_id].input_mode === 'voice' ? 'VOICE-ASSISTED' : 'TEXT'}</span><h3>{item.question}</h3><p>{draft.answers[item.question_id].text || 'Not answered yet.'}</p></div><button className="button button-outline" onClick={() => changeQuestion(index, true)} disabled={Boolean(busy)}>Edit question {index + 1}</button></li>)}</ol><div className="room-actions"><button className="button button-primary" onClick={finish} disabled={Boolean(busy) || answered !== draft.questions.length}>{busy === 'complete' ? <LoaderCircle size={16} className="spin" /> : <Flag size={16} />} Complete interview</button><button className="button button-outline" onClick={() => changeQuestion(draft.current_index, false)} disabled={Boolean(busy)}>Back to interview</button></div>{answered !== draft.questions.length && <p className="room-hint">{draft.questions.length - answered} question(s) still need an answer.</p>}</section> : <div className="room-layout">
        <nav className="room-question-nav" aria-label="Interview questions"><span className="eyebrow">YOUR CONVERSATION</span>{draft.questions.map((item, index) => <button key={item.question_id} className={`${index === draft.current_index ? 'current' : ''} ${item.parent_question_id ? 'followup' : ''}`} onClick={() => changeQuestion(index)} disabled={voiceBusy || Boolean(busy)} aria-current={index === draft.current_index ? 'step' : undefined}><span>{draft.answers[item.question_id].text.trim() ? <Check size={13} /> : index + 1}</span><strong>{item.parent_question_id ? 'Follow-up' : `Question ${index + 1}`}</strong><small>{item.focus.replaceAll('_', ' ')}</small></button>)}</nav>
        <section className="panel room-question-panel" aria-labelledby="active-interview-question">
          <div className="room-question-top"><span className="room-question-label">{question.parent_question_id ? 'ADAPTIVE FOLLOW-UP' : 'HR QUESTION'} · {draft.current_index + 1} / {draft.questions.length}</span><button className="room-pause" onClick={togglePause} disabled={voiceBusy || Boolean(busy)}>{draft.status === 'running' ? <Pause size={15} /> : <Play size={15} />}{draft.status === 'running' ? 'Pause' : 'Resume'}</button></div>
          <span className="room-focus">{question.focus.replaceAll('_', ' ')}</span><h2 id="active-interview-question">{question.question}</h2>
          {question.parent_question_id && <p className="room-followup-reference"><MessageSquarePlus size={15} /> Based on your answer: “{question.answer_evidence}”</p>}
          {draft.status === 'paused' && <div className="room-paused"><Pause size={17} /><div><strong>Your interview is paused.</strong><p>{busy === 'followup' ? 'Gemini is preparing an answer-dependent HR follow-up. Waiting time is excluded from your timer.' : 'Your answers are kept. Resume when you are ready to continue.'}</p></div><button className="button button-outline" onClick={togglePause} disabled={Boolean(busy)}>Resume practice</button></div>}
          {locked && <div className="room-linked-note"><ShieldCheck size={16} /><p>This answer is linked to a follow-up. Remove that follow-up before revising this answer.</p><button className="text-button" disabled={Boolean(busy) || voiceBusy} onClick={() => {
            const child = draft.questions.find(item => item.parent_question_id === question.question_id)
            setConfirmation({ title: 'Remove the linked follow-up?', description: 'The follow-up question and its answer will be removed so you can revise the original answer.', action: 'Remove follow-up', run: () => { setDraft(current => removeFollowup(current, child.question_id)); setConfirmation(null) } })
          }}>Remove follow-up to edit</button></div>}
          <label className="room-answer-label">Your answer<textarea value={answer.text} maxLength={20000} rows={8} disabled={draft.status !== 'running' || voiceBusy || Boolean(busy) || locked} placeholder="Take a breath. Share your experience in your own words…" onChange={event => setDraft(current => editAnswer(current, question.question_id, event.target.value))} /></label>
          <div className="room-answer-meta"><span>{answer.text.trim() ? answer.text.trim().split(/\s+/).length : 0} words · {answer.text.length.toLocaleString()} / 20,000 characters</span><span>{answer.input_mode === 'voice' ? 'Voice-assisted transcript · editable' : 'Typed answer'}</span></div>
          <div className="room-voice"><div className="room-voice-controls"><button className={`button ${voiceBusy ? 'room-recording' : 'button-outline'}`} disabled={!voice.supported || locked || Boolean(busy) || draft.status !== 'running' || voice.state === 'stopping'} onClick={() => voiceBusy ? voice.stop() : voice.start(language)}>{voiceBusy ? <MicOff size={16} /> : <Mic size={16} />}{voice.state === 'starting' ? 'Stop microphone' : voice.state === 'stopping' ? 'Finishing transcript…' : voice.state === 'listening' ? 'Stop microphone' : 'Start microphone'}</button><label>Speech language<select value={language} onChange={event => setLanguage(event.target.value)} disabled={voiceBusy}><option value="en-IN">English (India)</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option></select></label></div><p>{voice.supported ? 'Voice uses your browser’s speech service, which may send audio to its provider. Only finalized transcript text is kept here. Stop the microphone before navigating.' : 'Speech recognition is unavailable in this browser. Typed answers remain fully available.'}</p>{voiceBusy && <div className="room-transcript" role="status"><span className="room-listening-dot" />{voice.state === 'starting' ? 'Waiting for microphone access…' : voice.interim || 'Listening for your answer…'}</div>}{voice.error && <p className="room-voice-error" role="alert">{voice.error}</p>}</div>
          <div className="room-followup-actions">{!question.parent_question_id && <button className="button button-outline" onClick={askFollowup} disabled={locked || answer.text.trim().length < 20 || voiceBusy || Boolean(busy) || followups.length >= MAX_FOLLOWUPS}>{busy === 'followup' ? <LoaderCircle size={16} className="spin" /> : <MessageSquarePlus size={16} />}{locked ? 'Follow-up added' : busy === 'followup' ? 'Preparing HR follow-up…' : 'Ask an HR follow-up'}</button>}<span>{question.parent_question_id ? 'Clarify your actions, outcome or reflection in your own words.' : `Optional · sends this answer and reviewed context to Gemini · ${followups.length}/${MAX_FOLLOWUPS} used`}</span></div>
          <div className="room-navigation"><button className="button button-outline" onClick={() => changeQuestion(draft.current_index - 1)} disabled={draft.current_index === 0 || voiceBusy || Boolean(busy)}><ArrowLeft size={15} /> Previous</button>{draft.current_index < draft.questions.length - 1 ? <button className="button button-primary" onClick={() => changeQuestion(draft.current_index + 1)} disabled={voiceBusy || Boolean(busy)}>Next question <ArrowRight size={15} /></button> : <button className="button button-primary" onClick={reviewAnswers} disabled={voiceBusy || Boolean(busy)}><Flag size={15} /> Review interview</button>}</div>
        </section>
      </div>}
      <div className="room-bottom-actions"><button className="text-button" disabled={voiceBusy || Boolean(busy)} onClick={() => { pause(); download(serializeDraft(draftRef.current), 'interview-draft.json') }}><ArrowDownToLine size={14} /> Download draft backup</button>{draft.status !== 'completed' && draft.status !== 'review' && <button className="text-button" disabled={voiceBusy || Boolean(busy)} onClick={reviewAnswers}>Review all answers</button>}{importControl}<button className="text-button room-clear" disabled={voiceBusy || Boolean(busy)} onClick={() => setConfirmation({ title: 'Clear this interview draft?', description: 'This removes the current interview and its recovery copy from this browser. Download it first if you want to keep it.', action: 'Clear interview', run: () => { store.clear(); setConfirmation(null) } })}><Trash2 size={13} /> Clear browser draft</button></div>
    </>}
    {confirmation && <ConfirmAction {...confirmation} onConfirm={confirmation.run} onCancel={() => setConfirmation(null)} />}
  </div>
}
