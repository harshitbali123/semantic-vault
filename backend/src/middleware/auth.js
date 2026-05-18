const { supabase } = require('../config/supabase')

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization: Bearer <token>
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing authorization header'
      })
    }

    const token = authHeader.split(' ')[1]

    // Verify JWT with Supabase
    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid or expired token'
      })
    }

    // Attach user to req
    req.user = user

    next()

  } catch (err) {
    console.error('Auth middleware error:', err)

    return res.status(500).json({
      error: 'Internal server error'
    })
  }
}

module.exports = authMiddleware