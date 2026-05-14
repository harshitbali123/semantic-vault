const express = require('express')
const cors = require('cors')

require('dotenv').config()

const authMiddleware = require('./middleware/auth')
const authRoutes = require('./routes/auth')

const app = express()

app.use(cors({
  origin: 'http://localhost:5173'
}))

app.use(express.json())

// Public routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)

// All routes below require auth
app.use('/api', authMiddleware)

// Protected test route
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Auth working',
    user: req.user.email
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err)
  res.status(500).json({
    error: err.message || 'Internal server error'
  })
})

const PORT = process.env.PORT || 3000

const server = app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`)
})

server.on('error', (err) => {
  console.error('Server error:', err)
  process.exit(1)
})

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason)
})