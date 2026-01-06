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

function PendingExpensesBanner({ onVisibilityChange }) {
  const [pendingCount, setPendingCount] = useState(0)
  const [isOffline, setIsOffline] = useState(false)
  const mountedRef = useRef(true)
  
  // Notify parent when visibility changes
  useEffect(() => {
    if (onVisibilityChange) {
      onVisibilityChange(pendingCount > 0)
    }
  }, [pendingCount, onVisibilityChange])

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
        // Only log if there are items (to reduce console spam)
        if (allItems.length > 0) {
          console.log('[PendingBanner] Loading pending expenses count...', allItems.length, 'items')
        }
        
        // Count only CREATE_EXPENSE items with pending status
        const pendingExpenses = allItems.filter(item => 
          item.type === QUEUE_TYPE.CREATE_EXPENSE && 
          item.status === QUEUE_STATUS.PENDING
        )
        const count = pendingExpenses.length
        
        // Only log if there are pending expenses
        if (count > 0) {
          console.log('[PendingBanner] Pending expenses:', count, pendingExpenses)
        }
        
        // Log counts by type and status
        const countsByType = {
          CREATE_EXPENSE: allItems.filter(i => i.type === QUEUE_TYPE.CREATE_EXPENSE).length,
          UPDATE_EXPENSE: allItems.filter(i => i.type === QUEUE_TYPE.UPDATE_EXPENSE).length,
          DELETE_EXPENSE: allItems.filter(i => i.type === QUEUE_TYPE.DELETE_EXPENSE).length,
        }
        const countsByStatus = {
          PENDING: allItems.filter(i => i.status === QUEUE_STATUS.PENDING).length,
          SYNCING: allItems.filter(i => i.status === QUEUE_STATUS.SYNCING).length,
          COMPLETED: allItems.filter(i => i.status === QUEUE_STATUS.COMPLETED).length,
          FAILED: allItems.filter(i => i.status === QUEUE_STATUS.FAILED).length,
        }
        
        // Only log detailed info if there are items (to reduce console spam)
        if (allItems.length > 0) {
          console.log('[PendingBanner] Counts by type:', countsByType)
          console.log('[PendingBanner] Counts by status:', countsByStatus)
          console.log('[PendingBanner] Filter details:', {
            totalItems: allItems.length,
            createExpenseItems: allItems.filter(i => i.type === QUEUE_TYPE.CREATE_EXPENSE),
            pendingItems: allItems.filter(i => i.status === QUEUE_STATUS.PENDING),
            pendingExpenses: pendingExpenses
          })
        }
        
        if (mountedRef.current) {
          const prevCount = pendingCount
          setPendingCount(count)
          if (prevCount !== count) {
            console.log('[PendingBanner] Pending count changed:', prevCount, '->', count)
          }
        }
      } catch (error) {
        console.error('[PendingBanner] Error loading pending count:', error)
        console.error('[PendingBanner] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        })
        // Set count to 0 on error to hide banner
        if (mountedRef.current) {
          setPendingCount(0)
        }
      }
    }

    loadPendingCount()

    // Poll for updates every 30 seconds (reduced frequency to save battery/resources)
    const interval = setInterval(() => {
      if (mountedRef.current) {
        loadPendingCount()
      }
    }, 30000)

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
      id="pending-banner"
      data-banner-height="48"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5">
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

