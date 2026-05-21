const express  = require('express')
const { supabaseAdmin } = require('../config/supabase')
const { getCached, setCached } = require('../utils/searchCache')
const router   = express.Router()

// POST /api/search
router.post('/', async (req, res) => {
  try {
    const { query, top_k = 5 } = req.body
    const userId = req.user.id

    if (!query?.trim())
      return res.status(400).json({ error: 'Query is required' })

    // ── Step 1: Check Redis cache ────────────────
    const cached = await getCached(query, userId)
    if (cached) {
      console.log(`[Search] Cache HIT for: "${query}"`)
      return res.json({ ...cached, cache_hit: true })
    }

    console.log(`[Search] Cache MISS — calling AI service: "${query}"`)

    // ── Step 2: Call Python AI service ───────────
    const aiRes = await fetch(
      `${process.env.AI_SERVICE_URL}/search`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, user_id: userId, top_k })
      }
    )

    if (!aiRes.ok)
      throw new Error(`AI service error: ${aiRes.status}`)

    const aiData = await aiRes.json()

    // ── Step 3: Enrich with document metadata ────
    // Get unique document IDs from results
    const docIds = [...new Set(
      aiData.results.map(r => r.document_id).filter(Boolean)
    )]

    let docsMap = {}
    if (docIds.length) {
      const { data: docs } = await supabaseAdmin
        .from('documents')
        .select('id, name, source, file_path')
        .in('id', docIds)

      docsMap = Object.fromEntries((docs || []).map(d => [d.id, d]))
    }

    // Attach document info to each result
    const enriched = aiData.results.map(r => ({
      ...r,
      file_name: docsMap[r.document_id]?.name   || 'Unknown',
      source:    docsMap[r.document_id]?.source  || 'upload',
    }))

    const response = {
      results:       enriched,
      image_results: aiData.image_results || [],
      query,
      total:         enriched.length,
      cache_hit:     false
    }

    // ── Step 4: Cache the results ────────────────
    await setCached(query, userId, response)

    res.json(response)

  } catch (err) {
    console.error('[Search]', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router