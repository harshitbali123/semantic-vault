import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Cable,
  Search,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react'

import api from '../lib/api'
import { supabase } from '../lib/supabase'

const statusIcon = {
  done: <CheckCircle size={14} className="text-green-400" />,
  processing: <Clock size={14} className="text-yellow-400" />,
  pending: <Clock size={14} className="text-gray-400" />,
  error: <AlertCircle size={14} className="text-red-400" />,
}

export default function Dashboard() {
  const [documents, setDocuments] = useState([])
  const [connectors, setConnectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  const refreshTimerRef = useRef(null)

  const navigate = useNavigate()

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, name, source, file_path, mime_type, file_size, status, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    setDocuments(data || [])
  }

  const fetchConnectors = async () => {
    const { data, error } = await supabase
      .from('connectors')
      .select('id, type, is_active, last_synced_at, total_files_synced, created_at')

    if (error) throw error

    setConnectors(data || [])
  }

  const syncGoogleDrive = async () => {
    setSyncing(true)
    setSyncMessage('')

    try {
      const res = await api.post('/api/connectors/google/sync')
      const synced = res.data?.synced ?? 0
      setSyncMessage(
        synced > 0
          ? `Google Drive sync started for ${synced} file(s).`
          : 'Google Drive is connected. No new files to sync.'
      )
      await fetchDashboardData()
    } catch (err) {
      setSyncMessage(
        err.response?.data?.error || err.message || 'Sync failed.'
      )
    } finally {
      setSyncing(false)
    }
  }

  const fetchDashboardData = async () => {
    const results = await Promise.allSettled([
      fetchDocuments(),
      fetchConnectors(),
    ])

    const hadSuccess = results.some((result) => result.status === 'fulfilled')

    if (hadSuccess) {
      setUpdatedAt(new Date())
    }

    const rejected = results.find((result) => result.status === 'rejected')
    if (rejected) {
      console.error(rejected.reason)
    }
  }

  useEffect(() => {
    let mounted = true

    const refresh = async () => {
      try {
        await fetchDashboardData()
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    refresh()

    refreshTimerRef.current = setInterval(refresh, 15000)

    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'documents',
      }, refresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'connectors',
      }, refresh)
      .subscribe()

    const handleFocus = () => refresh()
    window.addEventListener('focus', handleFocus)

    return () => {
      mounted = false
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
      window.removeEventListener('focus', handleFocus)
      supabase.removeChannel(channel)
    }
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

      {updatedAt && (
        <p className="text-xs text-gray-500 mb-4">
          Live as of {updatedAt.toLocaleTimeString()}
        </p>
      )}

      {syncMessage && (
        <p className="text-xs text-gray-400 mb-4">
          {syncMessage}
        </p>
      )}

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

        {/* Right Side */}
        <div className="flex flex-col gap-4">

          {/* Connectors */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-semibold text-white mb-4">
              Connectors
            </h2>

            {['google_drive'].map((type) => {
              const c = connectors.find((x) => x.type === type)
              const canSync = Boolean(c)

              return (
                <div
                  key={type}
                  className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
                >
                  <span className="text-sm text-white capitalize">
                    {type.replace('_', ' ')}
                  </span>

                  <div className="flex items-center gap-2">
                    {c ? (
                      <span className="text-xs text-green-400">
                        Connected
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">
                        Not connected
                      </span>
                    )}

                    {canSync ? (
                      <button
                        onClick={syncGoogleDrive}
                        disabled={syncing}
                        className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                      >
                        {syncing ? 'Syncing...' : 'Sync now'}
                      </button>
                    ) : !c ? (
                      <button
                        onClick={() => navigate('/connectors')}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Connect
                      </button>
                    ) : null}
                  </div>
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