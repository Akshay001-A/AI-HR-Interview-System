import test from 'node:test'
import assert from 'node:assert/strict'
import { addFollowup, checkpoint, completionRequest, editAnswer, elapsedMilliseconds, formatTime, hasFollowup, MAX_DRAFT_BYTES, navigateQuestion, newSession, parseDraft, pauseSession, removeFollowup, resumeSession, reviewSession, serializeDraft, sessionPayload, validatePlan } from './interviewSession.js'

function plan() {
  return {
    schema_version: 'question-plan-2.0', plan_id: 'plan_test', created_at: new Date(0).toISOString(),
    settings: { role: 'Graduate Developer', category: 'HR', difficulty: 'Beginner', question_count: 2 },
    resume_context: 'A student project involving a team of three classmates.',
    resume_profile: { skills: ['Python'], projects: ['Placement tracker'], education: ['Information Science'], experience: ['Team project'] },
    job_description: { text: 'A graduate role requiring teamwork and communication.', required_skills: ['Teamwork'] },
    matched_skills: [], skill_gaps: ['Teamwork'], source: 'gemini', model: 'gemini-test', notice: 'Synthetic test plan.',
    questions: [
      { question_id: 'q1', question: 'How did you contribute to your student project team?', focus: 'teamwork', resume_evidence: 'team of three classmates', jd_evidence: '' },
      { question_id: 'q2', question: 'What motivates you about the teamwork expected in this role?', focus: 'motivation', resume_evidence: '', jd_evidence: 'teamwork and communication' },
    ],
  }
}
function draft() { return newSession(plan(), { now: 1000, id: 'test' }) }
const parentAnswer = 'I organized team discussions and clarified the project responsibilities.'
function followup() { return { question_id: 'q1_followup', parent_question_id: 'q1', question: 'How did your team respond to the decision to clarify responsibilities?', focus: 'communication', answer_evidence: 'organized team discussions', based_on_answer: parentAnswer, source: 'gemini', model: 'gemini-test' } }

test('timer excludes paused and offline time across recovery', () => {
  let value = checkpoint(draft(), 3500)
  value = pauseSession(value, 4000)
  assert.equal(elapsedMilliseconds(value, 99999), 3000)
  value = resumeSession(value, 10000)
  value = navigateQuestion(value, 1, 12000)
  value = checkpoint(value, 14500)
  assert.equal(value.answers.q1.duration_ms, 5000)
  assert.equal(value.answers.q2.duration_ms, 2500)
  const recovered = parseDraft(serializeDraft(value, 15000))
  assert.equal(recovered.status, 'paused')
  assert.equal(recovered.active_since, null)
  assert.equal(elapsedMilliseconds(recovered, 500000), 8000)
  assert.equal(elapsedMilliseconds(checkpoint(resumeSession(recovered, 500000), 502000), 502000), 10000)
})

test('navigation preserves typed and voice-assisted answers', () => {
  let value = editAnswer(draft(), 'q1', parentAnswer, 'text', 1100)
  value = navigateQuestion(value, 1, 1200)
  value = editAnswer(value, 'q2', 'I enjoy learning while contributing to a team.', 'voice', 1300)
  value = navigateQuestion(value, 0, 1400)
  assert.equal(value.answers.q1.text, parentAnswer)
  assert.equal(value.answers.q2.input_mode, 'voice')
  value = pauseSession(value, 1500)
  assert.equal(editAnswer(value, 'q1', 'Should not change a paused answer'), value)
})

test('a follow-up is inserted after its parent and locks the source answer', () => {
  let value = editAnswer(draft(), 'q1', parentAnswer, 'text', 1100)
  value = addFollowup(value, followup(), 1200)
  assert.deepEqual(value.questions.map(q => q.question_id), ['q1', 'q1_followup', 'q2'])
  assert.equal(value.current_index, 1)
  assert.equal(hasFollowup(value, 'q1'), true)
  value = navigateQuestion(value, 0, 1300)
  assert.equal(editAnswer(value, 'q1', 'A changed answer', 'text', 1400), value)
  assert.throws(() => addFollowup(value, followup(), 1500))
})

