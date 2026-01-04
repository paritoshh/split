/**
 * ===========================================
 * API CACHE SERVICE
 * ===========================================
 * Handles caching of API responses for offline support.
 * 
 * Strategy:
 * - Cache successful GET responses
 * - Serve from cache when offline
 * - Update cache when online
 * ===========================================
 */

import { cacheService, expensesCache, groupsCache, balancesCache, metadata } from './database.js'
import { isOnline } from './detector.js'

// Cache keys
const CACHE_KEYS = {
  EXPENSES: 'api:expenses',
  DRAFTS: 'api:drafts',
  GROUPS: 'api:groups',
  BALANCES: 'api:balances',
  USER_PROFILE: 'api:user:profile'
}

// Cache TTL (Time To Live) in milliseconds
const CACHE_TTL = {
  EXPENSES: 30 * 60 * 1000,      // 30 minutes
  DRAFTS: 30 * 60 * 1000,        // 30 minutes
  GROUPS: 60 * 60 * 1000,        // 1 hour
  BALANCES: 5 * 60 * 1000,       // 5 minutes
  USER_PROFILE: 24 * 60 * 60 * 1000  // 24 hours
}

export const apiCache = {
  /**
   * Cache expenses response
   */
  async setExpenses(expenses) {
    await cacheService.set(CACHE_KEYS.EXPENSES, expenses, CACHE_TTL.EXPENSES)
    await expensesCache.setAll(expenses)
    await metadata.setLastSync()
  },

  /**
   * Get cached expenses
   */
  async getExpenses() {
    // Try structured cache first (for better querying)
    const structured = await expensesCache.getAll()
    if (structured && structured.length > 0) {
      return structured
    }
    
    // Fallback to generic cache
    return await cacheService.get(CACHE_KEYS.EXPENSES)
  },

  /**
   * Cache drafts response
   */
  async setDrafts(drafts) {
    await cacheService.set(CACHE_KEYS.DRAFTS, drafts, CACHE_TTL.DRAFTS)
    await metadata.setLastSync()
  },

  /**
   * Get cached drafts
   */
  async getDrafts() {
    // Try structured cache first
    const structured = await expensesCache.getDrafts()
    if (structured && structured.length > 0) {
      return structured
    }
    
    // Fallback to generic cache
    return await cacheService.get(CACHE_KEYS.DRAFTS) || []
  },

  /**
   * Cache groups response
   */
  async setGroups(groups) {
    await cacheService.set(CACHE_KEYS.GROUPS, groups, CACHE_TTL.GROUPS)
    await groupsCache.setAll(groups)
    await metadata.setLastSync()
  },

  /**
   * Get cached groups
   */
  async getGroups() {
    // Try structured cache first
    const structured = await groupsCache.getAll()
    if (structured && structured.length > 0) {
      return structured
    }
    
    // Fallback to generic cache
    return await cacheService.get(CACHE_KEYS.GROUPS)
  },

  /**
   * Cache balances response
   */
  async setBalances(userId, balances) {
    await cacheService.set(CACHE_KEYS.BALANCES, balances, CACHE_TTL.BALANCES)
    await balancesCache.set(userId, balances)
    await metadata.setLastSync()
  },

  /**
   * Get cached balances
   */
  async getBalances(userId) {
    // Try structured cache first
    const structured = await balancesCache.get(userId)
    if (structured) {
      return structured
    }
    
    // Fallback to generic cache
    return await cacheService.get(CACHE_KEYS.BALANCES)
  },

  /**
   * Cache user profile
   */
  async setUserProfile(profile) {
    await cacheService.set(CACHE_KEYS.USER_PROFILE, profile, CACHE_TTL.USER_PROFILE)
  },

  /**
   * Get cached user profile
   */
  async getUserProfile() {
    return await cacheService.get(CACHE_KEYS.USER_PROFILE)
  },

  /**
   * Clear all cache
   */
  async clearAll() {
    await cacheService.clearAll()
    await expensesCache.clear()
    await groupsCache.clear()
    await balancesCache.clear()
  },

  /**
   * Get last sync timestamp
   */
  async getLastSync() {
    return await metadata.getLastSync()
  },

  /**
   * Check if we should use cache (offline or cache available)
   */
  shouldUseCache(endpoint) {
    // Always use cache if offline
    if (!isOnline()) {
      return true
    }
    
    // For now, we'll use cache as fallback even when online
    // This can be optimized later
    return false
  }
}

