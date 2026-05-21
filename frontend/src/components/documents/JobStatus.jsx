import { useEffect, useState } from 'react'
import api from '../../lib/api'

export default function JobStatus({ taskId, onDone }) {
  const [status, setStatus] = useState('pending')

  useEffect(() => {
    if (!taskId) return

    const interval = setInterval(async () => {
      try {
        const res = await api.get(
          `/api/documents/jobs/${taskId}`
        )

        setStatus(res.data.status)

        if (
          res.data.status === 'SUCCESS' ||
          res.data.status === 'FAILURE'
        ) {
          clearInterval(interval)

          onDone?.(res.data.status)
        }
      } catch {
        clearInterval(interval)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [taskId])

  const colors = {
    pending: 'bg-gray-800 text-gray-300',
    PENDING: 'bg-gray-800 text-gray-300',

    STARTED: 'bg-yellow-900 text-yellow-300',
    started: 'bg-yellow-900 text-yellow-300',

    SUCCESS: 'bg-green-900 text-green-300',
    success: 'bg-green-900 text-green-300',

    FAILURE: 'bg-red-900 text-red-300',
    failure: 'bg-red-900 text-red-300',
  }

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${
        colors[status] || colors.pending
      }`}
    >
      {status.toLowerCase()}
    </span>
  )
}