const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const router = express.Router()


// ── Ensure uploads dir exists ───────────────────

const uploadDir =
  path.join(__dirname, '../../uploads')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}


// ── Multer config ───────────────────────────────

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },

  filename: (req, file, cb) => {

    const unique =
      `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`

    cb(null, unique)
  }
})


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

      const filePath =
        `/app/uploads/${req.file.filename}`

      console.log(
        '[Backend] Uploaded:',
        filePath
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
            file_path: filePath,
            user_id: 'demo-user'
          })
        }
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