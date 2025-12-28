/**
 * ===========================================
 * BIOMETRIC AUTHENTICATION SERVICE
 * ===========================================
 * Handles fingerprint/Face ID authentication
 * using Capacitor native plugins.
 * 
 * Features:
 * - Check if biometric is available
 * - Enable/disable biometric login
 * - Authenticate with fingerprint
 * - Securely store credentials
 * ===========================================
 */

import { Preferences } from '@capacitor/preferences'

// Storage keys
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled'
const BIOMETRIC_TOKEN_KEY = 'biometric_token'
const BIOMETRIC_USER_KEY = 'biometric_user'

/**
 * Check if we're running in Capacitor (native app)
 */
export const isNativeApp = () => {
  return typeof window !== 'undefined' && window.Capacitor !== undefined
}

/**
 * Dynamically import the biometric plugin (only in native app)
 */
const getBiometricPlugin = async () => {
  if (!isNativeApp()) return null
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric')
    return NativeBiometric
  } catch (error) {
    console.log('Biometric plugin not available:', error)
    return null
  }
}

/**
 * Check if biometric authentication is available on device
 */
export const isBiometricAvailable = async () => {
  if (!isNativeApp()) return { isAvailable: false, biometryType: 'none' }
  
  try {
    const NativeBiometric = await getBiometricPlugin()
    if (!NativeBiometric) return { isAvailable: false, biometryType: 'none' }
    
    const result = await NativeBiometric.isAvailable()
    return {
      isAvailable: result.isAvailable,
      biometryType: result.biometryType // 'touchId', 'faceId', 'fingerprint', etc.
    }
  } catch (error) {
    console.log('Error checking biometric availability:', error)
    return { isAvailable: false, biometryType: 'none' }
  }
}

/**
 * Check if biometric login is enabled for this app
 */
export const isBiometricEnabled = async () => {
  try {
    const { value } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY })
    return value === 'true'
  } catch (error) {
    return false
  }
}

/**
 * Enable biometric login and store credentials
 */
export const enableBiometric = async (token, user) => {
  try {
    const NativeBiometric = await getBiometricPlugin()
    if (!NativeBiometric) throw new Error('Biometric not available')
    
    // First verify with biometric to confirm identity
    await NativeBiometric.verifyIdentity({
      reason: 'Enable fingerprint login',
      title: 'Enable Biometric Login',
      subtitle: 'Verify your identity to enable fingerprint login',
      description: 'Touch the fingerprint sensor'
    })
    
    // Store credentials securely
    await Preferences.set({ key: BIOMETRIC_TOKEN_KEY, value: token })
    await Preferences.set({ key: BIOMETRIC_USER_KEY, value: JSON.stringify(user) })
    await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: 'true' })
    
    return { success: true }
  } catch (error) {
    console.log('Error enabling biometric:', error)
    return { success: false, error: error.message || 'Failed to enable biometric' }
  }
}

/**
 * Disable biometric login and clear stored credentials
 */
export const disableBiometric = async () => {
  try {
    await Preferences.remove({ key: BIOMETRIC_TOKEN_KEY })
    await Preferences.remove({ key: BIOMETRIC_USER_KEY })
    await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: 'false' })
    return { success: true }
  } catch (error) {
    console.log('Error disabling biometric:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Authenticate with biometric and get stored credentials
 */
export const authenticateWithBiometric = async () => {
  try {
    const NativeBiometric = await getBiometricPlugin()
    if (!NativeBiometric) throw new Error('Biometric not available')
    
    // Check if biometric is enabled
    const isEnabled = await isBiometricEnabled()
    if (!isEnabled) throw new Error('Biometric login not enabled')
    
    // Verify identity
    await NativeBiometric.verifyIdentity({
      reason: 'Log in to Hisab',
      title: 'Login with Fingerprint',
      subtitle: 'Verify your identity',
      description: 'Touch the fingerprint sensor to login'
    })
    
    // Get stored credentials
    const { value: token } = await Preferences.get({ key: BIOMETRIC_TOKEN_KEY })
    const { value: userJson } = await Preferences.get({ key: BIOMETRIC_USER_KEY })
    
    if (!token || !userJson) {
      throw new Error('No stored credentials found')
    }
    
    const user = JSON.parse(userJson)
    return { success: true, token, user }
  } catch (error) {
    console.log('Biometric authentication failed:', error)
    return { 
      success: false, 
      error: error.message || 'Biometric authentication failed',
      cancelled: error.message?.includes('cancel') || error.code === 'CANCELLED'
    }
  }
}

/**
 * Update stored token (called when token is refreshed)
 */
export const updateStoredToken = async (newToken) => {
  try {
    const isEnabled = await isBiometricEnabled()
    if (!isEnabled) return { success: false }
    
    await Preferences.set({ key: BIOMETRIC_TOKEN_KEY, value: newToken })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Update stored user (called when profile is updated)
 */
export const updateStoredUser = async (user) => {
  try {
    const isEnabled = await isBiometricEnabled()
    if (!isEnabled) return { success: false }
    
    await Preferences.set({ key: BIOMETRIC_USER_KEY, value: JSON.stringify(user) })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Get biometry type name for display
 */
export const getBiometryTypeName = (biometryType) => {
  const types = {
    touchId: 'Touch ID',
    faceId: 'Face ID',
    fingerprint: 'Fingerprint',
    face: 'Face Recognition',
    iris: 'Iris Scanner'
  }
  return types[biometryType] || 'Biometric'
}

