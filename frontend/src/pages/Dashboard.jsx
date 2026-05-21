import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  FileText,
  Cable,
  Search,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react'

import api from '../lib/api'

const statusIcon = {
  done: <CheckCircle size={14} className="text-green-400" />,
  processing: <Clock size={14} className="text-yellow-400" />,
  pending: <Clock size={14} className="text-gray-400" />,
  error: <AlertCircle size={14} className="text-red-400" />,
}

const sourceBadge = {
  upload: 'bg-blue-900 text-blue-300',
  google_drive: 'bg-green-900 text-green-300',
  notion: 'bg-purple-900 text-purple-300',
}

export default function Dashboard() {
  const [documents, setDocuments] = useState([])
  const [connectors, setConnectors] = useState([])
  const [loading, setLoading] = useState(true)

  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.get('/api/documents'),
      api.get('/api/connectors'),
    ])
      .then(([docsRes, connRes]) => {
        setDocuments(docsRes.data.documents || [])
        setConnectors(connRes.data.connectors || [])
      })
      .catch((err) => {
        console.error(err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const stats = [
    {
      label: 'Total Documents',
      value: documents.length,
      color: 'text-blue-400',
    },
    {
      label: 'Done',
      value: documents.filter((d) => d.status === 'done').length,
      color: 'text-green-400',
    },
    {
      label: 'Processing',
      value: documents.filter(
        (d) => d.status === 'processing' || d.status === 'pending'
      ).length,
      color: 'text-yellow-400',
    },
    {
      label: 'Connectors',
      value: connectors.length,
      color: 'text-purple-400',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">
        Dashboard
      </h1>

      <p className="text-gray-400 mb-8">
        Overview of your knowledge base
      </p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5"
          >
            <div className={`text-3xl font-bold ${s.color}`}>
              {s.value}
            </div>

            <div className="text-gray-400 text-sm mt-1">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* Recent Documents */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">
              Recent Documents
            </h2>

            <button
              onClick={() => navigate('/documents')}
              className="text-blue-400 text-sm hover:text-blue-300"
            >
              View all
            </button>
          </div>

          {documents.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No documents yet. Upload one!
            </p>
          ) : (
            documents.slice(0, 5).map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0"
              >
                <FileText
                  size={14}
                  className="text-gray-400 flex-shrink-0"
                />

                <span className="text-sm text-white flex-1 truncate">
                  {doc.name}
                </span>

                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    sourceBadge[doc.source] ||
                    'bg-gray-800 text-gray-300'
                  }`}
                >
                  {doc.source}
                </span>

                {statusIcon[doc.status]}
              </div>
            ))
          )}
        </div>

        {/* Right Side */}
        <div className="flex flex-col gap-4">

          {/* Connectors */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-semibold text-white mb-4">
              Connectors
            </h2>

            {['google_drive'].map((type) => {
              const c = connectors.find((x) => x.type === type)

              return (
                <div
                  key={type}
                  className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
                >
                  <span className="text-sm text-white capitalize">
                    {type.replace('_', ' ')}
                  </span>

                  {c ? (
                    <span className="text-xs text-green-400">
                      Connected
                    </span>
                  ) : (
                    <button
                      onClick={() => navigate('/connectors')}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Connect
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-semibold text-white mb-4">
              Quick Actions
            </h2>

            <div className="flex flex-col gap-2">
              {[
                {
                  label: 'Upload File',
                  icon: Upload,
                  to: '/documents',
                },
                {
                  label: 'Manage Connectors',
                  icon: Cable,
                  to: '/connectors',
                },
                {
                  label: 'Search Documents',
                  icon: Search,
                  to: '/search',
                },
              ].map(({ label, icon: Icon, to }) => (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white transition-colors text-left"
                >
                  <Icon
                    size={14}
                    className="text-blue-400"
                  />

                  {label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}