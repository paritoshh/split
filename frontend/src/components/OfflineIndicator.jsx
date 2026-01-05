/**
 * ===========================================
 * OFFLINE INDICATOR COMPONENT
 * ===========================================
 * Shows online/offline status and last sync time.
 * ===========================================
 */

import React, { useState, useEffect, useRef } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
// Use static imports for better offline support (works with Service Worker cache)
import { offlineDetector } from '../services/offline/detector'
import { apiCache } from '../services/offline/cache'

function OfflineIndicator() {
  // Initialize with safe default - use navigator.onLine directly
  const [isOnline, setIsOnline] = useState(() => {
    try {
      return typeof navigator !== 'undefined' && navigator.onLine !== undefined 
        ? navigator.onLine 
        : true
    } catch (error) {
      console.warn('Error getting offline status:', error)
      return true
    }
  })
  const [lastSync, setLastSync] = useState(null)
  const unsubscribeRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    
    // Listen to browser events as primary method (works offline)
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
    
    // Try to initialize offline detector (may fail in offline mode, but browser events will work)
    try {
      // Set initial status from detector if available
      if (offlineDetector && mountedRef.current) {
        setIsOnline(offlineDetector.getStatus())
        
        // Subscribe to status changes (only once)
        if (!unsubscribeRef.current) {
          unsubscribeRef.current = offlineDetector.onStatusChange((online) => {
            if (mountedRef.current) {
              setIsOnline(online)
              if (online) {
                // When coming online, try to update last sync
                updateLastSync()
              }
            }
          })
        }
      }
      
      // Try to get last sync time
      updateLastSync()
    } catch (error) {
      // Fallback to browser events only - this is fine
      console.warn('Error initializing offline services (offline mode):', error)
    }
    
    return () => {
      mountedRef.current = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [])

  const updateLastSync = async () => {
    if (!mountedRef.current) return
    try {
      if (apiCache) {
        const syncTime = await apiCache.getLastSync()
        if (syncTime && mountedRef.current) {
          setLastSync(syncTime)
        }
      }
    } catch (error) {
      // Silently ignore cache errors - not critical for offline indicator
      // This is expected in offline mode if IndexedDB isn't available
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

