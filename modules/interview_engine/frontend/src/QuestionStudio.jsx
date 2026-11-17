import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, FileCheck2, FileText, LoaderCircle, ShieldCheck, Sparkles, X } from 'lucide-react'
import { api, errorMessage } from './api'
import { preparationData } from './preparation'
import './question-studio.css'

export default function QuestionStudio({ active, documents, settings, setSettings, options, onPrepare, onStartInterview }) {
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [persist, setPersist] = useState(true)
  const [provider, setProvider] = useState(null)
  const [checking, setChecking] = useState(false)
  const [statusError, setStatusError] = useState('')
  const requestId = useRef(0)
  const controller = useRef(null)
  const history = useRef([])
  const ready = Boolean(documents.resume && documents.jd)
  const request = ready ? {
    ...preparationData(documents), ...settings,
    resume_context: documents.resume.fields.context ?? documents.resume.extracted_text,
  } : null
  const signature = JSON.stringify(request)

  const checkProvider = useCallback(async signal => {
    setChecking(true)
    setStatusError('')
    try {
      const { data } = await api.get('/interview/options', { signal })
      if (!signal?.aborted) setProvider(data.generation)
    } catch (failure) {
      if (!signal?.aborted) setStatusError('Question generation is unavailable. Please try again.')
    } finally {
      if (!signal?.aborted) setChecking(false)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    const statusController = new AbortController()
    checkProvider(statusController.signal)
    return () => statusController.abort()
  }, [active, checkProvider])

  useEffect(() => {
    requestId.current += 1
    controller.current?.abort()
    history.current = []
    setBusy(false)
    setError('')
    setReviewed(false)
  }, [signature])

  useEffect(() => {
    if (!active) {
      requestId.current += 1
      controller.current?.abort()
      setBusy(false)
    }
  }, [active])

  useEffect(() => () => controller.current?.abort(), [])

  useEffect(() => {
    if (!busy) return
    const started = performance.now()
    setElapsed(0)
    const timer = setInterval(() => setElapsed(Math.floor((performance.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [busy])

  async function generate() {
    controller.current?.abort()
    const activeController = new AbortController()
    controller.current = activeController
    const id = ++requestId.current
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/interview/generate', {
        ...request, previous_questions: history.current,
      }, { timeout: (provider?.request_budget_seconds || 60) * 1000 + 15000, signal: activeController.signal })
      if (id === requestId.current) {
        history.current = [...history.current, ...data.questions.map(question => question.question)].slice(-30)
        onStartInterview(data, { persist })
      }
    } catch (failure) {
      if (id === requestId.current && !activeController.signal.aborted) setError(errorMessage(failure))
    } finally {
      if (id === requestId.current) setBusy(false)
    }
  }

  const blocked = busy || !reviewed || !ready || !settings.role.trim() || provider?.gemini_configured === false
    || request?.resume_context.trim().length < 20 || request?.job_description.text.length < 20

  return <div className="question-studio">
    {!ready ? <section className="panel"><div className="empty-state"><FileCheck2 size={40} /><h3>Add your interview documents.</h3><p>Review your resume and job description to create personalized HR questions.</p><button className="button button-primary" onClick={onPrepare}>Prepare resume & JD <ArrowRight size={16} /></button></div></section> : <>
      <div className="studio-layout">
        <section className="panel studio-settings" aria-labelledby="studio-settings-title">
          <div className="studio-panel-heading"><span className="studio-section-number">01</span><div><h2 id="studio-settings-title">Interview settings</h2></div></div>
          
          <fieldset disabled={busy}>
            <div className="form-grid">
              <label className="full-width">Target role<input maxLength={120} value={settings.role} onChange={event => setSettings({ ...settings, role: event.target.value })} /></label>
              <label>HR category<select value={settings.category} onChange={event => setSettings({ ...settings, category: event.target.value })}>{(options?.categories || ['HR', 'Behavioral', 'Situational']).map(value => <option key={value}>{value}</option>)}</select></label>
              <label>Reflection depth<select value={settings.difficulty} onChange={event => setSettings({ ...settings, difficulty: event.target.value })}>{(options?.difficulties || ['Beginner', 'Intermediate', 'Advanced']).map(value => <option key={value}>{value}</option>)}</select></label>
              <label className="full-width">Number of HR questions <span className="count-value">{settings.question_count}</span><input type="range" min="1" max="15" value={settings.question_count} onChange={event => setSettings({ ...settings, question_count: Number(event.target.value) })} /><span className="range-labels"><span>A quick warm-up · 1</span><span>A deeper session · 15</span></span></label>
            </div>
            <div className="studio-depth-note"><ShieldCheck size={16} /><p>Depth means richer reflection and workplace situations. Every question stays focused on HR.</p></div>
            <label className="checkbox-option studio-review"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span><strong>I've reviewed both documents.</strong><small>Generating sends the reviewed resume context, profile and full JD to Google's Gemini API.</small></span></label>
            <label className="checkbox-option studio-review"><input type="checkbox" checked={persist} onChange={event => setPersist(event.target.checked)} /><span><strong>Save a recovery draft on this browser.</strong><small>Includes your resume, job description and answers.</small></span></label>
          </fieldset>
          <button className="button button-primary studio-generate" onClick={generate} disabled={blocked}>{busy ? <LoaderCircle size={18} className="spin" /> : <Sparkles size={18} />}{busy ? 'Preparing your interview…' : 'Start interview'}{!busy && <ArrowRight size={16} />}</button>
        </section>

        <aside className="studio-brief" aria-labelledby="studio-brief-title">
          {statusError && <div className="studio-provider-warning" role="status">{statusError} <button className="text-button" onClick={() => checkProvider()} disabled={checking}>Try again</button></div>}
          {!checking && !statusError && provider?.gemini_configured === false && <p className="studio-provider-warning" role="status">Question generation is not available yet. Please contact the app administrator.</p>}
          <div className="studio-brief-body"><span className="eyebrow">THE CONTEXT BEHIND YOUR QUESTIONS</span><h2 id="studio-brief-title">Your interview brief.</h2>
            <div className="studio-document"><span><FileText size={17} /></span><div><small>YOUR RESUME</small><strong>{documents.resume.metadata.filename}</strong><p>{request.resume_profile.projects.length} project entries · {request.resume_profile.experience.length} experience entries</p></div><CheckCircle2 size={16} /></div>
            <div className="studio-document"><span><FileText size={17} /></span><div><small>THE OPPORTUNITY</small><strong>{documents.jd.metadata.filename || 'Pasted job description'}</strong><p>Full responsibilities, qualifications and expectations</p></div><CheckCircle2 size={16} /></div>
            <details className="studio-context"><summary>Review interview context</summary><div className="context-text"><h3>Reviewed resume context</h3><p>{request.resume_context}</p><h3>Reviewed resume profile</h3><pre>{JSON.stringify(request.resume_profile, null, 2)}</pre><h3>Full reviewed JD</h3><p>{request.job_description.text}</p><h3>Reviewed JD skills</h3><p>{request.job_description.required_skills.join(', ') || 'None listed'}</p></div></details>
            <button className="studio-edit-docs" onClick={onPrepare}><ArrowLeft size={14} /> Edit reviewed documents</button>
            
          </div>
        </aside>
      </div>

      {error && <div className="studio-error" role="alert"><CircleHelp size={21} /><div><strong>We couldn't start your interview.</strong><p>{error}</p></div><button onClick={() => setError('')} aria-label="Dismiss generation error"><X size={17} /></button></div>}

      {busy && <section className="panel studio-loading" aria-live="polite"><div className="studio-loading-icon"><Sparkles size={25} /></div><h3>Your interview is getting ready.</h3><p>Your first question will appear here when ready. Questions are shown one at a time.</p><span className="studio-elapsed" aria-live="off">Working on your set · {elapsed}s</span><div className="studio-loading-lines" aria-hidden="true"><span /><span /><span /></div></section>}


    </>}
  </div>
}
