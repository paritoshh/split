/**
 * ===========================================
 * OFFLINE INDICATOR COMPONENT
 * ===========================================
 * Shows online/offline status and last sync time.
 * Uses only browser APIs to avoid module loading issues.
 * ===========================================
 */

import { useState, useEffect, useRef } from 'react'
import { Wifi, WifiOff } from 'lucide-react'

function OfflineIndicator() {
  // Initialize with safe default - use navigator.onLine directly
  const [isOnline, setIsOnline] = useState(() => {
    try {
      return typeof navigator !== 'undefined' && navigator.onLine !== undefined 
        ? navigator.onLine 
        : true
    } catch (error) {
      return true
    }
  })
  const [lastSync, setLastSync] = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    
    // Listen to browser events (works offline, no module dependencies)
    const handleOnline = () => {
      if (mountedRef.current) {
        setIsOnline(true)
      }
    }
    const handleOffline = () => {
      if (mountedRef.current) {
        setIsOnline(false)
      }
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Try to get last sync time from IndexedDB (optional, non-blocking)
    // Use dynamic import to avoid circular dependencies
    const loadLastSync = async () => {
      try {
        // Only try to load if IndexedDB is available
        if (typeof indexedDB !== 'undefined') {
          const cacheModule = await import('../services/offline/cache')
          if (cacheModule.apiCache && mountedRef.current) {
            const syncTime = await cacheModule.apiCache.getLastSync()
            if (syncTime && mountedRef.current) {
              setLastSync(syncTime)
            }
          }
        }
      } catch (error) {
        // Silently ignore - not critical
      }
    }
    
    // Load last sync asynchronously (non-blocking)
    loadLastSync()
    
    return () => {
      mountedRef.current = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

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

