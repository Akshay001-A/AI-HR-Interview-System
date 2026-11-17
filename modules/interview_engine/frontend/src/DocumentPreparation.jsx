import { useState } from 'react'
import { ArrowDownToLine, ArrowRight, CheckCircle2, CircleHelp, FileText, LoaderCircle, RefreshCw, Scale, Upload, X } from 'lucide-react'
import { api, errorMessage, postForm } from './api'
import { preparationData, resumeFields } from './preparation'

function ProfileField({ name, value, onChange, hint, rows = 4, disabled, maxLength }) {
  return (
    <label className="profile-field">
      <span>{name}</span>
      <small>{hint || 'One entry per line. Review or add missing details.'}</small>
      <textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} disabled={disabled} maxLength={maxLength} />
    </label>
  )
}

function Notices({ metadata }) {
  return <details className="extraction-notices"><summary>Extraction notes · {metadata.warnings.length}</summary>
    <ul>{metadata.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
  </details>
}

function PDFInput({ label, busy, disabled, onFile }) {
  return <label className={`pdf-picker ${busy || disabled ? 'picker-disabled' : ''}`}>
    {busy ? <LoaderCircle className="spin" size={24} /> : <Upload size={24} />}
    <strong>{busy ? 'Reading PDF…' : label}</strong>
    <span>Text-based PDF · up to 10 MB · 20 pages</span>
    <input type="file" accept=".pdf,application/pdf" aria-label={label} disabled={disabled || busy}
      onChange={event => {
        const file = event.target.files?.[0]
        if (file) onFile(file)
        event.target.value = ''
      }} />
  </label>
}

export default function DocumentPreparation({ documents, setDocuments, onContinue }) {
  const [jdMode, setJDMode] = useState('text')
  const [jdText, setJDText] = useState('')
  const [resumeBusy, setResumeBusy] = useState(false)
  const [jdBusy, setJDBusy] = useState(false)
  const [compareBusy, setCompareBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const [announcement, setAnnouncement] = useState('')
  const busy = resumeBusy || jdBusy || compareBusy

  function setError(area, message) {
    setErrors(previous => ({ ...previous, [area]: message }))
  }

  function updateProfile(kind, field, value) {
    setDocuments(previous => ({
      ...previous,
      [kind]: { ...previous[kind], fields: { ...previous[kind].fields, [field]: value } },
      analysis: null,
    }))
    setAnnouncement('Profile updated. Compare skills again to refresh the results.')
  }

  async function extract(kind, file) {
    const setBusy = kind === 'resume' ? setResumeBusy : setJDBusy
    setError(kind, '')
    if (file && (!file.name.toLowerCase().endsWith('.pdf') || file.size > 10 * 1024 * 1024 || file.size === 0)) {
      setError(kind, 'Choose a non-empty PDF file no larger than 10 MB.')
      return
    }
    if (!file && jdText.trim().length < 20) {
      setError(kind, 'Paste at least 20 characters of job description text.')
      return
    }
    setBusy(true)
    setAnnouncement('')
    try {
      const form = new FormData()
      if (file) form.append('file', file)
      else form.append('text', jdText.trim())
      const { data } = await postForm(`/interview/${kind}`, form)
      const profile = kind === 'resume' ? data.resume_profile : data.job_description
      const fields = kind === 'resume'
        ? { ...Object.fromEntries(resumeFields.map(field => [field, profile[field].join('\n')])), context: data.extracted_text }
        : { text: profile.text, required_skills: profile.required_skills.join('\n') }
      setDocuments(previous => ({ ...previous, [kind]: { ...data, fields }, analysis: null }))
      setAnnouncement(`${kind === 'resume' ? 'Resume' : 'Job description'} extracted. Review the suggested fields below.`)
    } catch (error) { setError(kind, errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function compare() {
    setError('analysis', '')
    setCompareBusy(true)
    try {
      const { data } = await api.post('/interview/analyze', preparationData(documents))
      setDocuments(previous => ({ ...previous, analysis: data }))
      setAnnouncement('Skill comparison updated from your reviewed profiles.')
    } catch (error) { setError('analysis', errorMessage(error)) }
    finally { setCompareBusy(false) }
  }

  function downloadPreparation() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(documents.analysis, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'interview-preparation.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function errorBanner(area) {
    return errors[area] && <div className="error-banner" role="alert"><CircleHelp size={18} /><span>{errors[area]} {documents[area] ? 'Your previous profile has been kept.' : ''}</span><button aria-label={`Dismiss ${area} error`} onClick={() => setError(area, '')}><X size={16} /></button></div>
  }

  const { resume, jd, analysis } = documents
  return <div className="preparation-workspace">
    <div className="preparation-intro"><ShieldNotice /><p>Extraction and skill comparison run locally. Review the full context before choosing Gemini question generation. Unsaved work clears on refresh; documents are not stored in a database.</p></div>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <div className="preparation-grid">
      <section className="panel document-panel" aria-labelledby="resume-title">
        <div className="panel-heading"><div><span className="eyebrow">01 · YOUR EXPERIENCE</span><h2 id="resume-title">Bring your resume.</h2></div><FileText size={22} /></div>
        <p className="panel-description">Upload your PDF. Check the suggested skills and sections before continuing.</p>
        <PDFInput label={resume ? 'Replace resume PDF' : 'Upload resume PDF'} busy={resumeBusy} disabled={compareBusy} onFile={file => extract('resume', file)} />
        {errorBanner('resume')}
        {resume && <div className="reviewed-profile">
          <div className="document-source"><CheckCircle2 size={16} /><span>{resume.metadata.filename}</span><small>{resume.metadata.page_count} page(s)</small></div>
          <Notices metadata={resume.metadata} />
          <fieldset disabled={busy}>
            {resumeFields.map(field => <ProfileField key={field} name={`Resume ${field}`} value={resume.fields[field]} onChange={value => updateProfile('resume', field, value)} hint={field === 'skills' ? 'One skill per line. Add skills the parser missed.' : undefined} rows={field === 'skills' ? 5 : 3} />)}
            <ProfileField name="Reviewed resume context" value={resume.fields.context ?? resume.extracted_text} onChange={value => updateProfile('resume', 'context', value)} hint="Review the complete text, including achievements and responsibilities missed above. This context is included when you generate questions with Gemini. Profile fields above take priority if they conflict." rows={8} maxLength={60000} />
          </fieldset>
          <details className="raw-extraction"><summary>View extracted resume text</summary><pre>{resume.extracted_text}</pre></details>
        </div>}
        {!resume && <p className="document-empty">Your extracted profile will appear here. Scanned PDFs need OCR before upload.</p>}
      </section>

      <section className="panel document-panel" aria-labelledby="jd-title">
        <div className="panel-heading"><div><span className="eyebrow">02 · YOUR NEXT OPPORTUNITY</span><h2 id="jd-title">Add the job description.</h2></div><FileText size={22} /></div>
        <p className="panel-description">Paste the description or upload a PDF, then review which skills the role requires.</p>
        <div className="input-mode-switch" role="group" aria-label="Job description input mode">
          <button aria-pressed={jdMode === 'text'} disabled={jdBusy || compareBusy} onClick={() => setJDMode('text')}>Paste text</button>
          <button aria-pressed={jdMode === 'pdf'} disabled={jdBusy || compareBusy} onClick={() => setJDMode('pdf')}>Upload PDF</button>
        </div>
        {jdMode === 'text' ? <div className="jd-paste">
          <label className="profile-field"><span>Paste job description</span><textarea rows={6} value={jdText} maxLength={30000} disabled={jdBusy || compareBusy} placeholder="Paste the responsibilities, qualifications and skills for the role…" onChange={event => setJDText(event.target.value)} /></label>
          <div className="jd-paste-actions"><small>{jdText.length.toLocaleString()} / 30,000 characters</small><button className="button button-primary" onClick={() => extract('jd')} disabled={jdBusy || compareBusy || jdText.trim().length < 20}>{jdBusy ? <LoaderCircle size={15} className="spin" /> : <ArrowRight size={15} />} Extract JD skills</button></div>
        </div> : <PDFInput label={jd ? 'Replace JD PDF' : 'Upload JD PDF'} busy={jdBusy} disabled={compareBusy} onFile={file => extract('jd', file)} />}
        {errorBanner('jd')}
        {jd && <div className="reviewed-profile">
          <div className="document-source"><CheckCircle2 size={16} /><span>{jd.metadata.filename || 'Pasted job description'}</span>{jd.metadata.page_count && <small>{jd.metadata.page_count} page(s)</small>}</div>
          <Notices metadata={jd.metadata} />
          <fieldset disabled={busy}>
            <ProfileField name="JD required skills" value={jd.fields.required_skills} onChange={value => updateProfile('jd', 'required_skills', value)} hint="One required skill per line. Remove preferred or negated mentions if appropriate." rows={5} />
            <ProfileField name="Reviewed job description" value={jd.fields.text} onChange={value => updateProfile('jd', 'text', value)} hint="If you edit this text, review the required-skills list above too." rows={7} />
          </fieldset>
        </div>}
        {!jd && <p className="document-empty">Your reviewed job requirements will appear here.</p>}
      </section>
    </div>

    <section className="panel comparison-panel" aria-labelledby="comparison-title">
      <div className="panel-heading"><div><span className="eyebrow">03 · CONNECT THE DOTS</span><h2 id="comparison-title">Where your skills meet the role.</h2></div><Scale size={22} /></div>
      <p className="panel-description">Compare the reviewed lists. Common aliases such as JS/JavaScript and NodeJS/Node.js are treated as the same skill. Custom skills match by spelling, ignoring case and extra spaces.</p>
      <button className="button button-primary" onClick={compare} disabled={!resume || !jd || busy}>{compareBusy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Compare reviewed skills</button>
      {!resume || !jd ? <p className="document-empty">Add both your resume and job description to unlock comparison.</p> : !analysis && <p className="document-empty">Review your fields above, then compare. Editing a profile clears the previous results.</p>}
      {errorBanner('analysis')}
      {analysis && <div className="analysis-result" aria-live="polite">
        <div className="skill-comparison-grid">
          <article className="skill-group matched"><h3>Listed in both <span>{analysis.matched_skills.length}</span></h3><div className="skill-chips">{analysis.matched_skills.map(skill => <span key={skill}>{skill}</span>)}</div>{!analysis.matched_skills.length && <p>No matching skills were listed.</p>}</article>
          <article className="skill-group gaps"><h3>Not listed in your resume <span>{analysis.skill_gaps.length}</span></h3><div className="skill-chips">{analysis.skill_gaps.map(skill => <span key={skill}>{skill}</span>)}</div>{!analysis.skill_gaps.length && <p>{analysis.job_description.required_skills.length ? 'All reviewed JD skills are listed in your resume profile.' : 'The JD skill list is empty. Add requirements above for a useful comparison.'}</p>}</article>
        </div>
        <p className="comparison-note">{analysis.note}</p>
        <div className="preparation-actions"><button className="button button-outline" onClick={downloadPreparation}><ArrowDownToLine size={16} /> Download preparation JSON</button></div>
      </div>}
      {resume && jd && <div className="preparation-actions"><button className="button button-primary" disabled={busy} onClick={onContinue}>Create HR questions <ArrowRight size={16} /></button><span>Uses your reviewed resume and full JD, beyond matching skills.</span></div>}
    </section>
  </div>
}

function ShieldNotice() {
  return <span className="preparation-label"><CheckCircle2 size={16} /> REVIEW BEFORE YOU PRACTISE</span>
}
