import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  Link,
} from 'lucide-react'

import api from '../lib/api'

const CONNECTORS = [
  {
    type: 'google_drive',
    label: 'Google Drive',
    desc: 'Sync PDFs, Docs, and text files from your Drive',
    color: 'text-green-400',

    authUrl:
      '/api/connectors/google/auth-url',

    syncUrl:
      '/api/connectors/google/sync',
  },
]

export default function Connectors() {
  const [connectors, setConnectors] = useState([])

  const [syncing, setSyncing] = useState({})

  const [syncResult, setSyncResult] = useState({})

  const [searchParams] = useSearchParams()

  useEffect(() => {
    fetchConnectors()

    const connected =
      searchParams.get('connected')

    const error =
      searchParams.get('error')

    if (connected) {
      alert(
        `${connected} connected successfully!`
      )
    }

    if (error) {
      alert(`Connection failed: ${error}`)
    }
  }, [])

  const fetchConnectors = async () => {
    const res = await api.get('/api/connectors')

    setConnectors(
      res.data.connectors || []
    )
  }

  const handleConnect = async (authUrl) => {
    try {
      const res = await api.get(authUrl)

      if (res.data?.authUrl) {
        window.location.href = res.data.authUrl
      }
    } catch (err) {
      alert(
        `Failed to start connector auth: ${
          err.response?.data?.error || err.message
        }`
      )
    }
  }

  const handleSync = async (connector) => {
    setSyncing((prev) => ({
      ...prev,
      [connector.type]: true,
    }))

    setSyncResult((prev) => ({
      ...prev,
      [connector.type]: null,
    }))

    try {
      const res = await api.post(
        connector.syncUrl
      )

      setSyncResult((prev) => ({
        ...prev,
        [connector.type]:
          `Synced ${res.data.synced} files`,
      }))

      fetchConnectors()
    } catch (err) {
      setSyncResult((prev) => ({
        ...prev,
        [connector.type]:
          `Error: ${
            err.response?.data?.error ||
            err.message
          }`,
      }))
    } finally {
      setSyncing((prev) => ({
        ...prev,
        [connector.type]: false,
      }))
    }
  }

  const handleDisconnect = async (type) => {
    const confirmed = confirm(
      `Disconnect ${type.replace('_', ' ')}?`
    )

    if (!confirmed) return

    await api.delete(
      `/api/connectors/${type}`
    )

    fetchConnectors()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">
        Connectors
      </h1>

      <p className="text-gray-400 mb-8">
        Connect cloud services to sync your files
      </p>

      <div className="grid grid-cols-2 gap-6">
        {CONNECTORS.map((conn) => {
          const active = connectors.find(
            (c) => c.type === conn.type
          )

          const isSyncing =
            syncing[conn.type]

          const result =
            syncResult[conn.type]

          return (
            <div
              key={conn.type}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2
                    className={`font-semibold text-lg ${conn.color}`}
                  >
                    {conn.label}
                  </h2>

                  <p className="text-gray-400 text-sm mt-1">
                    {conn.desc}
                  </p>
                </div>

                {active ? (
                  <CheckCircle
                    size={20}
                    className="text-green-400 flex-shrink-0"
                  />
                ) : (
                  <XCircle
                    size={20}
                    className="text-gray-600 flex-shrink-0"
                  />
                )}
              </div>

              {/* Status */}
              {active && (
                <div className="text-xs text-gray-500 mb-4 space-y-1">
                  <p>
                    Last synced:{' '}
                    {active.last_synced_at
                      ? new Date(
                          active.last_synced_at
                        ).toLocaleString()
                      : 'Never'}
                  </p>

                  <p>
                    Files synced:{' '}
                    {active.total_files_synced ||
                      0}
                  </p>
                </div>
              )}

              {/* Result */}
              {result && (
                <p
                  className={`text-sm mb-3 ${
                    result.startsWith('Error')
                      ? 'text-red-400'
                      : 'text-green-400'
                  }`}
                >
                  {result}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {!active ? (
                  <button
                    onClick={() =>
                      handleConnect(
                        conn.authUrl
                      )
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors font-medium"
                  >
                    <Link size={14} />
                    Connect
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        handleSync(conn)
                      }
                      disabled={isSyncing}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                    >
                      <RefreshCw
                        size={14}
                        className={
                          isSyncing
                            ? 'animate-spin'
                            : ''
                        }
                      />

                      {isSyncing
                        ? 'Syncing...'
                        : 'Sync Now'}
                    </button>

                    <button
                      onClick={() =>
                        handleDisconnect(
                          conn.type
                        )
                      }
                      className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-red-300 text-sm rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}