const express = require('express')
const multer = require('multer')
const path = require('path')

const { supabaseAdmin } = require('../config/supabase')

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


// ── Upload route ────────────────────────────────

router.post(
  '/upload',
  upload.single('file'),

  async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded'
        })
      }

      const userId = 'demo-user'
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

      console.log('[Backend] signed url created for:', storagePath)

      console.log(
        '[Backend] Uploaded:',
        storagePath
      )

      // Call AI service dispatch endpoint
      const response = await fetch(
        `${process.env.AI_SERVICE_URL}/dispatch`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            document_id: crypto.randomUUID(),
            file_url: fileUrl,
            file_name: req.file.originalname,
            user_id: userId
          })
        }
      )

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

      return res.json({
        success: true,
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

router.get('/jobs/:taskId', async (req, res) => {

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

    return res.json(data)

  } catch (err) {

    return res.status(500).json({
      error: err.message
    })
  }
})

module.exports = router