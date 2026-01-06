/**
 * ===========================================
 * SYNC SERVICE
 * ===========================================
 * Processes sync queue when online.
 * Automatically syncs pending operations.
 * ===========================================
 */

import { offlineDetector } from './detector.js'
import {
  getPendingItems,
  updateItemStatus,
  incrementRetryCount,
  removeItem,
  getPendingCount,
  getFailedCount,
  getItemsByStatus,
  QUEUE_STATUS,
  QUEUE_TYPE
} from './syncQueue.js'
import api from '../api.js'
import { apiCache } from './cache.js'

// Maximum retry attempts
const MAX_RETRIES = 3

// Sync in progress flag
let isSyncing = false
let syncListeners = []

/**
 * Subscribe to sync status changes
 */
export const onSyncStatusChange = (callback) => {
  syncListeners.push(callback)
  return () => {
    syncListeners = syncListeners.filter(l => l !== callback)
  }
}

const notifyListeners = (status, pendingCount, syncingCount, failedCount) => {
  syncListeners.forEach(callback => {
    try {
      callback({ status, pendingCount, syncingCount, failedCount })
    } catch (error) {
      console.error('Error in sync status callback:', error)
    }
  })
}

/**
 * Sync a single queue item
 */
const syncItem = async (item) => {
  console.log('🔄 Syncing item:', item)
  
  // Mark as syncing
  await updateItemStatus(item.id, QUEUE_STATUS.SYNCING)
  
  try {
    let response
    
    switch (item.type) {
      case QUEUE_TYPE.CREATE_EXPENSE:
        response = await api.post('/api/expenses/', item.data)
        break
        
      case QUEUE_TYPE.UPDATE_EXPENSE:
        response = await api.put(`/api/expenses/${item.data.id}`, item.data)
        break
        
      case QUEUE_TYPE.DELETE_EXPENSE:
        response = await api.delete(`/api/expenses/${item.data.id}`)
        break
        
      case QUEUE_TYPE.CREATE_GROUP:
        response = await api.post('/api/groups/', item.data)
        break
        
      case QUEUE_TYPE.UPDATE_GROUP:
        response = await api.put(`/api/groups/${item.data.id}`, item.data)
        break
        
      case QUEUE_TYPE.DELETE_GROUP:
        response = await api.delete(`/api/groups/${item.data.id}`)
        break
        
      default:
        throw new Error(`Unknown queue type: ${item.type}`)
    }
    
    // Success - mark as completed
    await updateItemStatus(item.id, QUEUE_STATUS.COMPLETED)
    console.log('✅ Synced item:', item.id, item.type)
    
    // Refresh cache if needed
    if (item.type === QUEUE_TYPE.CREATE_EXPENSE || 
        item.type === QUEUE_TYPE.UPDATE_EXPENSE ||
        item.type === QUEUE_TYPE.DELETE_EXPENSE ||
        item.type === QUEUE_TYPE.CREATE_GROUP ||
        item.type === QUEUE_TYPE.UPDATE_GROUP ||
        item.type === QUEUE_TYPE.DELETE_GROUP) {
      // Invalidate cache to force refresh
      await apiCache.clearAll()
    }
    
    return { success: true, item }
    
  } catch (error) {
    console.error('❌ Failed to sync item:', item.id, error)
    
    // Increment retry count
    await incrementRetryCount(item.id)
    
    // Get updated item to check retry count
    const updatedItem = await db.syncQueue.get(item.id)
    const retryCount = updatedItem?.retryCount || 0
    
    if (retryCount >= MAX_RETRIES) {
      // Max retries reached - mark as failed
      await updateItemStatus(
        item.id,
        QUEUE_STATUS.FAILED,
        error.message || 'Failed to sync after multiple retries'
      )
      return { success: false, item, error: 'Max retries reached' }
    } else {
      // Reset to pending for retry
      await updateItemStatus(item.id, QUEUE_STATUS.PENDING, error.message)
      return { success: false, item, error: error.message, willRetry: true }
    }
  }
}

/**
 * Process sync queue
 */
export const processQueue = async () => {
  // Don't sync if already syncing or offline
  if (isSyncing) {
    console.log('⏸️ Sync already in progress')
    return
  }
  
  if (!offlineDetector.getStatus()) {
    console.log('📴 Offline - skipping sync')
    return
  }
  
  isSyncing = true
  console.log('🚀 Starting sync process...')
  
  try {
    // Get all pending items
    const pendingItems = await getPendingItems()
    
    if (pendingItems.length === 0) {
      console.log('✅ No pending items to sync')
      notifyListeners('idle', 0, 0, await getFailedCount())
      return
    }
    
    console.log(`📋 Found ${pendingItems.length} pending items`)
    notifyListeners('syncing', pendingItems.length, 0, await getFailedCount())
    
    // Sync items one by one
    let successCount = 0
    let failCount = 0
    
    for (const item of pendingItems) {
      const result = await syncItem(item)
      
      if (result.success) {
        successCount++
        // Remove completed item after a delay (for UI feedback)
        setTimeout(() => {
          removeItem(item.id)
        }, 5000) // Keep for 5 seconds to show success
      } else {
        failCount++
      }
      
      // Update status for UI
      const remaining = await getPendingItems()
      const syncing = await getItemsByStatus(QUEUE_STATUS.SYNCING)
      const failed = await getFailedCount()
      
      notifyListeners('syncing', remaining.length, syncing.length, failed)
    }
    
    console.log(`✅ Sync complete: ${successCount} succeeded, ${failCount} failed`)
    notifyListeners('idle', await getPendingCount(), 0, await getFailedCount())
    
  } catch (error) {
    console.error('❌ Sync process error:', error)
    notifyListeners('error', await getPendingCount(), 0, await getFailedCount())
  } finally {
    isSyncing = false
  }
}

/**
 * Start auto-sync (runs periodically when online)
 */
let autoSyncInterval = null

export const startAutoSync = () => {
  if (autoSyncInterval) {
    return // Already running
  }
  
  // Sync immediately if online
  if (offlineDetector.getStatus()) {
    processQueue()
  }
  
  // Sync every 60 seconds when online (reduced frequency to save battery/resources)
  autoSyncInterval = setInterval(() => {
    if (offlineDetector.getStatus()) {
      processQueue()
    }
  }, 60000) // 60 seconds
  
  console.log('🔄 Auto-sync started')
}

export const stopAutoSync = () => {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval)
    autoSyncInterval = null
    console.log('⏹️ Auto-sync stopped')
  }
}

/**
 * Initialize sync service
 */
export const initSyncService = () => {
  // Listen to online/offline events
  offlineDetector.onStatusChange((isOnline) => {
    if (isOnline) {
      console.log('🌐 Online - starting sync')
      processQueue()
      startAutoSync()
    } else {
      console.log('📴 Offline - stopping sync')
      stopAutoSync()
    }
  })
  
  // Start auto-sync if already online
  if (offlineDetector.getStatus()) {
    startAutoSync()
  }
  
  console.log('✅ Sync service initialized')
}

