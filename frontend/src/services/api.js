/**
 * ===========================================
 * API SERVICE
 * ===========================================
 * Centralized API communication using Axios.
 * 
 * What is Axios?
 * - HTTP client library for making API requests
 * - Easier than fetch() API
 * - Automatic JSON parsing
 * - Request/response interceptors
 * 
 * This file:
 * 1. Creates axios instance with base URL
 * 2. Adds auth token to all requests automatically
 * 3. Handles errors globally
 * ===========================================
 */

import axios from 'axios'
import { offlineDetector } from './offline/detector.js'
import { apiCache } from './offline/cache.js'
import { addToQueue, QUEUE_TYPE } from './offline/syncQueue.js'

// Determine the API base URL
// For mobile app: use AWS API Gateway URL
// For web: use environment variable, AWS URL, or empty for local proxy
const getBaseUrl = () => {
  // Check if running in Capacitor (mobile app)
  const isCapacitor = window.Capacitor !== undefined;
  
  // AWS API Gateway URL (production)
  const AWS_API_URL = 'https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com';
  
  if (isCapacitor) {
    // Mobile app - use AWS API Gateway
    return AWS_API_URL;
  }
  
  // Web app - use environment variable, or AWS URL for production, or empty for local proxy
  // In production builds, always use AWS API URL if VITE_API_URL is not set
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Check if we're in production (either via env or by checking if we're not in dev server)
  const isProduction = import.meta.env.PROD || (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1'));
  return isProduction ? AWS_API_URL : '';
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000, // 15 second timeout - prevents app from hanging
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request Interceptor
// Runs before EVERY request
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token')
    
    // If token exists, add to Authorization header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // If sending FormData, let axios set the Content-Type automatically
    // This is needed for multipart/form-data (file uploads, OAuth2 login)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    
    // Log the full URL for debugging (only in development)
    if (import.meta.env.DEV) {
      const fullUrl = config.baseURL ? `${config.baseURL}${config.url}` : config.url
      console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${fullUrl}`)
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response Interceptor
// Runs after EVERY response
api.interceptors.response.use(
  // Success - cache GET responses and return the response
  async (response) => {
    // Cache successful GET responses for offline support
    if (response.config.method === 'get' && response.status === 200) {
      const url = response.config.url || ''
      
      try {
        // Cache expenses
        if (url.includes('/api/expenses/') && !url.includes('/expenses/balances') && !url.includes('/expenses/drafts')) {
          const params = response.config.params
          if (!params || !params.group_id) {
            // Cache all expenses
            await apiCache.setExpenses(response.data || [])
          }
        }
        
        // Cache drafts
        if (url.includes('/api/expenses/drafts')) {
          await apiCache.setDrafts(response.data || [])
        }
        
        // Cache groups
        if (url.includes('/api/groups/') && !url.match(/\/api\/groups\/[^/]+$/)) {
          await apiCache.setGroups(response.data || [])
        }
        
        // Cache balances
        if (url.includes('/api/expenses/balances/overall')) {
          const userId = localStorage.getItem('userId') // You might need to store this
          await apiCache.setBalances(userId, response.data || [])
        }
      } catch (error) {
        console.warn('Failed to cache API response:', error)
        // Don't fail the request if caching fails
      }
    }
    
    return response
  },
  
  // Error handling
  (error) => {
    // Only clear token on actual 401 Unauthorized (not network errors)
    // Network errors (ERR_NETWORK) should NOT clear token - user might be offline
    if (error.response?.status === 401 && error.code !== 'ERR_NETWORK') {
      localStorage.removeItem('token')
      
      // Only redirect if not already on login/register pages
      if (!window.location.pathname.includes('login') && 
          !window.location.pathname.includes('register')) {
        window.location.href = '/login'
      }
    }
    
    // Handle specific error types with friendly messages
    let message = 'Something went wrong'
    
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      message = 'Connection timed out. Please check your internet connection and try again.'
    } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      // Don't throw error for network issues - let components handle offline state
      message = 'Network error. You may be offline.'
    } else if (error.response?.data?.detail) {
      message = error.response.data.detail
    } else if (error.message) {
      message = error.message
    }
    
    return Promise.reject(new Error(message))
  }
)

export default api


/**
 * ===========================================
 * API HELPER FUNCTIONS
 * ===========================================
 * Convenience functions for common API calls.
 * These make components cleaner.
 * ===========================================
 */

// Auth
export const authAPI = {
  login: (email, password) => {
    const formData = new FormData()
    formData.append('username', email)
    formData.append('password', password)
    return api.post('/api/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  register: (data) => api.post('/api/auth/register', data),
  getMe: () => api.get('/api/auth/me'),
  updateMe: (data) => api.put('/api/auth/me', data),
  searchUsers: (query) => api.get('/api/auth/search', { params: { q: query } }),
}

// Groups - Note: trailing slashes to avoid 307 redirects
export const groupsAPI = {
  getAll: async () => {
    // If offline, try to get from cache
    if (!offlineDetector.getStatus()) {
      const cached = await apiCache.getGroups()
      if (cached) {
        return { data: cached }
      }
      throw new Error('No cached groups available. Please connect to the internet.')
    }
    
    return api.get('/api/groups/')
  },
  
  getOne: async (id) => {
    // If offline, try to get from cache
    if (!offlineDetector.getStatus()) {
      const cached = await apiCache.getGroups()
      if (cached) {
        const group = cached.find(g => g.id === id)
        if (group) {
          return { data: group }
        }
      }
      throw new Error('Group not found in cache. Please connect to the internet.')
    }
    
    return api.get(`/api/groups/${id}`)
  },
  
  create: async (data) => {
    // If offline, add to queue
    if (!offlineDetector.getStatus()) {
      const queueItem = await addToQueue(QUEUE_TYPE.CREATE_GROUP, data)
      
      return {
        data: {
          id: `pending-${queueItem.id}`,
          ...data,
          is_pending: true,
          queue_id: queueItem.id
        }
      }
    }
    
    return api.post('/api/groups/', data)
  },
  
  update: async (id, data) => {
    // If offline, add to queue
    if (!offlineDetector.getStatus()) {
      await addToQueue(QUEUE_TYPE.UPDATE_GROUP, { id, ...data })
      
      return {
        data: {
          id,
          ...data,
          is_pending: true
        }
      }
    }
    
    return api.put(`/api/groups/${id}`, data)
  },
  
  delete: async (id) => {
    // If offline, add to queue
    if (!offlineDetector.getStatus()) {
      await addToQueue(QUEUE_TYPE.DELETE_GROUP, { id })
      
      return { data: { id, deleted: true, is_pending: true } }
    }
    
    return api.delete(`/api/groups/${id}`)
  },
  addMember: (groupId, data) => api.post(`/api/groups/${groupId}/members`, data),
  addMembersBulk: (groupId, userIds) => api.post(`/api/groups/${groupId}/members/bulk`, { user_ids: userIds }),
  removeMember: (groupId, userId) => api.delete(`/api/groups/${groupId}/members/${userId}`),
}

// Expenses - Note: trailing slashes to avoid 307 redirects
export const expensesAPI = {
  getAll: async (params) => {
    // If offline, try to get from cache
    if (!offlineDetector.getStatus()) {
      const cached = await apiCache.getExpenses()
      if (cached) {
        return { data: cached }
      }
      throw new Error('No cached data available. Please connect to the internet.')
    }
    
    // Online - make API call (will be cached by interceptor)
    return api.get('/api/expenses/', { params })
  },
  
  getByGroup: async (groupId) => {
    // For group expenses, we'll filter from cached all expenses
    if (!offlineDetector.getStatus()) {
      const cached = await apiCache.getExpenses()
      if (cached) {
        const filtered = cached.filter(e => e.group_id === groupId)
        return { data: filtered }
      }
      throw new Error('No cached data available. Please connect to the internet.')
    }
    
    return api.get('/api/expenses/', { params: { group_id: groupId } })
  },
  
  getOne: async (id) => {
    // If offline, try to get from cache
    if (!offlineDetector.getStatus()) {
      const cached = await apiCache.getExpenses()
      if (cached) {
        const expense = cached.find(e => e.id === id)
        if (expense) {
          return { data: expense }
        }
      }
      throw new Error('Expense not found in cache. Please connect to the internet.')
    }
    
    return api.get(`/api/expenses/${id}`)
  },
  
  create: async (data) => {
    // If offline, add to queue instead of calling API
    if (!offlineDetector.getStatus()) {
      const queueItem = await addToQueue(QUEUE_TYPE.CREATE_EXPENSE, data)
      
      // Return optimistic response
      return {
        data: {
          id: `pending-${queueItem.id}`,
          ...data,
          is_pending: true,
          queue_id: queueItem.id
        }
      }
    }
    
    // Online - make API call
    return api.post('/api/expenses/', data)
  },
  
  update: async (id, data) => {
    // If offline, add to queue
    if (!offlineDetector.getStatus()) {
      await addToQueue(QUEUE_TYPE.UPDATE_EXPENSE, { id, ...data })
      
      // Return optimistic response
      return {
        data: {
          id,
          ...data,
          is_pending: true
        }
      }
    }
    
    // Online - make API call
    return api.put(`/api/expenses/${id}`, data)
  },
  
  delete: async (id) => {
    // If offline, add to queue
    if (!offlineDetector.getStatus()) {
      await addToQueue(QUEUE_TYPE.DELETE_EXPENSE, { id })
      
      // Return optimistic response
      return { data: { id, deleted: true, is_pending: true } }
    }
    
    // Online - make API call
    return api.delete(`/api/expenses/${id}`)
  },
  
  getOverallBalances: async () => {
    // If offline, try to get from cache
    if (!offlineDetector.getStatus()) {
      const userId = localStorage.getItem('userId')
      const cached = await apiCache.getBalances(userId)
      if (cached) {
        return { data: cached }
      }
      throw new Error('No cached balances available. Please connect to the internet.')
    }
    
    return api.get('/api/expenses/balances/overall')
  },
  
  getGroupBalances: (groupId) => api.get(`/api/expenses/balances/group/${groupId}`),
  settle: (data) => api.post('/api/expenses/settle', data),
  
  // Draft expenses
  getDrafts: async () => {
    // If offline, try to get from cache
    if (!offlineDetector.getStatus()) {
      const cached = await apiCache.getDrafts()
      if (cached) {
        return { data: cached }
      }
      return { data: [] } // Return empty array if no cache
    }
    
    return api.get('/api/expenses/drafts')
  },
  
  submitDraft: (id) => api.put(`/api/expenses/drafts/${id}/submit`),
}

// Notifications
export const notificationsAPI = {
  getAll: (unreadOnly = false) => api.get('/api/notifications/', { params: { unread_only: unreadOnly } }),
  getUnreadCount: () => api.get('/api/notifications/unread-count'),
  markAsRead: (ids) => api.post('/api/notifications/mark-read', { notification_ids: ids }),
  markAllAsRead: () => api.post('/api/notifications/mark-all-read'),
}

// Settlements
export const settlementsAPI = {
  record: (data) => api.post('/api/settlements/', data),
  getAll: (groupId = null) => api.get('/api/settlements/', { params: { group_id: groupId } }),
  getUPILink: (userId, amount, groupId = null) => api.get(`/api/settlements/upi-link/${userId}`, { 
    params: { amount, group_id: groupId } 
  }),
}

// AI Features
export const aiAPI = {
  parseVoiceExpense: (transcript, groupMembers) => api.post('/api/ai/parse-voice-expense', {
    transcript,
    group_members: groupMembers.map(m => ({
      user_id: m.user_id,
      user_name: m.user_name
    }))
  }),
  getStatus: () => api.get('/api/ai/status'),
}

