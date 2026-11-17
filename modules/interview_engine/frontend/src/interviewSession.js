// Pure session state and recovery logic. Timing is engagement time, not speaking time.
export const DRAFT_KEY = 'interview-studio:session:v1'
export const MAX_DRAFT_BYTES = 2 * 1024 * 1024
export const MAX_FOLLOWUPS = 5
export const FOCI = ['motivation', 'self_awareness', 'teamwork', 'communication', 'conflict', 'ownership', 'prioritization', 'adaptability', 'learning', 'resilience', 'leadership', 'integrity', 'feedback', 'career_goals', 'role_alignment']
const text = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.length <= max
const list = (values, max, itemMax) => Array.isArray(values) && values.length <= max && values.every(value => text(value, 1, itemMax))
const finite = value => Number.isFinite(value) && value >= 0 && value <= 1e10

export function validatePlan(plan) {
  if (!plan || plan.schema_version !== 'question-plan-2.0' || plan.source !== 'gemini') throw new Error('Choose a Gemini question-plan-2.0 JSON file.')
  const settings = plan.settings
  if (!settings || !text(settings.role, 1, 120) || !['HR', 'Behavioral', 'Situational'].includes(settings.category)
    || !['Beginner', 'Intermediate', 'Advanced'].includes(settings.difficulty) || !Number.isInteger(settings.question_count)
    || settings.question_count < 1 || settings.question_count > 15) throw new Error('The question plan has invalid interview settings.')
  if (!text(plan.plan_id, 1, 100) || !text(plan.model, 1, 120) || !text(plan.resume_context, 20, 60000)
    || !Number.isFinite(Date.parse(plan.created_at)) || !text(plan.notice, 1, 2000)) throw new Error('The question plan is incomplete.')
  if (!Array.isArray(plan.questions) || plan.questions.length !== settings.question_count || plan.questions.some((question, index) => (
    question.question_id !== `q${index + 1}` || !text(question.question, 20, 600) || !FOCI.includes(question.focus)
    || typeof question.resume_evidence !== 'string' || question.resume_evidence.length > 240
    || typeof question.jd_evidence !== 'string' || question.jd_evidence.length > 240
  ))) throw new Error('The question list is invalid or incomplete.')
  const resume = plan.resume_profile
  if (!resume || !list(resume.skills, 100, 120) || ['projects', 'education', 'experience'].some(field => !list(resume[field], 60, 2000))) throw new Error('The resume profile is invalid.')
  if (!plan.job_description || !text(plan.job_description.text, 20, 30000) || !list(plan.job_description.required_skills, 100, 120)
    || !list(plan.matched_skills, 100, 120) || !list(plan.skill_gaps, 100, 120)) throw new Error('The reviewed job context is invalid.')
  return plan
}

export function newSession(plan, { persist = true, now = Date.now(), id = globalThis.crypto.randomUUID() } = {}) {
  validatePlan(plan)
  return {
    draft_version: 1, session_id: `interview_${id}`, plan: structuredClone(plan),
    questions: structuredClone(plan.questions),
    answers: Object.fromEntries(plan.questions.map(question => [question.question_id, { text: '', input_mode: 'text', duration_ms: 0 }])),
    current_index: 0, status: 'running', active_since: now, persist,
    started_at: new Date(now).toISOString(), completed_at: null, completed_session: null,
  }
}

export function checkpoint(draft, now = Date.now()) {
  if (!draft || draft.status !== 'running' || !Number.isFinite(draft.active_since)) return draft
  const id = draft.questions[draft.current_index].question_id
  const answer = draft.answers[id]
  const duration = answer.duration_ms + Math.max(0, now - draft.active_since)
  return { ...draft, active_since: now, answers: { ...draft.answers, [id]: { ...answer, duration_ms: Math.min(duration, 1e10) } } }
}

export function pauseSession(draft, now = Date.now()) {
  if (!draft || draft.status !== 'running') return draft
  return { ...checkpoint(draft, now), status: 'paused', active_since: null }
}

export function resumeSession(draft, now = Date.now()) {
  if (!draft || draft.status === 'completed') return draft
  return { ...draft, status: 'running', active_since: now }
}

