/**
 * ===========================================
 * PENDING EXPENSES BANNER COMPONENT
 * ===========================================
 * Prominent banner shown when there are pending
 * expenses waiting to be synced.
 * ===========================================
 */

import { useState, useEffect, useRef } from 'react'
import { Clock, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import { onSyncStatusChange } from '../services/offline/syncService.js'
import { getPendingCount, getSyncingCount, getFailedCount, getAllItems, QUEUE_TYPE } from '../services/offline/syncQueue.js'

function PendingExpensesBanner() {
  const [pendingCount, setPendingCount] = useState(0)
  const [syncingCount, setSyncingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [status, setStatus] = useState('idle')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    // Load initial counts
    const loadCounts = async () => {
      if (!mountedRef.current) return
      try {
        const [pending, syncing, failed, allItems] = await Promise.all([
          getPendingCount(),
          getSyncingCount(),
          getFailedCount(),
          getAllItems() // Get all items for debugging
        ])
        
        // Filter for expenses only
        const expensePending = allItems.filter(item => 
          item.type === QUEUE_TYPE.CREATE_EXPENSE && item.status === 'pending'
        ).length
        const expenseSyncing = allItems.filter(item => 
          item.type === QUEUE_TYPE.CREATE_EXPENSE && item.status === 'syncing'
        ).length
        const expenseFailed = allItems.filter(item => 
          item.type === QUEUE_TYPE.CREATE_EXPENSE && item.status === 'failed'
        ).length
        
        console.log('📊 PendingExpensesBanner - All counts:', { 
          pending, syncing, failed,
          expensePending, expenseSyncing, expenseFailed,
          allItems: allItems.length,
          allItemsDetails: allItems
        })
        
        if (mountedRef.current) {
          // Use expense-specific counts
          setPendingCount(expensePending)
          setSyncingCount(expenseSyncing)
          setFailedCount(expenseFailed)
        }
      } catch (error) {
        console.error('❌ Failed to load sync counts:', error)
      }
    }

    loadCounts()

    // Subscribe to sync status changes
    const unsubscribe = onSyncStatusChange(async (syncStatus) => {
      if (mountedRef.current) {
        setStatus(syncStatus.status)
        // Reload counts to get expense-specific counts
        const allItems = await getAllItems()
        const expensePending = allItems.filter(item => 
          item.type === QUEUE_TYPE.CREATE_EXPENSE && item.status === 'pending'
        ).length
        const expenseSyncing = allItems.filter(item => 
          item.type === QUEUE_TYPE.CREATE_EXPENSE && item.status === 'syncing'
        ).length
        const expenseFailed = allItems.filter(item => 
          item.type === QUEUE_TYPE.CREATE_EXPENSE && item.status === 'failed'
        ).length
        
        if (mountedRef.current) {
          setPendingCount(expensePending)
          setSyncingCount(expenseSyncing)
          setFailedCount(expenseFailed)
        }
      }
    })

    // Poll for updates every 2 seconds
    const interval = setInterval(() => {
      if (mountedRef.current) {
        loadCounts()
      }
    }, 2000)

    return () => {
      mountedRef.current = false
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  // Debug logging
  useEffect(() => {
    console.log('🎨 PendingExpensesBanner render:', { 
      pendingCount, 
      syncingCount, 
      failedCount, 
      status,
      willShow: pendingCount > 0 || syncingCount > 0 || failedCount > 0
    })
  }, [pendingCount, syncingCount, failedCount, status])

  // Don't show if nothing to sync
  if (pendingCount === 0 && syncingCount === 0 && failedCount === 0) {
    console.log('🚫 PendingExpensesBanner: No items to sync, hiding banner')
    return null
  }
  
  console.log('✅ PendingExpensesBanner: Will show banner with counts:', { pendingCount, syncingCount, failedCount })

  // Calculate top offset - check if offline banner is visible
  // Offline banner is ~40px tall, so we position this below it if offline
  // Otherwise, position at top
  const [isOffline, setIsOffline] = useState(false)
  
  useEffect(() => {
    const checkOffline = () => {
      setIsOffline(!navigator.onLine)
    }
    checkOffline()
    window.addEventListener('online', checkOffline)
    window.addEventListener('offline', checkOffline)
    return () => {
      window.removeEventListener('online', checkOffline)
      window.removeEventListener('offline', checkOffline)
    }
  }, [])
  
  const topOffset = isOffline ? '40px' : '0px'

  // Show failed status (highest priority)
  if (failedCount > 0) {
    return (
      <div className="fixed left-0 right-0 z-30 bg-red-500/20 backdrop-blur-sm border-b border-red-500/30" style={{ top: topOffset }}>
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-sm font-medium text-red-300">
              {failedCount} expense{failedCount > 1 ? 's' : ''} failed to sync. Please check your connection and try again.
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Show syncing status
  if (syncingCount > 0 || status === 'syncing') {
    return (
      <div className="fixed left-0 right-0 z-30 bg-blue-500/20 backdrop-blur-sm border-b border-blue-500/30" style={{ top: topOffset }}>
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <RefreshCw className="w-4 h-4 text-blue-400 flex-shrink-0 animate-spin" />
            <span className="text-sm font-medium text-blue-300">
              Syncing {syncingCount > 0 ? `${syncingCount} expense${syncingCount > 1 ? 's' : ''}` : 'expenses'}...
              {pendingCount > 0 && ` (${pendingCount} more pending)`}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Show pending status - THIS IS THE KEY BANNER FOR PENDING EXPENSES
  if (pendingCount > 0) {
    console.log('✅ Showing pending expenses banner with count:', pendingCount)
    return (
      <div className="fixed left-0 right-0 z-30 bg-yellow-500/20 backdrop-blur-sm border-b border-yellow-500/30" style={{ top: topOffset }}>
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

  return null
}

export default PendingExpensesBanner

