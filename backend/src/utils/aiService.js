const DEFAULT_RETRIES = 6
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetryFetch(err) {
  const message = err?.message || ''
  const causeMessage = err?.cause?.message || ''

  return [message, causeMessage].some((text) =>
    /fetch failed|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ECONNRESET/i.test(text)
  )
}

async function fetchAiService(path, options = {}, retries = DEFAULT_RETRIES) {
  const url = `${AI_SERVICE_URL}${path}`
  let lastErr

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options)
      return response
    } catch (err) {
      lastErr = err
      // Helpful log so backend console shows why requests to AI service fail
      console.error(`fetchAiService error (attempt ${attempt}) calling ${url}:`, err.message || err)

      if (attempt < retries && shouldRetryFetch(err)) {
        // exponential backoff (500ms, 1500ms, 3500ms, ...)
        const wait = 500 * attempt * attempt
        await delay(wait)
        continue
      }

      break
    }
  }

  throw lastErr
}

module.exports = { fetchAiService }