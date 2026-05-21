const Redis = require('ioredis')

// Use separate Redis DB for cache (DB 2)
// DB 0 = Celery broker, DB 1 = Celery results, DB 2 = search cache
const cache = new Redis({
  host:     process.env.REDIS_HOST || 'redis',
  port:     parseInt(process.env.REDIS_PORT || '6379'),
  db:       2,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 3) return null   // stop retrying after 3 attempts
    return Math.min(times * 200, 2000)
  }
})

cache.on('connect',  () => console.log('[Redis Cache] Connected (DB 2)'))
cache.on('error',    (err) => console.error('[Redis Cache] Error:', err.message))

module.exports = cache