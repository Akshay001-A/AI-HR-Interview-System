import { useCallback, useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowRight, AudioLines, Braces, Check, CheckCircle2, ChevronRight, Circle, CircleHelp, FileText, LayoutDashboard, LoaderCircle, MessageSquare, RefreshCw, ShieldCheck, Sparkles, Target, X } from 'lucide-react'
import { api, errorMessage } from './src/api'
import DocumentPreparation from './src/DocumentPreparation'

const journey = [
  { icon: FileText, title: 'Bring your story', detail: 'Review your resume and job requirements.', phase: 'Available now' },
  { icon: Sparkles, title: 'Make it personal', detail: 'Questions shaped around your experience.', phase: 'Phase 3' },
  { icon: AudioLines, title: 'Find your voice', detail: 'Practise with text, voice and follow-ups.', phase: 'Phase 4' },
]

export default function InterviewApp() {
  const [view, setView] = useState('overview')
  const [documents, setDocuments] = useState({ resume: null, jd: null, analysis: null })
  const [connection, setConnection] = useState('checking')
  const [options, setOptions] = useState(null)
  const [error, setError] = useState('')
  const [sample, setSample] = useState(null)
  const [busy, setBusy] = useState(false)
  const [validated, setValidated] = useState(false)
  const [settings, setSettings] = useState({ role: 'Software Developer', category: 'HR', difficulty: 'Beginner', question_count: 5 })

  const checkConnection = useCallback(async (signal) => {
    setConnection('checking')
    setError('')
    try {
      const [health, available] = await Promise.all([
        api.get('/health', { signal }), api.get('/interview/options', { signal }),
      ])
      if (signal?.aborted) return
      if (health.data.status !== 'ok') throw new Error('Backend unavailable')
      setOptions(available.data)
      setConnection('connected')
    } catch (err) {
      if (signal?.aborted) return
      setConnection('offline')
      setError(errorMessage(err))
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    checkConnection(controller.signal)
    return () => controller.abort()
  }, [checkConnection])

  async function loadSample() {
    setBusy(true)
    setError('')
    setValidated(false)
    try {
      const { data } = await api.get('/interview/sample')
      setSample(data)
      setView('contract')
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  async function validateSample() {
    setBusy(true)
    setValidated(false)
    setError('')
    try {
      await api.post('/interview/validate', sample)
      setValidated(true)
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  function downloadSample() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'interview.sample.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

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
          <button className={`nav-item ${view === 'contract' ? 'active' : ''}`} aria-current={view === 'contract' ? 'page' : undefined} onClick={() => setView('contract')}><Braces size={18} /> Sample session <ChevronRight size={15} /></button>
        </nav>
        <div className="sidebar-note"><span className="note-icon"><Target size={20} /></span><h3>A little practice.<br />A lot more confidence.</h3><p>Make space to tell your story, one answer at a time.</p><div className="note-line" /></div>
        <div className="sidebar-footer"><ShieldCheck size={17} /><span>No account needed.<br /><strong>Your practice, your pace.</strong></span></div>
      </aside>

      <div className="workspace">
        <header className="topbar"><span>Workspace <ChevronRight size={14} /> <strong>{{ overview: 'Overview', prepare: 'Resume & JD', contract: 'Sample session' }[view]}</strong></span><span className="preview-badge"><Circle size={7} fill="currentColor" /> Development preview</span></header>
        <main id="main">
          <div className="page-heading"><div><span className="eyebrow">LET'S BUILD YOUR CONFIDENCE</span><h1>{{ overview: 'Your next chapter starts here.', prepare: 'Your story. Their opportunity.', contract: 'A session, ready to connect.' }[view]}</h1><p>{{ overview: 'Turn your experience into a conversation you feel ready for.', prepare: 'Build a reviewed profile from your resume and target job description.', contract: 'Explore the sample interview shared with the feedback engine.' }[view]}</p></div><div className="heading-icon"><MessageSquare size={25} /></div></div>

          {error && <div className="error-banner" role="alert"><CircleHelp size={20} /><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={17} /></button></div>}

          <div hidden={view !== 'prepare'}><DocumentPreparation documents={documents} setDocuments={setDocuments} /></div>
          {view === 'prepare' ? null : view === 'overview' ? <>
            <section className="hero-card" aria-labelledby="hero-title">
              <div className="hero-copy"><span className="pill"><Sparkles size={13} /> BUILT AROUND YOU</span><h2 id="hero-title">Your experience.<br />Your ambitions.<br /><em>Your interview.</em></h2><p>A focused space for personalised HR practice, shaped by your resume and the role you're aiming for.</p><button className="button button-light" onClick={() => setView('prepare')}>Prepare with your resume <ArrowRight size={17} /></button><span className="hero-caption">Resume PDF + job description · review and compare</span></div>
              <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-spark">✦</div><div className="art-card art-resume"><span className="art-icon"><FileText size={22} /></span><strong>Your story</strong><div className="art-line" /><div className="art-line short" /><div className="art-tags"><span>Skills</span><span>Experience</span></div></div><div className="art-card art-question"><span className="art-question-label"><Sparkles size={12} /> A QUESTION FOR YOU</span><strong>What experience<br />are you most proud of?</strong><div className="sound-bars">{[12, 21, 30, 18, 35, 25, 16, 30, 39, 22, 15, 27, 17].map((height, i) => <i key={i} style={{ height }} />)}</div></div><span className="art-check"><Check size={22} /></span></div>
            </section>

            <div className="section-heading"><div><h2>A more personal way to prepare</h2><p>The journey we're building, step by step.</p></div><span className="muted-label">COMING NEXT</span></div>
            <div className="journey-grid">{journey.map(({ icon: Icon, title, detail, phase }, i) => <article className="journey-card" key={title}><div className="journey-top"><span className={`feature-icon feature-${i}`}><Icon size={20} /></span><span className="step-number">0{i + 1}</span></div><h3>{title}</h3><p>{detail}</p><span className="phase-label">{phase}</span></article>)}</div>

            <div className="lower-grid"><section className="panel setup-panel" aria-labelledby="setup-title"><div className="panel-heading"><div><span className="eyebrow">SET YOUR DIRECTION</span><h2 id="setup-title">Picture your next role.</h2></div><span className="small-badge">Setup preview</span></div><p className="panel-description">Explore your preferences. Generation will be available in Phase 3.</p><div className="form-grid"><label className="full-width">Target role<input value={settings.role} maxLength={120} onChange={e => setSettings({ ...settings, role: e.target.value })} /></label><label>Interview category<select disabled={!options} value={settings.category} onChange={e => setSettings({ ...settings, category: e.target.value })}>{(options?.categories || ['HR']).map(value => <option key={value}>{value}</option>)}</select></label><label>Difficulty<select disabled={!options} value={settings.difficulty} onChange={e => setSettings({ ...settings, difficulty: e.target.value })}>{(options?.difficulties || ['Beginner']).map(value => <option key={value}>{value}</option>)}</select></label><label className="full-width">Primary questions <span className="count-value">{settings.question_count}</span><input type="range" min={options?.question_count.min ?? 1} max={options?.question_count.max ?? 15} value={settings.question_count} onChange={e => setSettings({ ...settings, question_count: Number(e.target.value) })} /><span className="range-labels"><span>1 question</span><span>15 questions</span></span></label></div><p className="form-note">Preview only. Preferences aren't saved yet.</p></section>
            <section className="panel readiness-panel"><span className="eyebrow">THE FOUNDATION</span><h2>A solid place to start.</h2><p className="panel-description">Your preparation tools are ready before your first live practice.</p><div className="readiness-row"><CheckCircle2 size={18} /><span>Practice workspace</span><span>Ready</span></div><div className="readiness-row"><CheckCircle2 size={18} /><span>Sample interview format</span><span>Ready</span></div><div className="readiness-row"><CheckCircle2 size={18} /><span>Resume & JD uploads</span><span>Ready</span></div><div className="status-box"><span className={`status-dot ${connection}`} /><div><strong>{connection === 'connected' ? 'Backend connected' : connection === 'checking' ? 'Checking connection…' : 'Backend offline'}</strong><p>Interview engine · local workspace</p></div><button aria-label="Retry backend connection" onClick={() => checkConnection()} disabled={connection === 'checking'}><RefreshCw size={16} className={connection === 'checking' ? 'spin' : ''} /></button></div><p className="availability-note">AI generation and database saving are not enabled in this phase.</p></section></div>
          </> : <section className="panel contract-panel"><div className="panel-heading"><div><span className="eyebrow">INTERVIEW CONTRACT · V1.0</span><h2>A shared language for both modules.</h2></div><span className="small-badge">Synthetic data</span></div><p className="panel-description">This example lets the feedback engine develop independently. Validation checks the format; it does not evaluate or save answers.</p>{!sample ? <div className="empty-state"><Braces size={40} /><h3>Start with a complete example.</h3><p>Load one sample question, answer, resume profile and job description.</p><button className="button button-primary" onClick={loadSample} disabled={busy}>{busy && <LoaderCircle size={16} className="spin" />}Load sample session <ArrowRight size={16} /></button></div> : <><div className="sample-summary"><span><strong>{sample.role}</strong><small>{sample.category} · {sample.difficulty}</small></span><span className="small-badge">{sample.answers.length} answered question</span></div><div className="sample-qa"><span className="eyebrow">QUESTION 01</span><h3>{sample.questions[0].question}</h3><p>{sample.answers[0].answer}</p></div><details><summary>View shared JSON</summary><pre>{JSON.stringify(sample, null, 2)}</pre></details><div className="contract-actions"><button className="button button-primary" onClick={validateSample} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />} Validate contract</button><button className="button button-outline" onClick={downloadSample}><ArrowDownToLine size={16} /> Download JSON</button><button className="text-button" onClick={loadSample} disabled={busy}>Reload sample</button></div>{validated && <p className="success-message" role="status"><CheckCircle2 size={17} /> Validated by the backend. No data was saved.</p>}</>}</section>}
          <footer className="page-footer"><span>INTERVIEW STUDIO</span><span>Thoughtful practice. Meaningful progress.</span></footer>
        </main>
      </div>
    </div>
  )
}
