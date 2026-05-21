import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import api from '../../lib/api'

export default function UploadZone({ onUploadComplete }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')

  const inputRef = useRef()

  const handleFile = async (file) => {
    if (!file) return

    setUploading(true)
    setUploadMsg(`Uploading ${file.name}...`)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await api.post(
        '/api/documents/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      setUploadMsg(`${file.name} uploaded! Processing started.`)

      onUploadComplete?.(res.data)
    } catch (err) {
      setUploadMsg(
        `Upload failed: ${
          err.response?.data?.error || err.message
        }`
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)

        handleFile(e.dataTransfer.files[0])
      }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-6 ${
        dragging
          ? 'border-blue-400 bg-blue-950'
          : 'border-gray-700 hover:border-gray-500'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.pptx,.txt,.md"
        onChange={(e) => handleFile(e.target.files[0])}
      />

      <Upload
        size={28}
        className="mx-auto mb-3 text-gray-400"
      />

      <p className="text-white font-medium">
        {uploading
          ? uploadMsg
          : 'Drop a file here or click to upload'}
      </p>

      <p className="text-gray-500 text-sm mt-1">
        PDF, DOCX, PPTX, TXT up to 50MB
      </p>

      {uploadMsg && !uploading && (
        <p className="text-green-400 text-sm mt-2">
          {uploadMsg}
        </p>
      )}
    </div>
  )
}