const DEFAULT_RETRIES = 3

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
  const url = `${process.env.AI_SERVICE_URL}${path}`
  let lastErr

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options)
      return response
    } catch (err) {
      lastErr = err

      if (attempt < retries && shouldRetryFetch(err)) {
        await delay(500 * attempt)
        continue
      }

      break
    }
  }

  throw lastErr
}

module.exports = { fetchAiService }