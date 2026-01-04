/**
 * ===========================================
 * OFFLINE INDICATOR COMPONENT
 * ===========================================
 * Shows online/offline status and last sync time.
 * ===========================================
 */

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { offlineDetector } from '../services/offline/detector'
import { apiCache } from '../services/offline/cache'

function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(offlineDetector.getStatus())
  const [lastSync, setLastSync] = useState(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    // Subscribe to online/offline status changes
    const unsubscribe = offlineDetector.onStatusChange((online) => {
      setIsOnline(online)
      if (online) {
        // When coming online, update last sync
        updateLastSync()
      }
    })

    // Get initial last sync time
    updateLastSync()

    return unsubscribe
  }, [])

  const updateLastSync = async () => {
    const syncTime = await apiCache.getLastSync()
    if (syncTime) {
      setLastSync(syncTime)
    }
  }

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never'
    
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  if (isOnline) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Wifi className="w-3.5 h-3.5 text-green-400" />
        <span className="hidden sm:inline">Online</span>
        {lastSync && (
          <span className="hidden md:inline text-gray-500">
            • Synced {formatLastSync(lastSync)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline</span>
      {lastSync && (
        <span className="text-yellow-500/70">
          • Last synced {formatLastSync(lastSync)}
        </span>
      )}
    </div>
  )
}

export default OfflineIndicator

