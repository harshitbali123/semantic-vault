const cache  = require('../config/redis')
const crypto = require('crypto')

const CACHE_TTL = 300   // 5 minutes in seconds

/**
 * Generate a deterministic cache key from query + user_id.
 * Same query from same user always maps to the same key.
 */
function makeCacheKey(query, userId) {
  const hash = crypto
    .createHash('md5')
    .update(`${userId}:${query.trim().toLowerCase()}`)
    .digest('hex')
  return `search:${hash}`
}

/**
 * Try to get cached search results.
 * Returns parsed results or null if miss.
 */
async function getCached(query, userId) {
  try {
    const key  = makeCacheKey(query, userId)
    const data = await cache.get(key)
    if (!data) return null
    return { ...JSON.parse(data), cache_hit: true }
  } catch {
    return null   // cache errors should never break search
  }
}

/**
 * Cache search results with TTL.
 */
async function setCached(query, userId, results) {
  try {
    const key = makeCacheKey(query, userId)
    await cache.set(key, JSON.stringify(results), 'EX', CACHE_TTL)
  } catch {
    // silently ignore cache write errors
  }
}

/**
 * Flush all search cache entries for a user.
 * Call this after a new document is ingested so stale results are cleared.
 */
async function flushUserCache(userId) {
  try {
    // Redis SCAN to find all keys — safer than KEYS in production
    let cursor  = '0'
    let deleted = 0
    do {
      const [newCursor, keys] = await cache.scan(
        cursor, 'MATCH', `search:*`, 'COUNT', 100
      )
      cursor = newCursor
      if (keys.length) {
        await cache.del(...keys)
        deleted += keys.length
      }
    } while (cursor !== '0')
    console.log(`[Cache] Flushed ${deleted} search cache entries`)
  } catch (err) {
    console.error('[Cache] Flush error:', err.message)
  }
}

module.exports = { getCached, setCached, flushUserCache }