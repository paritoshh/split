/**
 * ===========================================
 * SYNC QUEUE SERVICE
 * ===========================================
 * Manages queue of operations to sync when online.
 * 
 * Queue Item Structure:
 * {
 *   id: number (auto-increment),
 *   type: 'CREATE_EXPENSE' | 'UPDATE_EXPENSE' | 'DELETE_EXPENSE',
 *   data: object (operation data),
 *   status: 'pending' | 'syncing' | 'completed' | 'failed',
 *   createdAt: timestamp,
 *   syncedAt: timestamp | null,
 *   retryCount: number,
 *   error: string | null
 * }
 * ===========================================
 */

import db, { ensureDbOpen } from './database.js'

// Queue item statuses
export const QUEUE_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  COMPLETED: 'completed',
  FAILED: 'failed'
}

// Queue item types
export const QUEUE_TYPE = {
  CREATE_EXPENSE: 'CREATE_EXPENSE',
  UPDATE_EXPENSE: 'UPDATE_EXPENSE',
  DELETE_EXPENSE: 'DELETE_EXPENSE',
  CREATE_GROUP: 'CREATE_GROUP',
  UPDATE_GROUP: 'UPDATE_GROUP',
  DELETE_GROUP: 'DELETE_GROUP'
}

/**
 * Add operation to sync queue
 */
export const addToQueue = async (type, data) => {
  try {
    console.log('[SyncQueue] Adding to queue:', { type, data })
    // Ensure database is open
    await ensureDbOpen()
    
    const queueItem = {
      type,
      data,
      status: QUEUE_STATUS.PENDING,
      createdAt: Date.now(),
      syncedAt: null,
      retryCount: 0,
      error: null
    }
    
    console.log('[SyncQueue] Queue item to add:', queueItem)
    const id = await db.syncQueue.add(queueItem)
    const result = { ...queueItem, id }
    console.log('[SyncQueue] Added to queue successfully:', result)
    
    // Verify it was added
    const verify = await db.syncQueue.get(id)
    console.log('[SyncQueue] Verification - item in DB:', verify)
    
    return result
  } catch (error) {
    console.error('[SyncQueue] Error adding to queue:', error)
    console.error('[SyncQueue] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    throw error
  }
}

/**
 * Get all pending items from queue
 */
export const getPendingItems = async () => {
  const items = await db.syncQueue
    .where('status')
    .equals(QUEUE_STATUS.PENDING)
    .sortBy('createdAt')
  
  return items
}

/**
 * Get all items (for UI display)
 */
export const getAllItems = async () => {
  try {
    console.log('[SyncQueue] Getting all items...')
    // Ensure database is open
    await ensureDbOpen()
    const items = await db.syncQueue.orderBy('createdAt').reverse().toArray()
    console.log('[SyncQueue] Retrieved items:', items.length, items)
    return items
  } catch (error) {
    console.error('[SyncQueue] Error getting all items:', error)
    console.error('[SyncQueue] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    // If database is closed or not accessible, return empty array
    if (error.name === 'DatabaseClosedError' || error.name === 'UnknownError') {
      console.warn('[SyncQueue] Database not accessible, returning empty array')
      return []
    }
    throw error
  }
}

/**
 * Get items by status
 */
export const getItemsByStatus = async (status) => {
  return await db.syncQueue
    .where('status')
    .equals(status)
    .sortBy('createdAt')
}

/**
 * Get count of pending items
 */
export const getPendingCount = async () => {
  return await db.syncQueue
    .where('status')
    .equals(QUEUE_STATUS.PENDING)
    .count()
}

/**
 * Get count of syncing items
 */
export const getSyncingCount = async () => {
  return await db.syncQueue
    .where('status')
    .equals(QUEUE_STATUS.SYNCING)
    .count()
}

/**
 * Get count of failed items
 */
export const getFailedCount = async () => {
  return await db.syncQueue
    .where('status')
    .equals(QUEUE_STATUS.FAILED)
    .count()
}

/**
 * Update queue item status
 */
export const updateItemStatus = async (id, status, error = null) => {
  const updates = {
    status,
    error: error || null
  }
  
  if (status === QUEUE_STATUS.COMPLETED || status === QUEUE_STATUS.SYNCING) {
    updates.syncedAt = Date.now()
  }
  
  await db.syncQueue.update(id, updates)
  console.log('📝 Updated queue item:', { id, status, error })
}

/**
 * Increment retry count
 */
export const incrementRetryCount = async (id) => {
  const item = await db.syncQueue.get(id)
  if (item) {
    await db.syncQueue.update(id, {
      retryCount: (item.retryCount || 0) + 1
    })
  }
}

/**
 * Remove completed item from queue (optional - for cleanup)
 */
export const removeItem = async (id) => {
  await db.syncQueue.delete(id)
}

/**
 * Clear all completed items (cleanup old items)
 */
export const clearCompleted = async () => {
  const completed = await db.syncQueue
    .where('status')
    .equals(QUEUE_STATUS.COMPLETED)
    .toArray()
  
  const ids = completed.map(item => item.id)
  await db.syncQueue.bulkDelete(ids)
}

/**
 * Retry failed item
 */
export const retryItem = async (id) => {
  await db.syncQueue.update(id, {
    status: QUEUE_STATUS.PENDING,
    error: null
  })
}

