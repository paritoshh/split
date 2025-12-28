/**
 * ===========================================
 * BIOMETRIC SETUP PROMPT
 * ===========================================
 * Modal that appears after login to offer
 * fingerprint/Face ID login setup.
 * ===========================================
 */

import { useState } from 'react'
import { useAuth } from '../App'
import { getBiometryTypeName } from '../services/biometric'
import { Fingerprint, X, Shield, Smartphone } from 'lucide-react'

function BiometricSetupPrompt() {
  const { 
    showBiometricPrompt, 
    biometricType, 
    enableBiometricLogin, 
    skipBiometricSetup 
  } = useAuth()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!showBiometricPrompt) return null

  const biometryName = getBiometryTypeName(biometricType)

  const handleEnable = async () => {
    setLoading(true)
    setError('')
    
    const result = await enableBiometricLogin()
    
    if (!result.success) {
      setError(result.error || 'Failed to enable biometric login')
    }
    
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      <div className="relative bg-dark-100 rounded-2xl p-5 w-full max-w-sm border border-gray-800 animate-fade-in">
        {/* Close button */}
        <button 
          onClick={skipBiometricSetup}
          className="absolute right-3 top-3 p-1 text-gray-500 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Fingerprint className="w-9 h-9 text-white" />
        </div>

        {/* Title */}
        <h2 className="text-lg font-display font-bold text-white text-center mb-2">
          Enable {biometryName} Login?
        </h2>

        {/* Description */}
        <p className="text-sm text-gray-400 text-center mb-4">
          Log in faster next time using your {biometryName.toLowerCase()}. 
          Your credentials are stored securely on this device.
        </p>

        {/* Benefits */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Shield className="w-4 h-4 text-green-400" />
            <span>Secure local storage</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Smartphone className="w-4 h-4 text-blue-400" />
            <span>Quick login without typing</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 mb-3">
            <p className="text-red-400 text-xs text-center">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleEnable}
            disabled={loading}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Fingerprint className="w-4 h-4" />
                Enable {biometryName}
              </>
            )}
          </button>
          
          <button
            onClick={skipBiometricSetup}
            disabled={loading}
            className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  )
}

export default BiometricSetupPrompt

