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
// For mobile app: use your Mac's local IP (must be on same WiFi)
// For web: use empty string (proxy handles it) or deployed URL
const getBaseUrl = () => {
  // Check if running in Capacitor (mobile app)
  const isCapacitor = window.Capacitor !== undefined;
  
  if (isCapacitor) {
    // Mobile app - use your Mac's IP address
    // TODO: Change this to your deployed server URL when you deploy
    return 'http://192.168.1.55:8000';
  }
  
  // Web app - use environment variable or empty for proxy
  return import.meta.env.VITE_API_URL || '';
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: getBaseUrl(),
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
    
    // Return a friendly error message
    const message = error.response?.data?.detail || 
                    error.message || 
                    'Something went wrong'
    
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
  getUserUPIId: (userId) => api.get(`/api/settlements/user/${userId}/upi-id`),
}

