import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowRight, AudioLines, Check, ChevronRight, CircleHelp, FileText, LayoutDashboard, MessageSquare, ShieldCheck, Sparkles, Target, X } from 'lucide-react'
import { api, errorMessage } from './src/api'
import DocumentPreparation from './src/DocumentPreparation'
import QuestionStudio from './src/QuestionStudio'
import InterviewRoom from './src/InterviewRoom'

const journey = [
  { icon: FileText, title: 'Bring your story', detail: 'Review your resume and job requirements.', phase: 'Available now' },
  { icon: Sparkles, title: 'Make it personal', detail: 'HR questions shaped around your experience.', phase: 'Available now' },
  { icon: AudioLines, title: 'Find your voice', detail: 'Practise with text, voice and follow-ups.', phase: 'Available now' },
]

export default function InterviewApp({ onComplete } = {}) {
  const [view, setView] = useState('overview')
  const [documents, setDocuments] = useState({ resume: null, jd: null, analysis: null })
  const [launchPlan, setLaunchPlan] = useState(null)
  const [roomStage, setRoomStage] = useState('setup')
  const [roomSummary, setRoomSummary] = useState({ exists: false })
  const [options, setOptions] = useState(null)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState({ role: 'Software Developer', category: 'HR', difficulty: 'Beginner', question_count: 5 })

  useEffect(() => {
    const controller = new AbortController()
    api.get('/interview/options', { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setOptions(data) })
      .catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)) })
    return () => controller.abort()
  }, [])

  function openSetup() { setRoomStage('setup'); setView('interview') }
  function openPractice() { setRoomStage('practice'); setView('interview') }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <a href="#main" className="brand" onClick={() => setView('overview')} aria-label="Interview Studio home">
          <span className="brand-symbol"><AudioLines size={24} /></span>
          <span>interview<span className="brand-sub">STUDIO</span></span>
        </a>
        <div className="workspace-tag"><span className="tiny-dot" /> YOUR PRACTICE SPACE</div>
        <nav aria-label="Main navigation">
          <button className={`nav-item ${view === 'overview' ? 'active' : ''}`} aria-current={view === 'overview' ? 'page' : undefined} onClick={() => setView('overview')}><LayoutDashboard size={18} /> Overview <ChevronRight size={15} /></button>
          <button className={`nav-item ${view === 'prepare' ? 'active' : ''}`} aria-current={view === 'prepare' ? 'page' : undefined} onClick={() => setView('prepare')}><FileText size={18} /> Resume & JD <ChevronRight size={15} /></button>
          <button className={`nav-item ${view === 'interview' ? 'active' : ''}`} aria-current={view === 'interview' ? 'page' : undefined} onClick={() => setView('interview')}><AudioLines size={18} /> Interview room <ChevronRight size={15} /></button>
        </nav>
        <div className="sidebar-note"><span className="note-icon"><Target size={20} /></span><h3>A little practice.<br />A lot more confidence.</h3><p>Make space to tell your story, one answer at a time.</p><div className="note-line" /></div>
        <div className="sidebar-footer"><ShieldCheck size={17} /><span>No account needed.<br /><strong>Your practice, your pace.</strong></span></div>
      </aside>

      <div className="workspace">
        <header className="topbar"><span>Workspace <ChevronRight size={14} /> <strong>{{ overview: 'Overview', prepare: 'Resume & JD', interview: 'Interview room' }[view]}</strong></span></header>
        <main id="main">
          <div className="page-heading"><div><span className="eyebrow">LET'S BUILD YOUR CONFIDENCE</span><h1>{{ overview: 'Your next chapter starts here.', prepare: 'Your story. Their opportunity.', interview: 'Make room for your best answer.' }[view]}</h1><p>{{ overview: 'Turn your experience into a conversation you feel ready for.', prepare: 'Build a reviewed profile from your resume and target job description.', interview: 'A focused conversation, one question at a time.' }[view]}</p></div><div className="heading-icon"><MessageSquare size={25} /></div></div>

          {error && <div className="error-banner" role="alert"><CircleHelp size={20} /><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={17} /></button></div>}

          <div hidden={view !== 'prepare'}><DocumentPreparation documents={documents} setDocuments={setDocuments} onContinue={openSetup} /></div>
          <div hidden={view !== 'interview'}>
            <div className="room-flow-actions">
              <span>{roomStage === 'setup' ? 'Set up your HR interview' : 'Interview practice'}</span>
              {roomStage === 'setup' && !roomSummary.exists && <button className="button button-outline" onClick={openPractice}><ArrowDownToLine size={15} /> Load saved interview</button>}
              {roomStage === 'practice' && <button className="button button-outline" onClick={openSetup}><Sparkles size={15} /> New interview</button>}
            </div>
            <div hidden={roomStage !== 'setup'}><QuestionStudio active={view === 'interview' && roomStage === 'setup'} documents={documents} settings={settings} setSettings={setSettings} options={options} onPrepare={() => setView('prepare')} onStartInterview={(plan, preferences) => { setLaunchPlan({ plan, ...preferences }); openPractice() }} /></div>
            <div hidden={roomStage !== 'practice'}><InterviewRoom active={view === 'interview' && roomStage === 'practice'} launchPlan={launchPlan} onLaunchConsumed={() => setLaunchPlan(null)} onGenerate={openSetup} onComplete={onComplete} onSummary={setRoomSummary} /></div>
          </div>
          {view === 'overview' && <>
            {(roomSummary.exists || roomSummary.recoveryError) && <div className="overview-draft-banner"><ShieldCheck size={20} /><div><strong>{roomSummary.status === 'completed' ? 'Your completed interview is available.' : roomSummary.exists ? 'Your interview draft is ready to resume.' : 'A browser recovery draft needs attention.'}</strong><p>{roomSummary.exists ? `${roomSummary.answered} of ${roomSummary.total} questions answered · kept on this browser` : 'Open the interview room to review recovery options.'}</p></div><button className="button button-outline" onClick={openPractice}>{roomSummary.status === 'completed' ? 'Open interview' : 'Resume interview'} <ArrowRight size={14} /></button></div>}
            <section className="hero-card" aria-labelledby="hero-title">
              <div className="hero-copy"><span className="pill"><Sparkles size={13} /> BUILT AROUND YOU</span><h2 id="hero-title">Your experience.<br />Your ambitions.<br /><em>Your interview.</em></h2><p>A focused space for personalised HR practice, shaped by your resume and the role you're aiming for.</p><button className="button button-light" onClick={() => setView('prepare')}>Prepare with your resume <ArrowRight size={17} /></button><span className="hero-caption">Resume PDF + job description · review and compare</span></div>
              <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-spark">✦</div><div className="art-card art-resume"><span className="art-icon"><FileText size={22} /></span><strong>Your story</strong><div className="art-line" /><div className="art-line short" /><div className="art-tags"><span>Skills</span><span>Experience</span></div></div><div className="art-card art-question"><span className="art-question-label"><Sparkles size={12} /> A QUESTION FOR YOU</span><strong>What experience<br />are you most proud of?</strong><div className="sound-bars">{[12, 21, 30, 18, 35, 25, 16, 30, 39, 22, 15, 27, 17].map((height, i) => <i key={i} style={{ height }} />)}</div></div><span className="art-check"><Check size={22} /></span></div>
            </section>

            <div className="section-heading"><div><h2>A more personal way to prepare</h2><p>Prepare your documents, create questions and practise.</p></div></div>
            <div className="journey-grid">{journey.map(({ icon: Icon, title, detail, phase }, i) => <article className="journey-card" key={title}><div className="journey-top"><span className={`feature-icon feature-${i}`}><Icon size={20} /></span><span className="step-number">0{i + 1}</span></div><h3>{title}</h3><p>{detail}</p><span className="phase-label">{phase}</span></article>)}</div>

          </>}
          <footer className="page-footer"><span>INTERVIEW STUDIO</span><span>Thoughtful practice. Meaningful progress.</span></footer>
        </main>
      </div>
    </div>
  )
}
