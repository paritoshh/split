/**
 * ===========================================
 * PENDING EXPENSES BANNER COMPONENT
 * ===========================================
 * Shows banner when expenses created offline
 * are waiting to be synced.
 * ===========================================
 */

import { useState, useEffect, useRef } from 'react'
import { Clock } from 'lucide-react'
import { getAllItems, QUEUE_TYPE, QUEUE_STATUS } from '../services/offline/syncQueue.js'

function PendingExpensesBanner() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isOffline, setIsOffline] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    // Check offline status
    const checkOffline = () => {
      if (mountedRef.current) {
        setIsOffline(!navigator.onLine)
      }
    }
    checkOffline()
    window.addEventListener('online', checkOffline)
    window.addEventListener('offline', checkOffline)

    // Load pending expenses count
    const loadPendingCount = async () => {
      if (!mountedRef.current) return
      try {
        // Wait a bit to ensure database is ready
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const allItems = await getAllItems()
        // Count only CREATE_EXPENSE items with pending status
        const count = allItems.filter(item => 
          item.type === QUEUE_TYPE.CREATE_EXPENSE && 
          item.status === QUEUE_STATUS.PENDING
        ).length
        
        if (mountedRef.current) {
          setPendingCount(count)
        }
      } catch (error) {
        // Silently handle database errors (might be closed or not ready)
        if (error.name !== 'DatabaseClosedError' && error.name !== 'UnknownError') {
          console.error('Failed to load pending expenses:', error)
        }
        // Set count to 0 on error to hide banner
        if (mountedRef.current) {
          setPendingCount(0)
        }
      }
    }

    loadPendingCount()

    // Poll for updates every 2 seconds
    const interval = setInterval(() => {
      if (mountedRef.current) {
        loadPendingCount()
      }
    }, 2000)

    return () => {
      mountedRef.current = false
      window.removeEventListener('online', checkOffline)
      window.removeEventListener('offline', checkOffline)
      clearInterval(interval)
    }
  }, [])

  // Don't show if no pending expenses
  if (pendingCount === 0) {
    return null
  }

  // Position below offline banner if offline, otherwise at top
  const topOffset = isOffline ? '40px' : '0px'

  return (
    <div 
      className="fixed left-0 right-0 z-30 bg-yellow-500/20 backdrop-blur-sm border-b border-yellow-500/30" 
      style={{ top: topOffset }}
    >
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <span className="text-sm font-medium text-yellow-300">
            {pendingCount} expense{pendingCount > 1 ? 's' : ''} pending sync. They'll be synced automatically when you're online.
          </span>
        </div>
      </div>
    </div>
  )
}

export default PendingExpensesBanner