test('a stale follow-up cannot be inserted after the answer changes', () => {
  let value = editAnswer(draft(), 'q1', 'A new and different response about my experience.', 'text', 1100)
  assert.throws(() => addFollowup(value, followup(), 1200), /does not match/)
})

test('removing a follow-up preserves primary answers and unlocks editing', () => {
  let value = editAnswer(draft(), 'q1', parentAnswer, 'text', 1100)
  value = addFollowup(value, followup(), 1200)
  value = editAnswer(value, 'q1_followup', 'The team appreciated the clarity.', 'text', 1300)
  value = removeFollowup(value, 'q1_followup', 1400)
  assert.equal(value.current_index, 0)
  assert.equal(value.answers.q1.text, parentAnswer)
  assert.equal(value.answers.q1_followup, undefined)
  assert.equal(hasFollowup(value, 'q1'), false)
  assert.equal(editAnswer(value, 'q1', 'I can now revise my answer.', 'text', 1500).answers.q1.text, 'I can now revise my answer.')
})

test('completion requires all questions and exports measured time without speech-rate claims', () => {
  let value = draft()
  assert.throws(() => completionRequest(value, 1100), /Answer question 1/)
  value = editAnswer(value, 'q1', parentAnswer, 'text', 1200)
  value = navigateQuestion(value, 1, 1400)
  value = editAnswer(value, 'q2', 'The role aligns with my motivation to work with others.', 'voice', 1800)
  value = reviewSession(value, 2000)
  const body = completionRequest(value, 99999)
  assert.equal(body.plan.settings.question_count, 2)
  assert.equal(body.answers[0].duration_seconds, .4)
  assert.equal(body.answers[1].duration_seconds, .6)
  assert.equal(body.answers[1].input_mode, 'voice')
  assert.equal('speaking_rate' in body.answers[1], false)
  const complete = { ...value, status: 'completed', completed_session: sessionPayload(value) }
  assert.equal(parseDraft(serializeDraft(complete, 3000)).status, 'completed')
  complete.completed_session.answers[0].answer = 'Tampered export'
  assert.throws(() => parseDraft(serializeDraft(complete, 3000)), /does not match/)
})

test('corrupt and oversized recovery data is rejected instead of silently reset', () => {
  assert.throws(() => parseDraft('not json'))
  assert.throws(() => parseDraft('x'.repeat(MAX_DRAFT_BYTES + 1)), /too large/)
  assert.throws(() => parseDraft('界'.repeat(Math.ceil(MAX_DRAFT_BYTES / 3) + 1)), /too large/)
  const value = JSON.parse(serializeDraft(draft(), 1100))
  value.draft_version = 2
  assert.throws(() => parseDraft(JSON.stringify(value)), /unsupported/)
})

test('recovery rejects missing, mismatched and excess answer records', () => {
  const value = JSON.parse(serializeDraft(draft(), 1100))
  delete value.answers.q1
  assert.throws(() => parseDraft(JSON.stringify(value)), /missing/)
  const other = JSON.parse(serializeDraft(draft(), 1100))
  other.answers.extra = { text: 'fake', input_mode: 'text', duration_ms: 0 }
  assert.throws(() => parseDraft(JSON.stringify(other)), /does not match/)
  const duplicate = JSON.parse(serializeDraft(draft(), 1100))
  duplicate.questions[1].question_id = 'q1'
  assert.throws(() => parseDraft(JSON.stringify(duplicate)))
})

test('completed and paused interviews never accrue time or accept edits', () => {
  const value = { ...draft(), status: 'completed', active_since: null }
  assert.equal(checkpoint(value, 99999), value)
  assert.equal(editAnswer(value, 'q1', 'Changed'), value)
  assert.equal(navigateQuestion(value, 1), value)
})

test('question plans reject removed local sources and invalid settings', () => {
  assert.throws(() => validatePlan({ ...plan(), source: 'fallback' }))
  assert.throws(() => validatePlan({ ...plan(), settings: { ...plan().settings, category: 'Technical' } }))
  assert.equal(formatTime(125000), '02:05')
})
