const express  = require('express')
const { google } = require('googleapis')
const { supabaseAdmin } = require('../../config/supabase')
const router     = express.Router()
const authMiddleware = require('../../middleware/auth')

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

// Step 1: Redirect to Google consent
router.get('/auth', authMiddleware, (req, res) => {
  const oauth2 = getOAuth2Client()
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    scope:       ['https://www.googleapis.com/auth/drive.readonly'],
    state:       req.user.id    // pass user_id through OAuth
  })
  res.redirect(url)
})

// Step 2: Google redirects here with code
router.get('/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query
    const oauth2 = getOAuth2Client()
    const { tokens } = await oauth2.getToken(code)

    await supabaseAdmin.from('connectors').upsert({
      user_id:       userId,
      type:          'google_drive',
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      is_active:     true
    }, { onConflict: 'user_id,type' })

    res.redirect('http://localhost:5173/dashboard?connected=google')
  } catch (err) {
    console.error('[Google callback]', err)
    res.redirect('http://localhost:5173/dashboard?error=google_auth_failed')
  }
})

// Sync Drive files — delta sync using page_token
router.post('/sync', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    const { data: connector } = await supabaseAdmin.from('connectors')
      .select('*').eq('user_id', userId)
      .eq('type', 'google_drive').single()

    if (!connector)
      return res.status(404).json({ error: 'Google Drive not connected' })

    const oauth2 = getOAuth2Client()
    oauth2.setCredentials({
      access_token:  connector.access_token,
      refresh_token: connector.refresh_token
    })

    // Auto-refresh expired tokens
    oauth2.on('tokens', async (newTokens) => {
      await supabaseAdmin.from('connectors')
        .update({ access_token: newTokens.access_token })
        .eq('id', connector.id)
    })

    const drive = google.drive({ version: 'v3', auth: oauth2 })

    const listParams = {
      pageSize: 100,
      fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size)',
      q: "trashed=false and (" +
        "mimeType='application/pdf' or " +
        "mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or " +
        "mimeType='application/vnd.google-apps.document' or " +
        "mimeType='text/plain')"
    }

    // Use stored page_token for delta sync
    if (connector.page_token) listParams.pageToken = connector.page_token

    const listRes = await drive.files.list(listParams)
    const files   = listRes.data.files || []

    if (!files.length)
      return res.json({ message: 'No new files to sync', synced: 0 })

    const dispatched = []

    for (const file of files) {
      try {
        // Check if already ingested and not modified (delta sync)
        const { data: existing } = await supabaseAdmin.from('documents')
          .select('id, external_modified_at')
          .eq('external_file_id', file.id)
          .eq('user_id', userId)
          .single()

        if (existing) {
          const notChanged = new Date(file.modifiedTime) <=
                             new Date(existing.external_modified_at)
          if (notChanged) {
            console.log(`[Google] Skipping unchanged: ${file.name}`)
            continue
          }
        }

        // Download file content
        let fileBuffer, fileName = file.name, mimeType = file.mimeType

        if (file.mimeType === 'application/vnd.google-apps.document') {
          // Export Google Docs as PDF
          const exportRes = await drive.files.export(
            { fileId: file.id, mimeType: 'application/pdf' },
            { responseType: 'arraybuffer' }
          )
          fileBuffer = Buffer.from(exportRes.data)
          fileName   = file.name + '.pdf'
          mimeType   = 'application/pdf'
        } else {
          const dlRes = await drive.files.get(
            { fileId: file.id, alt: 'media' },
            { responseType: 'arraybuffer' }
          )
          fileBuffer = Buffer.from(dlRes.data)
        }

        // Upload to Supabase Storage
        const storagePath = `${userId}/drive-${file.id}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
        const { error: uploadErr } = await supabaseAdmin.storage.from('documents')
          .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true })

        if (uploadErr) throw uploadErr

        const { data: signed } = await supabaseAdmin.storage
          .from('documents').createSignedUrl(storagePath, 86400)

        // Upsert document row
        const docData = {
          user_id: userId, name: fileName, source: 'google_drive',
          file_path: storagePath, mime_type: mimeType,
          file_size: fileBuffer.length, status: 'pending',
          external_file_id: file.id,
          external_modified_at: file.modifiedTime
        }

        let docId
        if (existing) {
          const { data: d } = await supabaseAdmin.from('documents')
            .update(docData).eq('id', existing.id).select().single()
          docId = d.id
        } else {
          const { data: d } = await supabaseAdmin.from('documents')
            .insert(docData).select().single()
          docId = d.id
        }

        // Create job + dispatch Celery task
        const { data: job } = await supabaseAdmin.from('jobs')
          .insert({ document_id: docId, status: 'pending' })
          .select().single()

        const aiRes = await fetch(`${process.env.AI_SERVICE_URL}/dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: docId,
            file_url:    signed.signedUrl,
            file_name:   fileName,
            user_id:     userId
          })
        })

        const { task_id } = await aiRes.json()
        await supabaseAdmin.from('jobs')
          .update({ celery_task_id: task_id }).eq('id', job.id)

        dispatched.push({ file_name: fileName, task_id })

      } catch (fileErr) {
        console.error(`[Google] Failed: ${file.name}`, fileErr.message)
      }
    }

    // Save page_token for next delta sync
    if (listRes.data.nextPageToken) {
      await supabaseAdmin.from('connectors').update({
        page_token:         listRes.data.nextPageToken,
        last_synced_at:     new Date().toISOString(),
        total_files_synced: connector.total_files_synced + dispatched.length
      }).eq('id', connector.id)
    }

    res.json({ synced: dispatched.length, files: dispatched })

  } catch (err) {
    console.error('[Google sync]', err)
    res.status(500).json({ error: err.message })
  }
})

// Status check
router.get('/status', authMiddleware, async (req, res) => {
  const { data } = await supabaseAdmin.from('connectors')
    .select('type, is_active, last_synced_at, total_files_synced')
    .eq('user_id', req.user.id).eq('type', 'google_drive').single()
  res.json({ connected: !!data, connector: data || null })
})

module.exports = router