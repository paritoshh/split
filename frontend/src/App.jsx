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
import * as biometricService from './services/biometric'

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
import BiometricSetupPrompt from './components/BiometricSetupPrompt'

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
  
  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [biometricType, setBiometricType] = useState('none')
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false)

  // Check biometric availability on mount
  useEffect(() => {
    const checkBiometric = async () => {
      const { isAvailable, biometryType } = await biometricService.isBiometricAvailable()
      setBiometricAvailable(isAvailable)
      setBiometricType(biometryType)
      
      const isEnabled = await biometricService.isBiometricEnabled()
      setBiometricEnabled(isEnabled)
    }
    checkBiometric()
  }, [])

  // Check if user is logged in on app load
  useEffect(() => {
    const checkAuth = async () => {
      // First, try biometric login if enabled
      if (biometricService.isNativeApp()) {
        const isEnabled = await biometricService.isBiometricEnabled()
        if (isEnabled) {
          const result = await biometricService.authenticateWithBiometric()
          if (result.success) {
            // Verify token is still valid
            try {
              const response = await api.get('/api/auth/me', {
                headers: { Authorization: `Bearer ${result.token}` }
              })
              localStorage.setItem('token', result.token)
              setToken(result.token)
              setUser(response.data)
              setLoading(false)
              return
            } catch (error) {
              // Token expired, clear biometric credentials
              await biometricService.disableBiometric()
              setBiometricEnabled(false)
            }
          }
        }
      }
      
      // Fall back to regular token check
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
  }, []) // Run only on mount

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
    
    // Check if we should offer biometric setup (native app + biometric available + not enabled yet)
    if (biometricService.isNativeApp() && biometricAvailable && !biometricEnabled) {
      setShowBiometricPrompt(true)
    }
    
    return userResponse.data
  }

  // Enable biometric login
  const enableBiometricLogin = async () => {
    if (!token || !user) return { success: false, error: 'Not logged in' }
    
    const result = await biometricService.enableBiometric(token, user)
    if (result.success) {
      setBiometricEnabled(true)
    }
    setShowBiometricPrompt(false)
    return result
  }

  // Disable biometric login
  const disableBiometricLogin = async () => {
    const result = await biometricService.disableBiometric()
    if (result.success) {
      setBiometricEnabled(false)
    }
    return result
  }

  // Skip biometric setup
  const skipBiometricSetup = () => {
    setShowBiometricPrompt(false)
  }

  // Register function
  const register = async (userData) => {
    const response = await api.post('/api/auth/register', userData)
    return response.data
  }

  // Logout function
  const logout = async () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    // Note: We don't disable biometric on logout - user may want to login with fingerprint again
  }

  const value = {
    user,
    setUser,  // Allow profile page to update user
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!token && !!user,
    // Biometric
    biometricAvailable,
    biometricEnabled,
    biometricType,
    showBiometricPrompt,
    enableBiometricLogin,
    disableBiometricLogin,
    skipBiometricSetup
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
        
        {/* Biometric Setup Prompt - shows after login on native app */}
        <BiometricSetupPrompt />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

