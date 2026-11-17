import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, FileCheck2, LoaderCircle, Upload, X } from 'lucide-react'
import { request } from '../../../frontend/src/api'
import { downloadJson, MAX_BYTES, readInterview, validateReport } from '../../../frontend/src/feedback'
import AnswerEvaluation from './AnswerEvaluation'
import CommunicationAnalysis from './CommunicationAnalysis'
import FinalReport from './FinalReport'
import Recommendations from './Recommendations'

export default function FeedbackApp({ active, report, onReport, interviewData }) {
  const [session, setSession] = useState(null)
  const [filename, setFilename] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState('summary')
  const controller = useRef(null)
  const fileInput = useRef(null)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => { if (report) setTab('summary') }, [report])
  useEffect(() => {
    if (!interviewData) return
    controller.current?.abort()
    const abort = new AbortController(); controller.current = abort
    setSession(null); setConsent(false); setError(''); setBusy('import')
    request('/feedback/validate', { body: interviewData, signal: abort.signal })
      .then(data => { if (!abort.signal.aborted) { setSession(data); setFilename('Completed live interview') } })
      .catch(error => { if (!abort.signal.aborted) setError(error.message) })
      .finally(() => { if (!abort.signal.aborted) setBusy('') })
    return () => abort.abort()
  }, [interviewData])
  async function loadFile(file) {
    if (!file) return
    controller.current?.abort()
    const abort = new AbortController(); controller.current = abort
    setBusy('import'); setError(''); setConsent(false); setSession(null); setFilename('')
    try {
      if (file.size > MAX_BYTES || !file.name.toLowerCase().endsWith('.json')) throw new Error('Choose a completed interview JSON file no larger than 2 MB.')
      const body = readInterview(await file.text())
      const data = await request('/feedback/validate', { body, signal: abort.signal })
      if (!abort.signal.aborted) { setSession(data); setFilename(file.name) }
    } catch (error) { if (!abort.signal.aborted) setError(error.message) }
    finally { if (!abort.signal.aborted) setBusy('') }
  }
  async function evaluate() {
    if (!session || !consent || busy) return
    const abort = new AbortController(); controller.current = abort
    const timer = setTimeout(() => abort.abort(), 75000)
    setBusy('evaluate'); setError('')
    try {
      const data = validateReport(await request('/feedback/evaluate', { body: session, signal: abort.signal }))
      if (!abort.signal.aborted) onReport(data)
    } catch (error) { setError(error.message) }
    finally { clearTimeout(timer); setBusy('') }
  }
  return <div className="feedback-workspace">
    <section className="panel feedback-import" aria-labelledby="import-title"><div className="panel-heading"><div><span className="eyebrow">YOUR COMPLETED INTERVIEW</span><h2 id="import-title">Bring your conversation.</h2></div><FileCheck2 size={26} /></div>
      <p className="panel-description">Upload your completed interview JSON. Your questions, answers and reviewed document context stay together.</p>
      <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Upload completed interview" disabled={Boolean(busy)} onChange={event => { loadFile(event.target.files?.[0]); event.target.value = '' }} />
      {session && <div className="feedback-session-brief"><strong>{session.role}</strong><span>{session.category} · {session.difficulty} · {session.question_count} primary questions · {session.questions.length-session.question_count} follow-up{session.questions.length-session.question_count === 1 ? '' : 's'}</span><small>{filename}</small><details><summary>Review included questions and answers</summary>{session.answers.map(answer => <article key={answer.question_id}><h3>{answer.question}</h3><p>{answer.answer}</p></article>)}</details>
      <label className="feedback-consent"><input type="checkbox" checked={consent} disabled={Boolean(busy)} onChange={event => setConsent(event.target.checked)} /><span>I agree to send these answers, questions and reviewed resume/job context to Google's Gemini API for feedback. The generated report will be saved on this application’s configured storage.</span></label>
      <button className="button button-primary" onClick={evaluate} disabled={!consent || Boolean(busy)}>{busy === 'evaluate' ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />}{busy === 'evaluate' ? 'Reviewing your interview…' : 'Get interview feedback'}</button></div>}
      {busy === 'import' && <p role="status">Checking your interview…</p>}
      {busy === 'evaluate' && <p role="status">Reviewing every answer against the HR rubric. Your existing report stays available while you wait.</p>}
      {error && <div className="feedback-error" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss feedback error"><X size={16} /></button></div>}
    </section>
    {report && <section className="feedback-report" aria-labelledby="feedback-title"><div className="feedback-report-heading"><div><span className="eyebrow">YOUR PERSONALIZED FEEDBACK</span><h2 id="feedback-title">{report.role}</h2><p>{new Date(report.created_at).toLocaleString()} · {report.evaluations.length} answers reviewed</p></div><button className="button button-outline" onClick={() => downloadJson(report, `feedback-${report.session_id}.json`)}><ArrowDownToLine size={16} />Download report</button></div>
      {!report.storage.saved && <p className="feedback-error" role="status">{report.storage.message}</p>}
      <div className="feedback-tabs" role="tablist" aria-label="Feedback sections">{[['summary','Overview'],['answers','Answer feedback'],['communication','Text insights'],['recommendations','Next steps']].map(([id,label]) => <button type="button" key={id} id={`tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { const ids=['summary','answers','communication','recommendations']; const next=ids[(ids.indexOf(tab)+(event.key==='ArrowRight'?1:3))%4]; setTab(next); document.getElementById(`tab-${next}`)?.focus() } }} onClick={() => setTab(id)}>{label}</button>)}</div>
      <div className="feedback-tab-panel" id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>{tab === 'summary' ? <FinalReport reportData={report} /> : tab === 'answers' ? <AnswerEvaluation evaluations={report.evaluations} /> : tab === 'communication' ? <CommunicationAnalysis communicationData={report.communication_analysis} /> : <Recommendations recommendations={report.recommendations} />}</div>
    </section>}
  </div>
}
