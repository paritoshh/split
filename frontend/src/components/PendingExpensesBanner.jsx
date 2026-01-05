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
        
        console.log('[PendingBanner] Loading pending expenses count...')
        const allItems = await getAllItems()
        console.log('[PendingBanner] All queue items:', allItems.length, allItems)
        
        // Count only CREATE_EXPENSE items with pending status
        const pendingExpenses = allItems.filter(item => 
          item.type === QUEUE_TYPE.CREATE_EXPENSE && 
          item.status === QUEUE_STATUS.PENDING
        )
        const count = pendingExpenses.length
        
        console.log('[PendingBanner] Pending expenses:', count, pendingExpenses)
        
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
        
        console.log('[PendingBanner] Counts by type:', countsByType)
        console.log('[PendingBanner] Counts by status:', countsByStatus)
        console.log('[PendingBanner] Filter details:', {
          totalItems: allItems.length,
          createExpenseItems: allItems.filter(i => i.type === QUEUE_TYPE.CREATE_EXPENSE),
          pendingItems: allItems.filter(i => i.status === QUEUE_STATUS.PENDING),
          pendingExpenses: pendingExpenses
        })
        
        if (mountedRef.current) {
          setPendingCount(count)
          console.log('[PendingBanner] Set pending count to:', count)
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
  console.log('[PendingBanner] Render check - pendingCount:', pendingCount)
  if (pendingCount === 0) {
    console.log('[PendingBanner] No pending expenses, hiding banner')
    return null
  }
  
  console.log('[PendingBanner] Showing banner with', pendingCount, 'pending expenses')

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

