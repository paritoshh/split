/**
 * ===========================================
 * OFFLINE INDICATOR COMPONENT
 * ===========================================
 * Shows online/offline status and last sync time.
 * ===========================================
 */

import React, { useState, useEffect } from 'react'
import { Wifi, WifiOff } from 'lucide-react'

function OfflineIndicator() {
  // Initialize with safe default - use navigator.onLine directly
  const [isOnline, setIsOnline] = useState(() => {
    try {
      return typeof navigator !== 'undefined' ? navigator.onLine : true
    } catch (error) {
      console.warn('Error getting offline status:', error)
      return true
    }
  })
  const [lastSync, setLastSync] = useState(null)

  useEffect(() => {
    // Dynamically import to avoid circular dependencies
    let offlineDetector = null
    let apiCache = null
    
    const initOffline = async () => {
      try {
        const detectorModule = await import('../services/offline/detector')
        const cacheModule = await import('../services/offline/cache')
        offlineDetector = detectorModule.offlineDetector
        apiCache = cacheModule.apiCache
        
        // Set initial status
        if (offlineDetector) {
          setIsOnline(offlineDetector.getStatus())
        }
        
        // Subscribe to online/offline status changes
        if (offlineDetector) {
          const unsubscribe = offlineDetector.onStatusChange((online) => {
            setIsOnline(online)
            if (online && apiCache) {
              // When coming online, update last sync
              updateLastSync(apiCache)
            }
          })
          
          // Get initial last sync time
          if (apiCache) {
            updateLastSync(apiCache)
          }
          
          return unsubscribe
        }
      } catch (error) {
        console.warn('Error initializing offline detector:', error)
      }
    }
    
    // Listen to browser events as fallback
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    const cleanup = initOffline()
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (cleanup && typeof cleanup.then === 'function') {
        cleanup.then(unsubscribe => {
          if (typeof unsubscribe === 'function') {
            unsubscribe()
          }
        })
      }
    }
  }, [])

  const updateLastSync = async (cacheService) => {
    if (!cacheService) return
    try {
      const syncTime = await cacheService.getLastSync()
      if (syncTime) {
        setLastSync(syncTime)
      }
    } catch (error) {
      console.warn('Error getting last sync time:', error)
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

