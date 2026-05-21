const express  = require('express')
const { supabaseAdmin } = require('../config/supabase')
const authMiddleware = require('../middleware/auth')
const { fetchAiService } = require('../utils/aiService')
const router   = express.Router()

// GET /api/ask?question=...
// Uses GET so browser EventSource API works natively
router.get('/', authMiddleware, async (req, res) => {
  const { question } = req.query
  const userId = req.user.id

  if (!question?.trim()) {
    return res.status(400).json({ error: 'Question is required' })
  }

  // ── Set SSE headers ───────────────────────────
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  res.flushHeaders()

  try {
    // Pre-fetch document names so Python can cite them
    const { data: docs } = await supabaseAdmin
      .from('documents')
      .select('id, name')
      .eq('user_id', userId)

    const docNames = Object.fromEntries(
      (docs || []).map(d => [d.id, d.name])
    )

    // ── Stream from Python AI service ────────────
    const aiRes = await fetchAiService('/ask', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        user_id:   userId,
        doc_names: docNames
      })
    })

    if (!aiRes.ok) {
      res.write(`data: {"type":"error","content":"AI service unavailable. Please try again."}\n\n`)
      return res.end()
    }

    // ── Pipe Python SSE stream to browser ────────
    const reader = aiRes.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      res.write(chunk)   // forward raw SSE events as-is
    }

  } catch (err) {
    console.error('[Ask]', err)
    res.write(`data: {"type":"error","content":"Unable to reach the AI service right now. Please try again."}\n\n`)
  } finally {
    res.end()
  }
})

module.exports = router