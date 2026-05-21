const express = require('express')
const multer = require('multer')
const path = require('path')
const { randomUUID } = require('crypto')

const { supabaseAdmin } = require('../config/supabase')
const authMiddleware = require('../middleware/auth')
const { flushUserCache } = require('../utils/searchCache')

const router = express.Router()

// ── Multer config ───────────────────────────────

const storage = multer.memoryStorage()


const upload = multer({

  storage,

  limits: {
    fileSize: 50 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {

    const allowed = [
      '.pdf',
      '.docx',
      '.pptx',
      '.txt',
      '.md'
    ]

    const ext =
      path.extname(file.originalname).toLowerCase()

    if (allowed.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`Unsupported file type: ${ext}`))
    }
  }
})

const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || 'documents'


function buildStoragePath(fileName, userId) {

  const safeName =
    fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')

  return `${userId}/${Date.now()}-${safeName}`
}


// ── Documents list route ────────────────────────

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select(
        'id, name, source, file_path, mime_type, file_size, status, created_at, updated_at'
      )
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json({
      documents: data || []
    })
  } catch (err) {
    console.error('[Documents list]', err)
    res.status(500).json({
      error: err.message
    })
  }
})

async function dispatchToAiService(payload, retries = 3) {
  let lastErr

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(
        `${process.env.AI_SERVICE_URL}/dispatch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      )

      return response
    } catch (err) {
      lastErr = err

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
      }
    }
  }

  throw lastErr
}


// ── Upload route ────────────────────────────────

router.post(
  '/upload',
  authMiddleware,
  upload.single('file'),

  async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded'
        })
      }

      const userId = req.user.id
      const storagePath = buildStoragePath(
        req.file.originalname,
        userId
      )

      const { error: uploadErr } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        })

      if (uploadErr) {
        return res.status(500).json({
          error: uploadErr.message
        })
      }

      console.log('[Backend] uploaded to storage:', storagePath)

      const signedUrlResult = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 60 * 60)

      if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
        return res.status(500).json({
          error: signedUrlResult.error?.message || 'Failed to create signed URL'
        })
      }

      const fileUrl = signedUrlResult.data.signedUrl

      const documentId = randomUUID()

      console.log('[Backend] signed url created for:', storagePath)

      console.log(
        '[Backend] Uploaded:',
        storagePath
      )

      const { data: documentRow, error: documentErr } = await supabaseAdmin
        .from('documents')
        .insert({
          id: documentId,
          user_id: userId,
          name: req.file.originalname,
          source: 'upload',
          file_path: storagePath,
          mime_type: req.file.mimetype,
          file_size: req.file.size,
          status: 'pending'
        })
        .select()
        .single()

      if (documentErr) {
        console.error('[Backend] document insert failed:', documentErr)
        return res.status(500).json({
          error: documentErr.message
        })
      }

      console.log('[Backend] document row created:', documentRow.id)

      const { data: jobRow, error: jobErr } = await supabaseAdmin
        .from('jobs')
        .insert({
          document_id: documentRow.id,
          status: 'pending'
        })
        .select()
        .single()

      if (jobErr) {
        console.error('[Backend] job insert failed:', jobErr)
        return res.status(500).json({
          error: jobErr.message
        })
      }

      console.log('[Backend] job row created:', jobRow.id)

      // Call AI service dispatch endpoint
      const response = await dispatchToAiService({
        document_id: documentRow.id,
        file_url: fileUrl,
        file_name: req.file.originalname,
        mime_type: req.file.mimetype,
        user_id: userId
      })

      console.log('[Backend] celery dispatched for:', storagePath)

      const contentType = response.headers.get('content-type') || ''
      const bodyText = await response.text()

      if (!response.ok) {
        return res.status(response.status).json({
          error: bodyText || 'AI service request failed'
        })
      }

      const data = contentType.includes('application/json')
        ? JSON.parse(bodyText)
        : { raw: bodyText }

      if (data?.task_id) {
        await supabaseAdmin
          .from('jobs')
          .update({ celery_task_id: data.task_id })
          .eq('id', jobRow.id)
      }

      return res.json({
        success: true,
        document_id: documentRow.id,
        task_id: data?.task_id,
        task: data
      })

    } catch (err) {

      console.error(err)

      return res.status(500).json({
        error: err.message
      })
    }
  }
)


// ── Task status route ───────────────────────────

router.get('/jobs/:taskId', authMiddleware, async (req, res) => {

  try {

    const response = await fetch(
      `${process.env.AI_SERVICE_URL}/status/${req.params.taskId}`
    )

    const contentType = response.headers.get('content-type') || ''
    const bodyText = await response.text()

    if (!response.ok) {
      return res.status(response.status).json({
        error: bodyText || 'AI service request failed'
      })
    }

    const data = contentType.includes('application/json')
      ? JSON.parse(bodyText)
      : { raw: bodyText }

    // If job just completed, flush search cache so new doc is searchable
    try {
      if (data.status === 'SUCCESS') {
        await flushUserCache(req.user.id)
      }
    } catch (err) {
      console.error('[Backend] flushUserCache failed:', err)
    }

    return res.json(data)

  } catch (err) {

    return res.status(500).json({
      error: err.message
    })
  }
})

module.exports = router