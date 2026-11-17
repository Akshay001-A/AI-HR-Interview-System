export const MAX_BYTES = 2 * 1024 * 1024
export const CRITERIA = ['relevance', 'clarity', 'structure', 'completeness', 'examples']

export function readInterview(text) {
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES) throw new Error('Choose an interview JSON file no larger than 2 MB.')
  let data
  try { data = JSON.parse(text) } catch { throw new Error('This file is not valid JSON.') }
  if (!data || Array.isArray(data) || !Array.isArray(data.answers) || !data.answers.length) throw new Error('Choose a completed interview with at least one answer.')
  if (data.draft_version || data.plan_id || data.report_version) throw new Error('Choose a completed interview, rather than a draft, question plan or feedback report.')
  return data
}

export function validateReport(report) {
  const score = value => Number.isInteger(value) && value >= 0 && value <= 100
  const texts = value => Array.isArray(value) && value.length > 0 && value.every(text => typeof text === 'string' && text.trim())
  const count = value => Number.isInteger(value) && value >= 0
  if (report?.report_version !== '2.0' || !report.session_id || report.generation?.source !== 'gemini'
    || !score(report.overall_score) || !Array.isArray(report.evaluations) || !report.evaluations.length
    || !texts(report.recommendations) || !report.storage || typeof report.storage.saved !== 'boolean'
    || !['sqlite', 'mongodb'].includes(report.storage.engine) || typeof report.storage.message !== 'string'
    || !Number.isFinite(Date.parse(report.created_at)) || typeof report.notice !== 'string'
    || typeof report.role !== 'string' || !report.role.trim()
    || !report.communication_analysis || !CRITERIA.every(key => score(report.criteria_averages?.[key]))) throw new Error('The feedback report has an unsupported format. No substitute results were created.')
  const analysis = report.communication_analysis
  if (!count(analysis.word_count) || !count(analysis.filler_word_count)
    || !analysis.filler_breakdown || typeof analysis.filler_breakdown !== 'object' || Array.isArray(analysis.filler_breakdown)
    || !Object.values(analysis.filler_breakdown).every(count)
    || typeof analysis.notice !== 'string' || typeof analysis.timing_notice !== 'string') throw new Error('The text analysis is incomplete. Please try again.')
  for (const item of report.evaluations) {
    if (!item.question_id || !item.question || !item.answer || !score(item.score)
      || !CRITERIA.every(key => score(item.criteria?.[key]))
      || !texts(item.strengths) || !texts(item.weaknesses) || typeof item.answer_template !== 'string' || !item.answer_template.trim()) throw new Error('The feedback report is incomplete. Please try again.')
  }
  return report
}

export function downloadJson(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
