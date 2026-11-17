const base = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

export async function request(path, { body, signal } = {}) {
  let response
  try {
    response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal })
  } catch (error) {
    if (signal?.aborted) throw new Error('The request was cancelled or took too long. Your interview is still available.')
    throw new Error('We could not reach the service. Check your connection and try again.')
  }
  let data
  try { data = await response.json() } catch { throw new Error('The service returned an unreadable response. Please try again.') }
  if (!response.ok) {
    const detail = data?.detail
    if (Array.isArray(detail)) throw new Error('The interview format is invalid: ' + detail.slice(0, 3).map(item => `${item.loc?.slice(1).join('.') || 'interview'}: ${item.msg}`).join('; '))
    throw new Error(typeof detail === 'string' ? detail : detail?.message || 'The request failed. Please try again.')
  }
  return data
}
