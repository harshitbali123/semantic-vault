import { useEffect, useState } from 'react'

import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react'

import api from '../lib/api'

import UploadZone from '../components/documents/UploadZone'
import JobStatus from '../components/documents/JobStatus'

const sourceColors = {
  upload: 'bg-blue-900 text-blue-300',
  google_drive: 'bg-green-900 text-green-300',
  notion: 'bg-purple-900 text-purple-300',
}

const statusIcon = {
  done: (
    <CheckCircle
      size={14}
      className="text-green-400"
    />
  ),

  processing: (
    <Clock
      size={14}
      className="text-yellow-400"
    />
  ),

  pending: (
    <Clock
      size={14}
      className="text-gray-400"
    />
  ),

  error: (
    <AlertCircle
      size={14}
      className="text-red-400"
    />
  ),
}

export default function Documents() {
  const [documents, setDocuments] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const [activeJobs, setActiveJobs] = useState({})

  const fetchDocs = async () => {
    const res = await api.get('/api/documents')

    setDocuments(res.data.documents || [])

    setLoading(false)
  }

  useEffect(() => {
    fetchDocs()
  }, [])

  const handleUploadComplete = (data) => {
    setActiveJobs((prev) => ({
      ...prev,
      [data.document_id]: data.task_id,
    }))

    setTimeout(fetchDocs, 1000)
  }

  const handleJobDone = (docId) => {
    setActiveJobs((prev) => {
      const n = { ...prev }

      delete n[docId]

      return n
    })

    fetchDocs()
  }

  const filters = [
    'all',
    'upload',
    'google_drive',
    'notion',
  ]

  const filtered =
    filter === 'all'
      ? documents
      : documents.filter((d) => d.source === filter)

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">
        Documents
      </h1>

      <p className="text-gray-400 mb-6">
        All files indexed in your knowledge base
      </p>

      <UploadZone
        onUploadComplete={handleUploadComplete}
      />

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all'
              ? 'All'
              : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Documents */}
      {loading ? (
        <p className="text-gray-400">
          Loading documents...
        </p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FileText
            size={40}
            className="mx-auto mb-3 opacity-30"
          />

          <p>
            No documents found. Upload a file to get
            started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4"
            >
              <FileText
                size={16}
                className="text-gray-400 flex-shrink-0"
              />

              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {doc.name}
                </p>

                <p className="text-gray-500 text-xs mt-0.5">
                  {new Date(
                    doc.created_at
                  ).toLocaleDateString()}

                  {doc.file_size &&
                    ` · ${(
                      doc.file_size / 1024
                    ).toFixed(0)}KB`}
                </p>
              </div>

              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  sourceColors[doc.source] ||
                  'bg-gray-800 text-gray-300'
                }`}
              >
                {doc.source?.replace('_', ' ')}
              </span>

              {activeJobs[doc.id] ? (
                <JobStatus
                  taskId={activeJobs[doc.id]}
                  onDone={() =>
                    handleJobDone(doc.id)
                  }
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  {statusIcon[doc.status]}

                  <span className="text-xs text-gray-400">
                    {doc.status}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}