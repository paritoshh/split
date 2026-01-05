/**
 * ===========================================
 * SYNC INDICATOR COMPONENT
 * ===========================================
 * Shows sync status (pending, syncing, completed, failed)
 * ===========================================
 */

import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { onSyncStatusChange } from '../services/offline/syncService.js'

function SyncIndicator() {
  const [status, setStatus] = useState('idle') // idle, syncing, error
  const [pendingCount, setPendingCount] = useState(0)
  const [syncingCount, setSyncingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)

  useEffect(() => {
    const unsubscribe = onSyncStatusChange((syncStatus) => {
      setStatus(syncStatus.status)
      setPendingCount(syncStatus.pendingCount || 0)
      setSyncingCount(syncStatus.syncingCount || 0)
      setFailedCount(syncStatus.failedCount || 0)
    })

    return unsubscribe
  }, [])

  // Don't show if nothing to sync
  if (pendingCount === 0 && syncingCount === 0 && failedCount === 0) {
    return null
  }

  // Show syncing status
  if (status === 'syncing' || syncingCount > 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>
          Syncing {syncingCount > 0 ? `${syncingCount} ` : ''}
          {pendingCount > 0 ? `(${pendingCount} pending)` : ''}
        </span>
      </div>
    )
  }

  // Show failed status
  if (failedCount > 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>{failedCount} failed to sync</span>
      </div>
    )
  }

  // Show pending status
  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">
        <Clock className="w-3.5 h-3.5" />
        <span>{pendingCount} pending</span>
      </div>
    )
  }

  // Show completed (briefly)
  if (status === 'idle' && pendingCount === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">
        <CheckCircle className="w-3.5 h-3.5" />
        <span>All synced</span>
      </div>
    )
  }

  return null
}

export default SyncIndicator

