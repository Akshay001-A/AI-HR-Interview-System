import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

export function errorMessage(error) {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail.message === 'string') return detail.message
  if (Array.isArray(detail)) {
    return detail.map(item => `${item.loc?.filter(part => part !== 'body').join(' → ') || 'Input'}: ${item.msg}`).join('. ')
  }
  if (error.response?.status >= 500) return 'The backend could not finish this request. Please try again.'
  if (error.code === 'ECONNABORTED') return 'The backend took too long to respond. Please try again.'
  return 'Cannot reach the interview backend. Check that it is running on port 8000, then try again.'
}

export function postForm(endpoint, form) {
  // Let the browser set the multipart boundary instead of the client's JSON default.
  return api.post(endpoint, form, { headers: { 'Content-Type': undefined }, timeout: 30000 })
}
