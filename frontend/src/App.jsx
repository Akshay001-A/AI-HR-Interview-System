import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, FileCheck2, RefreshCw } from 'lucide-react'
import Workspace from './Workspace'
import InterviewApp from '../../modules/interview_engine/frontend/InterviewApp'
import FeedbackApp from '../../modules/feedback_engine/frontend/FeedbackApp'
import { request } from './api'
import { validateReport } from './feedback'

function SavedReports({ active, onOpen }) {
  const [sessions, setSessions] = useState([])
  const [offset, setOffset] = useState(0)
  const [revision, refresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef(null)
  useEffect(() => {
    if (!active) return
    const abort = new AbortController(); controller.current = abort
    setBusy(true); setError('')
    request(`/feedback/history?limit=20&offset=${offset}`, { signal: abort.signal })
      .then(data => { if (!abort.signal.aborted) setSessions(data.sessions) })
      .catch(error => { if (!abort.signal.aborted) setError(error.message) })
      .finally(() => { if (!abort.signal.aborted) setBusy(false) })
    return () => abort.abort()
  }, [active, offset, revision])
  async function open(id) {
    controller.current?.abort()
    const abort = new AbortController(); controller.current = abort
    setBusy(true); setError('')
    try {
      const report = validateReport(await request(`/feedback/report/${encodeURIComponent(id)}`, { signal: abort.signal }))
      if (!abort.signal.aborted) onOpen(report)
    } catch (error) { if (!abort.signal.aborted) setError(error.message) }
    finally { if (!abort.signal.aborted) setBusy(false) }
  }
  useEffect(() => { if (!active) controller.current?.abort() }, [active])
  useEffect(() => () => controller.current?.abort(), [])
  return <section className="panel report-history"><div className="panel-heading"><h2>Saved reports</h2><button className="button button-outline" onClick={() => refresh(n => n + 1)} disabled={busy}><RefreshCw size={15} />Refresh</button></div>
    {error && <p className="feedback-error" role="alert">{error}</p>}
    {busy ? <p role="status">Loading reports…</p> : !sessions.length ? <div className="empty-state"><FileCheck2 size={34} /><h3>{offset ? 'No more reports.' : 'Your progress starts here.'}</h3><p>Saved feedback reports will appear here after evaluation.</p></div> : <ul className="report-history-list">{sessions.map(session => <li key={session.session_id}><div><strong>{session.role}</strong><span>{new Date(session.created_at).toLocaleDateString()} · {session.overall_score}/100</span><small>{session.session_id}</small></div><button className="button button-outline" onClick={() => open(session.session_id)}>Open report <ArrowRight size={14} /></button></li>)}</ul>}
    <div className="feedback-actions"><button className="button button-outline" disabled={busy || !offset} onClick={() => setOffset(n => Math.max(0, n-20))}>Previous</button><button className="button button-outline" disabled={busy || sessions.length < 20} onClick={() => setOffset(n => n+20)}>Next</button></div>
  </section>
}

export default function App() {
  const [view, setView] = useState('overview')
  const [report, setReport] = useState(null)
  const [interviewData, setInterviewData] = useState(null)
  const onComplete = useCallback(value => { setInterviewData(value); setReport(null); setView('feedback') }, [])
  const onReport = useCallback(value => { setReport(value); setView('feedback') }, [])
  return <Workspace view={view} onNavigate={setView}>
    {view !== 'prepare' && view !== 'interview' && <div className="page-heading"><div><span className="eyebrow">MAKE YOUR NEXT ANSWER STRONGER</span><h1>{{overview: 'Your story. Your next step.', feedback: 'Turn practice into progress.', history: 'See how far you have come.'}[view]}</h1><p>{{overview: 'Understand your answers and prepare for your next HR conversation.', feedback: 'Personalized feedback, grounded in your completed interview.', history: 'Return to your previous feedback and recommendations.'}[view]}</p></div></div>}
    {view === 'overview' && <><section className="hero-card feedback-hero"><div className="hero-copy"><span className="pill">BUILT AROUND YOUR EXPERIENCE</span><h2>Reflect on your answers.<br /><em>Find your next step.</em></h2><p>Review your HR interview with focused feedback on clarity, structure and the experiences you choose to share.</p><button className="button button-light" onClick={() => setView('prepare')}>Start HR practice <ArrowRight size={16} /></button></div><div className="feedback-hero-art" aria-hidden="true"><FileCheck2 size={88} /><span>Your answers.<br />A clearer direction.</span></div></section><div className="journey-grid feedback-journey">{[['01','Bring your interview','Complete your HR interview or upload a previous session.'],['02','Understand your answers','Review feedback for each HR question, including adaptive follow-ups.'],['03','Prepare your next step','Use focused recommendations and templates with your real experience.']].map(([number,title,text])=><article className="journey-card" key={number}><span className="eyebrow">{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></>}
    <div hidden={view !== 'prepare' && view !== 'interview'}><InterviewApp embedded requestedView={view === 'prepare' ? 'prepare' : 'interview'} active={view === 'prepare' || view === 'interview'} onNavigate={setView} onComplete={onComplete} /></div>
    <div hidden={view !== 'feedback'}><FeedbackApp active={view === 'feedback'} interviewData={interviewData} report={report} onReport={onReport} /></div>
    <div hidden={view !== 'history'}><SavedReports active={view === 'history'} onOpen={onReport} /></div>
  </Workspace>
}