export function navigateQuestion(draft, index, now = Date.now(), forceResume = false) {
  if (!draft || draft.status === 'completed' || index < 0 || index >= draft.questions.length) return draft
  const next = checkpoint(draft, now)
  const running = forceResume || draft.status === 'running'
  return { ...next, current_index: index, status: running ? 'running' : 'paused', active_since: running ? now : null }
}

export function hasFollowup(draft, id) {
  return draft.questions.some(question => question.parent_question_id === id)
}

export function editAnswer(draft, id, value, inputMode = 'text', now = Date.now()) {
  if (!draft || draft.status !== 'running' || draft.questions[draft.current_index].question_id !== id || hasFollowup(draft, id)) return draft
  if (typeof value !== 'string' || value.length > 20000) return draft
  const next = checkpoint(draft, now)
  const previous = next.answers[id]
  return { ...next, answers: { ...next.answers, [id]: {
    ...previous, text: value,
    input_mode: !value.trim() ? 'text' : inputMode === 'voice' || previous.input_mode === 'voice' ? 'voice' : 'text',
  } } }
}

export function addFollowup(draft, followup, now = Date.now()) {
  const parentIndex = draft.questions.findIndex(question => question.question_id === followup.parent_question_id && !question.parent_question_id)
  if (parentIndex < 0 || draft.status === 'completed' || hasFollowup(draft, followup.parent_question_id)
    || draft.questions.filter(question => question.parent_question_id).length >= MAX_FOLLOWUPS
    || followup.based_on_answer !== draft.answers[followup.parent_question_id].text.trim()
    || followup.question_id !== followup.parent_question_id + '_followup' || !text(followup.question, 20, 600)
    || !FOCI.includes(followup.focus) || followup.source !== 'gemini') throw new Error('This follow-up does not match the current answer. Please try again.')
  const next = checkpoint(draft, now)
  const questions = [...next.questions]
  questions.splice(parentIndex + 1, 0, followup)
  return { ...next, questions, answers: { ...next.answers, [followup.question_id]: { text: '', input_mode: 'text', duration_ms: 0 } }, current_index: parentIndex + 1 }
}

export function removeFollowup(draft, id, now = Date.now()) {
  if (!draft || draft.status === 'completed') return draft
  const target = draft.questions.find(question => question.question_id === id && question.parent_question_id)
  if (!target) return draft
  const next = checkpoint(draft, now)
  const answers = { ...next.answers }
  delete answers[id]
  const questions = next.questions.filter(question => question.question_id !== id)
  const currentId = next.questions[next.current_index].question_id
  return { ...next, questions, answers, current_index: questions.findIndex(question => question.question_id === (currentId === id ? target.parent_question_id : currentId)), active_since: next.status === 'running' ? now : null }
}

export function reviewSession(draft, now = Date.now()) {
  if (!draft || draft.status === 'completed') return draft
  return { ...checkpoint(draft, now), status: 'review', active_since: null }
}

export function completionRequest(draft, now = Date.now()) {
  const value = checkpoint(draft, now)
  const unanswered = value.questions.findIndex(question => !value.answers[question.question_id].text.trim())
  if (unanswered >= 0) throw new Error(`Answer question ${unanswered + 1} before completing the interview.`)
  return {
    session_id: value.session_id, plan: value.plan,
    followups: value.questions.filter(question => question.parent_question_id),
    answers: value.questions.map(question => {
      const answer = value.answers[question.question_id]
      return {
        question_id: question.question_id, question: question.question, answer: answer.text.trim(), input_mode: answer.input_mode,
        ...(answer.duration_ms > 0 ? { duration_seconds: Math.round(answer.duration_ms) / 1000 } : {}),
      }
    }),
  }
}

export function serializeDraft(draft, now = Date.now()) {
  const paused = pauseSession(draft, now)
  const snapshot = { ...paused, saved_at: new Date(now).toISOString() }
  const json = JSON.stringify(snapshot)
  if (new TextEncoder().encode(json).byteLength > MAX_DRAFT_BYTES) throw new Error('This draft exceeds the browser recovery size limit. Download completed answers before leaving.')
  return json
}

