/**
 * ===========================================
 * PROFILE PAGE
 * ===========================================
 * User profile management - update name, phone,
 * and UPI ID for payments.
 * ===========================================
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { authAPI } from '../services/api'
import { isNativeApp, getBiometryTypeName } from '../services/biometric'
import Layout from '../components/Layout'
import {
  User,
  Mail,
  Phone,
  Smartphone,
  Save,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Fingerprint,
  Shield,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'

function ProfilePage() {
  const navigate = useNavigate()
  const { 
    user, 
    setUser,
    biometricAvailable,
    biometricEnabled,
    biometricType,
    enableBiometricLogin,
    disableBiometricLogin
  } = useAuth()
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    upi_id: ''
  })
  const [loading, setLoading] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [error, setError] = useState('')
  const [biometricError, setBiometricError] = useState('')
  const [success, setSuccess] = useState('')

  const isNative = isNativeApp()
  const biometryName = getBiometryTypeName(biometricType)

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        upi_id: user.upi_id || ''
      })
    }
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await authAPI.updateMe(formData)
      setUser(response.data)
      setSuccess('Profile updated successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-dark-100 hover:bg-dark-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-display font-bold text-white">
            Profile Settings
          </h1>
          <p className="text-gray-400">Manage your account details</p>
        </div>
      </div>

      <div className="max-w-xl">
        {/* Profile Card */}
        <div className="card mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-primary-500/20 rounded-full flex items-center justify-center">
              <span className="text-primary-400 text-3xl font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{user?.name}</h2>
              <p className="text-gray-400">{user?.email}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="input-field pl-12 opacity-60 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field pl-12"
                  placeholder="Your name"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field pl-12"
                  placeholder="+91 9876543210"
                />
              </div>
            </div>

            {/* UPI ID */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                UPI ID
                <span className="ml-2 text-primary-400 text-xs font-normal">
                  For receiving payments
                </span>
              </label>
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.upi_id}
                  onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                  className="input-field pl-12"
                  placeholder="yourname@paytm or 9876543210@upi"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This UPI ID will be used when others pay you
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>

        {/* Biometric Login Section - Only show on native app */}
        {isNative && biometricAvailable && (
          <div className="card mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                  <Fingerprint className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{biometryName} Login</h3>
                  <p className="text-sm text-gray-400">
                    {biometricEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={async () => {
                  setBiometricLoading(true)
                  setBiometricError('')
                  
                  if (biometricEnabled) {
                    const result = await disableBiometricLogin()
                    if (!result.success) {
                      setBiometricError(result.error || 'Failed to disable')
                    }
                  } else {
                    const result = await enableBiometricLogin()
                    if (!result.success) {
                      setBiometricError(result.error || 'Failed to enable')
                    }
                  }
                  
                  setBiometricLoading(false)
                }}
                disabled={biometricLoading}
                className="relative"
              >
                {biometricLoading ? (
                  <div className="w-6 h-6 border-2 border-gray-600 border-t-primary-500 rounded-full animate-spin" />
                ) : biometricEnabled ? (
                  <ToggleRight className="w-10 h-10 text-primary-500" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-gray-600" />
                )}
              </button>
            </div>
            
            {biometricError && (
              <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-xs">{biometricError}</p>
              </div>
            )}
            
            <div className="mt-3 p-3 bg-dark-200 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Shield className="w-4 h-4 text-green-400" />
                <span>Your credentials are stored securely on this device</span>
              </div>
            </div>
          </div>
        )}

        {/* UPI Info Card */}
        <div className="card bg-gradient-to-br from-primary-500/10 to-secondary-500/10 border-primary-500/30">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Why add UPI ID?</h3>
              <p className="text-sm text-gray-400">
                When you add your UPI ID, friends can easily pay you directly through 
                GPay, PhonePe, or other UPI apps. The payment link will be pre-filled 
                with your details!
              </p>
              <div className="mt-3 space-y-1 text-sm text-gray-500">
                <p>✓ Instant payments via any UPI app</p>
                <p>✓ No need to share bank details</p>
                <p>✓ Pre-filled amount and name</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default ProfilePage

