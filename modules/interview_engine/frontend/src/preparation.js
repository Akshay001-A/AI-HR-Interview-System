export const resumeFields = ['skills', 'projects', 'education', 'experience']
export const lines = text => text.split('\n').map(line => line.trim()).filter(Boolean)

export function preparationData(documents) {
  return {
    resume_profile: Object.fromEntries(resumeFields.map(field => [field, lines(documents.resume.fields[field])])),
    job_description: {
      text: documents.jd.fields.text.trim(),
      required_skills: lines(documents.jd.fields.required_skills),
    },
  }
}