export function sessionPayload(draft) {
  const request = completionRequest(draft)
  return {
    schema_version: '1.0', session_id: draft.session_id, ...draft.plan.settings,
    resume_profile: draft.plan.resume_profile, job_description: draft.plan.job_description,
    matched_skills: draft.plan.matched_skills, skill_gaps: draft.plan.skill_gaps,
    questions: draft.questions.map(question => ({ question_id: question.question_id, question: question.question,
      ...(question.parent_question_id ? { parent_question_id: question.parent_question_id } : {}) })),
    answers: request.answers,
  }
}

export function parseDraft(json) {
  if (typeof json !== 'string' || json.length > MAX_DRAFT_BYTES || new TextEncoder().encode(json).byteLength > MAX_DRAFT_BYTES) throw new Error('Recovery data is too large or unreadable.')
  const draft = JSON.parse(json)
  if (!draft || draft.draft_version !== 1 || !text(draft.session_id, 1, 100) || !['running', 'paused', 'review', 'completed'].includes(draft.status)
    || typeof draft.persist !== 'boolean' || !Number.isFinite(Date.parse(draft.started_at))) throw new Error('This recovery draft has an unsupported format.')
  validatePlan(draft.plan)
  if (!Array.isArray(draft.questions) || draft.questions.length < draft.plan.questions.length || draft.questions.length > draft.plan.questions.length + MAX_FOLLOWUPS
    || !Number.isInteger(draft.current_index) || draft.current_index < 0 || draft.current_index >= draft.questions.length) throw new Error('The recovery question list is invalid.')
  const primary = draft.questions.filter(question => !question.parent_question_id)
  if (primary.length !== draft.plan.questions.length || primary.some((question, index) => question.question_id !== draft.plan.questions[index].question_id || question.question !== draft.plan.questions[index].question)) throw new Error('Recovery questions do not match the plan.')
  const seen = new Set()
  const followupParents = new Set()
  for (const question of draft.questions) {
    if (seen.has(question.question_id) || !text(question.question, 20, 600) || !FOCI.includes(question.focus)) throw new Error('A recovery question is invalid.')
    if (question.parent_question_id) {
      const parent = primary.find(item => item.question_id === question.parent_question_id)
      if (!parent || !seen.has(parent.question_id) || followupParents.has(parent.question_id) || question.question_id !== parent.question_id + '_followup'
        || question.source !== 'gemini' || !text(question.model, 1, 120) || !text(question.based_on_answer, 20, 20000) || !text(question.answer_evidence, 5, 240)) throw new Error('A recovered follow-up is invalid.')
      followupParents.add(parent.question_id)
    }
    seen.add(question.question_id)
    if (!draft.answers || !Object.hasOwn(draft.answers, question.question_id)) throw new Error('An answer is missing from the recovery draft.')
    const answer = draft.answers[question.question_id]
    if (typeof answer.text !== 'string' || answer.text.length > 20000 || !['text', 'voice'].includes(answer.input_mode) || !finite(answer.duration_ms)) throw new Error('A recovery answer is invalid.')
  }
  if (Object.keys(draft.answers).length !== seen.size) throw new Error('The recovery answer list does not match its questions.')
  for (const question of draft.questions.filter(item => item.parent_question_id)) {
    if (draft.answers[question.parent_question_id].text.trim() !== question.based_on_answer) throw new Error('A recovered parent answer no longer matches its follow-up.')
  }
  if (draft.status === 'completed') {
    completionRequest(draft)
    if (!draft.completed_session || draft.completed_session.schema_version !== '1.0' || draft.completed_session.session_id !== draft.session_id) throw new Error('The completed session data is missing.')
    const expected = sessionPayload(draft)
    if (Object.keys(expected).some(key => JSON.stringify(expected[key]) !== JSON.stringify(draft.completed_session[key]))) throw new Error('The completed session does not match the recovered answers.')
  }
  return { ...draft, status: draft.status === 'completed' ? 'completed' : draft.status === 'review' ? 'review' : 'paused', active_since: null }
}

export function elapsedMilliseconds(draft, now = Date.now()) {
  if (!draft) return 0
  return Object.values(checkpoint(draft, now).answers).reduce((sum, answer) => sum + answer.duration_ms, 0)
}

export function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
