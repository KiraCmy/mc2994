/** POST JSON, with the caller's abort signal; throws on a non-2xx answer. */
export async function postJson(fetchImpl, url, { headers = {}, body, signal }) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const message = data?.error?.message ?? data?.message ?? text.slice(0, 200)
    const err = new Error(`HTTP ${res.status}: ${message}`)
    err.status = res.status
    throw err
  }
  if (!data) throw new Error('provider returned a non-JSON response')
  return data
}

export function parseJsonText(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('provider returned no text')
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')
  return JSON.parse(trimmed)
}
