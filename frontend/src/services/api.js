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

// Determine the API base URL
// For mobile app: use AWS API Gateway URL
// For web: use environment variable, AWS URL, or empty for local proxy
const getBaseUrl = () => {
  // Check if running in Capacitor (mobile app)
  const isCapacitor = window.Capacitor !== undefined;
  
  // AWS API Gateway URL (production)
  const AWS_API_URL = 'https://2cjvid84h1.execute-api.ap-south-1.amazonaws.com';
  
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
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response Interceptor
// Runs after EVERY response
api.interceptors.response.use(
  // Success - just return the response
  (response) => response,
  
  // Error handling
  (error) => {
    // If 401 Unauthorized, clear token and redirect to login
    if (error.response?.status === 401) {
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
      message = 'Unable to connect to server. Please check if you are on the same WiFi network.'
    } else if (error.response?.data?.detail) {
      message = error.response.data.detail
    } else if (error.message) {
      message = error.message
    }
    
    console.error('API Error:', error.code, error.message) // For debugging
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
  getAll: () => api.get('/api/groups/'),
  getOne: (id) => api.get(`/api/groups/${id}`),
  create: (data) => api.post('/api/groups/', data),
  update: (id, data) => api.put(`/api/groups/${id}`, data),
  delete: (id) => api.delete(`/api/groups/${id}`),
  addMember: (groupId, data) => api.post(`/api/groups/${groupId}/members`, data),
  addMembersBulk: (groupId, userIds) => api.post(`/api/groups/${groupId}/members/bulk`, { user_ids: userIds }),
  removeMember: (groupId, userId) => api.delete(`/api/groups/${groupId}/members/${userId}`),
}

// Expenses - Note: trailing slashes to avoid 307 redirects
export const expensesAPI = {
  getAll: (params) => api.get('/api/expenses/', { params }),
  getByGroup: (groupId) => api.get('/api/expenses/', { params: { group_id: groupId } }),
  getOne: (id) => api.get(`/api/expenses/${id}`),
  create: (data) => api.post('/api/expenses/', data),
  update: (id, data) => api.put(`/api/expenses/${id}`, data),
  delete: (id) => api.delete(`/api/expenses/${id}`),
  getOverallBalances: () => api.get('/api/expenses/balances/overall'),
  getGroupBalances: (groupId) => api.get(`/api/expenses/balances/group/${groupId}`),
  settle: (data) => api.post('/api/expenses/settle', data),
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

