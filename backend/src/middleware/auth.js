const { supabase } = require('../config/supabase')

const authMiddleware = async (req, res, next) => {
  try {
    // Check Authorization header first, then query param (for EventSource)
    const authHeader = req.headers.authorization
    const headerToken = (authHeader && authHeader.startsWith('Bearer '))
      ? authHeader.split(' ')[1]
      : null
    const queryToken = req.query && req.query.token
    const token = headerToken || queryToken

    if (!token) {
      return res.status(401).json({ error: 'Missing authorization' })
    }

    // Verify JWT with Supabase
    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Attach user to req
    req.user = user

    next()

  } catch (err) {
    console.error('Auth middleware error:', err)

    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = authMiddleware