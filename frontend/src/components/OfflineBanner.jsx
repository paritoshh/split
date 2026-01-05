/**
 * ===========================================
 * OFFLINE BANNER COMPONENT
 * ===========================================
 * Prominent banner shown when offline to indicate
 * limited functionality and cached data usage.
 * ===========================================
 */

import { useState, useEffect, useRef } from 'react'
import { WifiOff, AlertCircle, X } from 'lucide-react'

function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => {
    try {
      return typeof navigator !== 'undefined' && navigator.onLine !== undefined 
        ? navigator.onLine 
        : true
    } catch (error) {
      return true
    }
  })
  const [isDismissed, setIsDismissed] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    
    // Test actual network connectivity
    const checkConnectivity = async () => {
      if (!mountedRef.current) return false
      
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve(false), 2000)
      })
      
      const fetchPromise = fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: AbortSignal.timeout(2000)
      }).then(() => true).catch(() => false)
      
      try {
        const result = await Promise.race([fetchPromise, timeoutPromise])
        return result === true
      } catch (error) {
        return false
      }
    }
    
    const updateStatus = async () => {
      if (!mountedRef.current) return
      const actuallyOnline = await checkConnectivity()
      if (mountedRef.current) {
        setIsOnline(actuallyOnline)
        // Reset dismissed state when coming back online
        if (actuallyOnline) {
          setIsDismissed(false)
        }
      }
    }
    
    // Set initial status
    const navOnline = typeof navigator !== 'undefined' && navigator.onLine !== undefined 
      ? navigator.onLine 
      : true
    setIsOnline(navOnline)
    updateStatus()
    
    // Listen to browser events
    const handleOnline = async () => {
      await updateStatus()
    }
    const handleOffline = () => {
      if (mountedRef.current) {
        setIsOnline(false)
        setIsDismissed(false) // Show banner when going offline
      }
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Poll connectivity every 10 seconds
    const statusCheckInterval = setInterval(() => {
      if (mountedRef.current) {
        updateStatus()
      }
    }, 10000)
    
    return () => {
      mountedRef.current = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(statusCheckInterval)
    }
  }, [])

  // Don't show if online or dismissed
  if (isOnline || isDismissed) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 border-b-2 border-yellow-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <WifiOff className="w-5 h-5 text-yellow-900 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-yellow-900">You're offline</span>
                <AlertCircle className="w-4 h-4 text-yellow-900" />
              </div>
              <p className="text-sm text-yellow-800">
                Showing cached data. Some features are limited. Changes will sync when you're back online.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded hover:bg-yellow-600/30 transition-colors flex-shrink-0"
            aria-label="Dismiss offline banner"
          >
            <X className="w-5 h-5 text-yellow-900" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default OfflineBanner

