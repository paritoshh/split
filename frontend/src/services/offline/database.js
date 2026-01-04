/**
 * ===========================================
 * INDEXEDDB DATABASE SETUP
 * ===========================================
 * Using Dexie.js for easier IndexedDB management.
 * 
 * Stores:
 * - Cached API responses (expenses, groups, balances)
 * - Sync queue (pending operations)
 * - Metadata (last sync time, etc.)
 * ===========================================
 */

import Dexie from 'dexie'

class HisabDatabase extends Dexie {
  constructor() {
    super('HisabDB')
    
    // Define database schema
    this.version(1).stores({
      // Cache table - stores API responses
      cache: '++id, key, data, timestamp, expiresAt',
      
      // Expenses cache
      expenses: '++id, expenseId, data, syncedAt, isDraft',
      
      // Groups cache
      groups: '++id, groupId, data, syncedAt',
      
      // Balances cache
      balances: '++id, userId, data, syncedAt',
      
      // Sync queue - pending operations
      syncQueue: '++id, type, data, status, createdAt, syncedAt',
      
      // Metadata
      metadata: 'key, value'
    })
  }
}

// Create database instance
const db = new HisabDatabase()

// Helper functions for cache operations
export const cacheService = {
  /**
   * Store API response in cache
   */
  async set(key, data, ttl = 24 * 60 * 60 * 1000) { // Default 24 hours
    const expiresAt = Date.now() + ttl
    await db.cache.put({
      key,
      data,
      timestamp: Date.now(),
      expiresAt
    })
  },

  /**
   * Get cached API response
   */
  async get(key) {
    const cached = await db.cache.where('key').equals(key).first()
    
    if (!cached) {
      return null
    }
    
    // Check if expired
    if (cached.expiresAt && cached.expiresAt < Date.now()) {
      await db.cache.where('key').equals(key).delete()
      return null
    }
    
    return cached.data
  },

  /**
   * Clear specific cache entry
   */
  async clear(key) {
    await db.cache.where('key').equals(key).delete()
  },

  /**
   * Clear all cache
   */
  async clearAll() {
    await db.cache.clear()
  },

  /**
   * Get cache age (in milliseconds)
   */
  async getAge(key) {
    const cached = await db.cache.where('key').equals(key).first()
    if (!cached) return null
    return Date.now() - cached.timestamp
  }
}

// Helper functions for expenses cache
export const expensesCache = {
  async setAll(expenses) {
    await db.expenses.clear()
    const now = Date.now()
    for (const expense of expenses) {
      await db.expenses.add({
        expenseId: expense.id,
        data: expense,
        syncedAt: now,
        isDraft: expense.is_draft || false
      })
    }
  },

  async getAll() {
    const expenses = await db.expenses.toArray()
    return expenses.map(e => e.data)
  },

  async getDrafts() {
    const drafts = await db.expenses.where('isDraft').equals(true).toArray()
    return drafts.map(e => e.data)
  },

  async clear() {
    await db.expenses.clear()
  }
}

// Helper functions for groups cache
export const groupsCache = {
  async setAll(groups) {
    await db.groups.clear()
    const now = Date.now()
    for (const group of groups) {
      await db.groups.add({
        groupId: group.id,
        data: group,
        syncedAt: now
      })
    }
  },

  async getAll() {
    const groups = await db.groups.toArray()
    return groups.map(g => g.data)
  },

  async clear() {
    await db.groups.clear()
  }
}

// Helper functions for balances cache
export const balancesCache = {
  async set(userId, balances) {
    await db.balances.where('userId').equals(userId).delete()
    await db.balances.add({
      userId,
      data: balances,
      syncedAt: Date.now()
    })
  },

  async get(userId) {
    const cached = await db.balances.where('userId').equals(userId).first()
    return cached ? cached.data : null
  },

  async clear() {
    await db.balances.clear()
  }
}

// Helper functions for metadata
export const metadata = {
  async set(key, value) {
    await db.metadata.put({ key, value })
  },

  async get(key) {
    const item = await db.metadata.where('key').equals(key).first()
    return item ? item.value : null
  },

  async getLastSync() {
    return await this.get('lastSync')
  },

  async setLastSync(timestamp = Date.now()) {
    await this.set('lastSync', timestamp)
  }
}

export default db

