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
import api, { setCheckingAuth } from './services/api'
import * as biometricService from './services/biometric'
import { initSyncService } from './services/offline/syncService'
import * as cognitoService from './services/cognito'

// Pages
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import DraftExpensesPage from './pages/DraftExpensesPage'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import AddExpensePage from './pages/AddExpensePage'
import ExpenseDetailPage from './pages/ExpenseDetailPage'
import ProfilePage from './pages/ProfilePage'
import BiometricSetupPrompt from './components/BiometricSetupPrompt'
import ErrorBoundary from './components/ErrorBoundary'

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
      setCheckingAuth(true) // Prevent redirects during auth check
      let biometricSuccess = false
      
      // First, try biometric login if enabled (native app only)
      if (biometricService.isNativeApp()) {
        try {
          const isEnabled = await biometricService.isBiometricEnabled()
          if (isEnabled) {
            const result = await biometricService.authenticateWithBiometric()
            if (result.success && result.token) {
              // Verify token is still valid
              try {
                const response = await api.get('/api/auth/me', {
                  headers: { Authorization: `Bearer ${result.token}` }
                })
                localStorage.setItem('token', result.token)
                localStorage.setItem('userId', response.data.id)
                setToken(result.token)
                setUser(response.data)
                biometricSuccess = true
              } catch (error) {
                // Token expired, clear biometric credentials
                console.log('Biometric token expired, clearing...')
                await biometricService.disableBiometric()
                setBiometricEnabled(false)
              }
            }
            // If user cancelled biometric, just continue to normal login screen
          }
        } catch (error) {
          console.log('Biometric check failed:', error)
          // Continue to regular auth check
        }
      }
      
      // If biometric login succeeded, we're done
      if (biometricSuccess) {
        setLoading(false)
        return
      }
      
      // Check if Cognito is configured
      if (cognitoService.isCognitoConfigured()) {
        // Try to get Cognito session
        try {
          const session = await cognitoService.getCurrentUserSession()
          const accessToken = session.accessToken
          
          localStorage.setItem('token', accessToken)
          if (session.idToken) {
            localStorage.setItem('idToken', session.idToken)
          }
          if (session.refreshToken) {
            localStorage.setItem('refreshToken', session.refreshToken)
          }
          
          // Fetch user data from backend
          const response = await Promise.race([
            api.get('/api/auth/me'),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Auth check timeout')), 5000)
            )
          ])
          localStorage.setItem('userId', response.data.id)
          setUser(response.data)
          setToken(accessToken)
        } catch (error) {
          // No valid Cognito session - clear everything
          console.log('No valid Cognito session:', error.message)
          localStorage.removeItem('token')
          localStorage.removeItem('idToken')
          localStorage.removeItem('refreshToken')
          setToken(null)
          setUser(null)
        }
      } else {
        // Fall back to regular token check (from localStorage) for backward compatibility
        const storedToken = localStorage.getItem('token')
        if (storedToken) {
          try {
            // Add timeout to prevent hanging if backend is down
            const response = await Promise.race([
              api.get('/api/auth/me'),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Auth check timeout')), 5000)
              )
            ])
            localStorage.setItem('userId', response.data.id)
            setUser(response.data)
            setToken(storedToken)
          } catch (error) {
            // Only clear token on actual auth errors (401), not network errors
            if (error.response?.status === 401) {
              console.log('Stored token invalid (401), clearing...')
              localStorage.removeItem('token')
              setToken(null)
              setUser(null)
            } else if (error.code === 'ERR_NETWORK' || 
                       error.message?.includes('Network') || 
                       error.message?.includes('timeout') ||
                       error.code === 'ECONNABORTED') {
              console.log('Network/timeout error during auth check, keeping token for offline mode')
              setToken(null)
              setUser(null)
            } else {
              console.log('Auth check failed, clearing token:', error.message)
              localStorage.removeItem('token')
              setToken(null)
              setUser(null)
            }
          }
        } else {
          setToken(null)
          setUser(null)
        }
      }
      setLoading(false)
      // Wait a bit before allowing redirects to ensure state is stable
      setTimeout(() => {
        setCheckingAuth(false)
      }, 1000)
    }
    checkAuth()
  }, []) // Run only on mount

  // Login function
  const login = async (email, password) => {
    if (cognitoService.isCognitoConfigured()) {
      // Use Cognito login
      const tokens = await cognitoService.loginUser(email, password)
      
      localStorage.setItem('token', tokens.accessToken)
      if (tokens.idToken) {
        localStorage.setItem('idToken', tokens.idToken)
      }
      if (tokens.refreshToken) {
        localStorage.setItem('refreshToken', tokens.refreshToken)
      }
      setToken(tokens.accessToken)
      
      // Fetch user data from backend
      const userResponse = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      })
      localStorage.setItem('userId', userResponse.data.id)
      setUser(userResponse.data)
      
      // Check if we should offer biometric setup (native app only)
      if (biometricService.isNativeApp()) {
        try {
          const { isAvailable } = await biometricService.isBiometricAvailable()
          const isEnabled = await biometricService.isBiometricEnabled()
          
          if (isAvailable && !isEnabled) {
            setBiometricAvailable(true)
            setShowBiometricPrompt(true)
          }
        } catch (error) {
          console.log('Biometric check failed:', error)
        }
      }
      
      return userResponse.data
    } else {
      // Fallback to backend login (for backward compatibility)
      const response = await api.post('/api/auth/login', { email, password })
      const { access_token } = response.data
      
      localStorage.setItem('token', access_token)
      setToken(access_token)
      
      const userResponse = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${access_token}` }
      })
      localStorage.setItem('userId', userResponse.data.id)
      setUser(userResponse.data)
      
      return userResponse.data
    }
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
    if (cognitoService.isCognitoConfigured()) {
      // Register in Cognito first
      await cognitoService.registerUser(
        userData.email,  // Email is mandatory
        userData.password,
        userData.name,
        userData.mobile  // Mobile is optional, hidden from UI
      )
      
      // Then register in backend
      const response = await api.post('/api/auth/register', userData)
      return response.data
    } else {
      // Fallback to backend registration
      const response = await api.post('/api/auth/register', userData)
      return response.data
    }
  }

  // Logout function
  const logout = async () => {
    if (cognitoService.isCognitoConfigured()) {
      cognitoService.logout()
    }
    localStorage.removeItem('token')
    localStorage.removeItem('idToken')
    localStorage.removeItem('refreshToken')
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
    <ErrorBoundary>
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
            <Route path="/drafts" element={
                <ProtectedRoute>
                    <DraftExpensesPage />
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
    </ErrorBoundary>
  )
}

export default App

