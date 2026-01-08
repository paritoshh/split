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
import { addToQueue, QUEUE_TYPE, getAllItems } from './offline/syncQueue.js'

// Flag to prevent redirects during initial auth check
let isCheckingAuth = false
export const setCheckingAuth = (value) => { isCheckingAuth = value }

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
  timeout: 30000, // 30 second timeout - increased for slower connections
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
    
    // Log request in development to debug canceled requests
    if (import.meta.env.DEV) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
        baseURL: config.baseURL || '(proxy)',
        hasToken: !!token
      })
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
    // Log error in development to debug canceled requests
    if (import.meta.env.DEV) {
      console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        code: error.code,
        message: error.message,
        status: error.response?.status,
        canceled: error.code === 'ERR_CANCELED' || error.message?.includes('canceled')
      })
    }
    
    // Handle canceled requests - don't treat as error if it was intentionally canceled
    if (error.code === 'ERR_CANCELED' || error.message?.includes('canceled')) {
      // Request was canceled - return a specific error
      return Promise.reject(new Error('Request was canceled'))
    }
    
    // Only clear token on actual 401 Unauthorized (not network errors)
    // Network errors (ERR_NETWORK) should NOT clear token - user might be offline
    if (error.response?.status === 401 && error.code !== 'ERR_NETWORK') {
      localStorage.removeItem('token')
      
      // NEVER redirect during auth check or on auth pages - this causes infinite loops
      const currentPath = window.location.pathname
      const isAuthPage = currentPath === '/login' || 
                         currentPath === '/register' || 
                         currentPath.includes('/login') || 
                         currentPath.includes('/register')
      
      // Only redirect if NOT on auth pages, NOT checking auth, and NOT during initial load
      // Add a longer delay and more checks to prevent infinite loops
      if (!isAuthPage && !isCheckingAuth) {
        // Use a longer delay to ensure auth check is complete
        setTimeout(() => {
          // Triple check - path, checking auth flag, and make sure we're not in a loop
          const path = window.location.pathname
          const stillNotOnAuth = path !== '/login' && 
                                 path !== '/register' && 
                                 !path.includes('/login') && 
                                 !path.includes('/register')
          
          // Only redirect if all conditions are met and we haven't redirected recently
          if (stillNotOnAuth && !isCheckingAuth) {
            // Check if we've redirected recently (prevent loops)
            const lastRedirect = sessionStorage.getItem('lastRedirect')
            const now = Date.now()
            if (!lastRedirect || (now - parseInt(lastRedirect)) > 2000) {
              sessionStorage.setItem('lastRedirect', now.toString())
              window.location.href = '/login'
            }
          }
        }, 500)
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
  login: (mobile, password) => {
    // Use JSON for Cognito login
    return api.post('/api/auth/login', { mobile, password })
  },
  register: (data) => api.post('/api/auth/register', data),
  confirmSignup: (mobile, confirmationCode) => 
    api.post('/api/auth/confirm-signup', null, { 
      params: { mobile, confirmation_code: confirmationCode } 
    }),
  resendConfirmation: (mobile) => 
    api.post('/api/auth/resend-confirmation', null, { 
      params: { mobile } 
    }),
  getMe: () => api.get('/api/auth/me'),
  updateMe: (data) => api.put('/api/auth/me', data),
  searchUsers: (query) => api.get('/api/auth/search', { params: { q: query } }),
  forgotPassword: (mobile) => 
    api.post('/api/auth/forgot-password', null, { 
      params: { mobile } 
    }),
  confirmForgotPassword: (mobile, confirmationCode, newPassword) =>
    api.post('/api/auth/confirm-forgot-password', null, {
      params: { 
        mobile, 
        confirmation_code: confirmationCode, 
        new_password: newPassword 
      }
    }),
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
    const detectorStatus = offlineDetector.getStatus()
    const navigatorStatus = navigator.onLine
    const isOffline = !detectorStatus || !navigatorStatus
    
    console.log('[ExpensesAPI] create called:', { 
      detectorStatus, 
      navigatorStatus, 
      isOffline, 
      data: { ...data, splits: data.splits?.length || 0 } // Don't log full splits array
    })
    
    // If offline, add to queue instead of calling API
    if (isOffline) {
      console.log('[ExpensesAPI] Offline detected, adding to queue...')
      try {
        const queueItem = await addToQueue(QUEUE_TYPE.CREATE_EXPENSE, data)
        console.log('[ExpensesAPI] Added to queue successfully, queueItem:', queueItem)
        
        // Verify it was added
        const verifyItems = await getAllItems()
        console.log('[ExpensesAPI] Verification - items in queue:', verifyItems.length, verifyItems)
        
        // Return optimistic response
        const response = {
          data: {
            id: `pending-${queueItem.id}`,
            ...data,
            is_pending: true,
            queue_id: queueItem.id
          }
        }
        console.log('[ExpensesAPI] Returning optimistic response:', response)
        return response
      } catch (error) {
        console.error('[ExpensesAPI] Error adding to queue:', error)
        console.error('[ExpensesAPI] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        })
        throw error
      }
    }
    
    // Online - make API call
    console.log('[ExpensesAPI] Online, making API call...')
    try {
      const result = await api.post('/api/expenses/', data)
      console.log('[ExpensesAPI] API call successful:', result.data)
      return result
    } catch (error) {
      console.error('[ExpensesAPI] API call failed:', error)
      // If API call fails with network error, try adding to queue
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network') || error.code === 'ECONNABORTED') {
        console.log('[ExpensesAPI] Network error, falling back to queue...')
        const queueItem = await addToQueue(QUEUE_TYPE.CREATE_EXPENSE, data)
        return {
          data: {
            id: `pending-${queueItem.id}`,
            ...data,
            is_pending: true,
            queue_id: queueItem.id
          }
        }
      }
      throw error
    }
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

