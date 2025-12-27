/**
 * ===========================================
 * MAIN APP COMPONENT
 * ===========================================
 * This is the root component of our application.
 * 
 * What it does:
 * 1. Sets up React Router for navigation
 * 2. Provides authentication context
 * 3. Defines all routes/pages
 * 
 * React Router:
 * - Enables single-page app navigation
 * - URL changes but page doesn't reload
 * - Each route maps to a component
 * ===========================================
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import api from './services/api'

// Pages
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import AddExpensePage from './pages/AddExpensePage'
import ExpenseDetailPage from './pages/ExpenseDetailPage'
import ProfilePage from './pages/ProfilePage'

// Create Auth Context
// Context allows sharing state across components without passing props
export const AuthContext = createContext(null)

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// Auth Provider Component
function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  // Check if user is logged in on app load
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await api.get('/api/auth/me')
          setUser(response.data)
        } catch (error) {
          // Token invalid or expired
          localStorage.removeItem('token')
          setToken(null)
        }
      }
      setLoading(false)
    }
    checkAuth()
  }, [token])

  // Login function
  const login = async (email, password) => {
    const formData = new FormData()
    formData.append('username', email)
    formData.append('password', password)
    
    const response = await api.post('/api/auth/login', formData)
    const { access_token } = response.data
    
    localStorage.setItem('token', access_token)
    setToken(access_token)
    
    // Fetch user data
    const userResponse = await api.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    })
    setUser(userResponse.data)
    
    return userResponse.data
  }

  // Register function
  const register = async (userData) => {
    const response = await api.post('/api/auth/register', userData)
    return response.data
  }

  // Logout function
  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    setUser,  // Allow profile page to update user
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!token && !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Protected Route Component
// Redirects to login if user is not authenticated
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Main App Component
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Protected Routes - Require Authentication */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/groups" element={
            <ProtectedRoute>
              <GroupsPage />
            </ProtectedRoute>
          } />
          <Route path="/groups/:groupId" element={
            <ProtectedRoute>
              <GroupDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/add-expense" element={
            <ProtectedRoute>
              <AddExpensePage />
            </ProtectedRoute>
          } />
          <Route path="/expenses/:expenseId" element={
            <ProtectedRoute>
              <ExpenseDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
          
          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

