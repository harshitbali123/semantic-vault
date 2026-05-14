const express = require('express')
const supabase = require('../config/supabase')

const router = express.Router()

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password required'
    })
  }

  const { data, error } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

  if (error) {
    return res.status(400).json({
      error: error.message
    })
  }

  res.json({
    message: 'User created',
    user: data.user
  })
})

// POST /api/auth/signin
router.post('/signin', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password required'
    })
  }

  try {
    console.log('Attempting signin for:', email)
    console.log('Supabase URL:', process.env.SUPABASE_URL)
    console.log('Supabase Key exists:', !!process.env.SUPABASE_ANON_KEY)
    
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      })

    if (error) {
      console.error('Supabase sign-in error:', JSON.stringify(error))
      return res.status(400).json({
        error: error.message || 'Authentication failed'
      })
    }

    console.log('Sign-in successful')
    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user
    })
  } catch (err) {
    console.error('Sign-in exception:', err.message)
    console.error('Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)))
    res.status(500).json({
      error: 'Failed to connect to authentication service',
      details: err.message
    })
  }
})

// POST /api/auth/signout
router.post('/signout', async (req, res) => {
  const token =
    req.headers.authorization?.split(' ')[1]

  if (token) {
    await supabase.auth.signOut(token)
  }

  res.json({
    message: 'Signed out'
  })
})

module.exports = router