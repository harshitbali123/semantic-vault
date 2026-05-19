const express = require('express')
const supabase = require('../../config/supabase')

const router = express.Router()

// GET /api/connectors
// List all connected services for current user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('connectors')
      .select(`
        id,
        type,
        is_active,
        last_synced_at,
        total_files_synced,
        created_at
      `)
      .eq('user_id', req.user.id)

    if (error) throw error

    res.json({
      connectors: data || []
    })

  } catch (err) {
    console.error('[Connectors list]', err)

    res.status(500).json({
      error: err.message
    })
  }
})


// DELETE /api/connectors/:type
// Disconnect a connector
router.delete('/:type', async (req, res) => {
  try {
    const { error } = await supabase
      .from('connectors')
      .delete()
      .eq('user_id', req.user.id)
      .eq('type', req.params.type)

    if (error) throw error

    res.json({
      message: `${req.params.type} disconnected`
    })

  } catch (err) {
    console.error('[Connector delete]', err)

    res.status(500).json({
      error: err.message
    })
  }
})

module.exports = router