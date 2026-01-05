/**
 * ===========================================
 * OFFLINE BANNER COMPONENT
 * ===========================================
 * Prominent banner shown when offline to indicate
 * limited functionality and cached data usage.
 * ===========================================
 */

import { useState, useEffect, useRef } from 'react'
import { WifiOff, AlertCircle } from 'lucide-react'

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

  // Don't show if online
  if (isOnline) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-yellow-500/20 backdrop-blur-sm border-b border-yellow-500/30">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <WifiOff className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <span className="text-sm font-medium text-yellow-300">
            You're offline • Limited actions available • You can create expenses - they'll sync when you're back online
          </span>
        </div>
      </div>
    </div>
  )
}

export default OfflineBanner

