/**
 * ===========================================
 * REGISTER PAGE
 * ===========================================
 * Handles user registration with Cognito email verification
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import * as cognitoService from '../services/cognito'
import { 
  Split, Mail, Lock, Eye, EyeOff, ArrowRight, 
  AlertCircle, User, Phone, CheckCircle, Check 
} from 'lucide-react'

function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [verificationCode, setVerificationCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('register') // 'register' or 'verify'
  const [registeredEmail, setRegisteredEmail] = useState('')
  
  const { register, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  
  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }
  
  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    // Validate password length
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    
    setLoading(true)
    
    try {
      // Register user (this will register in Cognito and backend)
      await register({
        name: formData.name,
        email: formData.email,  // Email is mandatory
        mobile: '',  // Hidden from UI, kept in code
        password: formData.password
      })
      
      // If Cognito is configured, show verification step
      if (cognitoService.isCognitoConfigured()) {
        setRegisteredEmail(formData.email)
        setStep('verify')
        setSuccess('Registration successful! Please check your email for verification code.')
      } else {
        // If Cognito is not configured, auto-login (backward compatibility)
        navigate('/login')
      }
      
    } catch (err) {
      // Handle Cognito-specific errors
      let errorMessage = 'Registration failed. Please try again.'
      
      if (err.code === 'UsernameExistsException') {
        errorMessage = 'Email address already registered. Please login instead.'
      } else if (err.code === 'InvalidPasswordException') {
        errorMessage = 'Password does not meet requirements. Please use a stronger password.'
      } else if (err.code === 'InvalidParameterException') {
        errorMessage = err.message || 'Invalid input. Please check your details.'
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }
  
  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      await cognitoService.confirmSignup(registeredEmail, verificationCode)
      setSuccess('Email verified successfully! You can now login.')
      
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/login', { 
          state: { message: 'Email verified successfully! Please login.' }
        })
      }, 2000)
      
    } catch (err) {
      let errorMessage = 'Verification failed. Please try again.'
      
      if (err.code === 'CodeMismatchException') {
        errorMessage = 'Invalid verification code. Please check and try again.'
      } else if (err.code === 'ExpiredCodeException') {
        errorMessage = 'Verification code has expired. Please request a new one.'
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }
  
  const handleResendCode = async () => {
    setError('')
    setLoading(true)
    
    try {
      await cognitoService.resendConfirmationCode(registeredEmail)
      setSuccess('Verification code sent! Please check your email.')
    } catch (err) {
      setError(err.message || 'Failed to resend code. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  // Password strength indicator
  const getPasswordStrength = () => {
    const password = formData.password
    if (!password) return { strength: 0, text: '', color: '' }
    
    let strength = 0
    if (password.length >= 6) strength++
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    
    const levels = [
      { text: 'Weak', color: 'bg-red-500' },
      { text: 'Fair', color: 'bg-orange-500' },
      { text: 'Good', color: 'bg-yellow-500' },
      { text: 'Strong', color: 'bg-green-500' },
      { text: 'Very Strong', color: 'bg-green-400' }
    ]
    
    return { strength, ...levels[Math.min(strength - 1, 4)] || { text: '', color: '' } }
  }
  
  const passwordStrength = getPasswordStrength()
  
  // Verification step
  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
              <Split className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-display font-bold text-white">Hisab</span>
          </Link>
          
          {/* Heading */}
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            Verify your email
          </h1>
          <p className="text-gray-400 mb-8">
            We've sent a verification code to <strong>{registeredEmail}</strong>
          </p>
          
          {/* Success Message */}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
              <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          {/* Verification Form */}
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-300 mb-2">
                Verification Code
              </label>
              <input
                type="text"
                id="verificationCode"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="input-field"
                placeholder="Enter 6-digit code"
                required
                maxLength={6}
                pattern="[0-9]{6}"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Verify Email
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
          
          {/* Resend Code */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm mb-2">
              Didn't receive the code?
            </p>
            <button
              onClick={handleResendCode}
              disabled={loading}
              className="text-primary-400 hover:text-primary-300 font-medium text-sm"
            >
              Resend code
            </button>
          </div>
          
          {/* Back to Register */}
          <p className="text-center text-gray-400 mt-6">
            <button
              onClick={() => setStep('register')}
              className="text-primary-400 hover:text-primary-300 font-medium"
            >
              Back to registration
            </button>
          </p>
        </div>
      </div>
    )
  }
  
  // Registration step
  return (
    <div className="min-h-screen bg-dark-300 flex safe-y">
      {/* Left Side - Decorative */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-500/10 to-secondary-500/10 items-center justify-center p-12">
        <div className="max-w-md">
          <h2 className="text-3xl font-display font-bold text-white mb-6">
            Join thousands splitting expenses smarter
          </h2>
          
          <div className="space-y-4">
            {[
              'Create unlimited groups',
              'Track expenses in real-time',
              'Multiple split options',
              'Settle up with UPI',
              'AI-powered receipt scanning'
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary-400" />
                <span className="text-gray-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
              <Split className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-display font-bold text-white">Hisab</span>
          </Link>
          
          {/* Heading */}
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            Create your account
          </h1>
          <p className="text-gray-400 mb-8">
            Start splitting expenses with friends today
          </p>
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          {/* Register Form */}
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input-field pl-12"
                  placeholder="Paritosh Agarwal"
                  required
                />
              </div>
            </div>
            
            {/* Email Field (Mandatory) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field pl-12"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            
            {/* Mobile Field (Hidden - kept in code but not shown in UI) */}
            <input
              type="hidden"
              name="mobile"
              value=""
            />
            
            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="input-field pl-12 pr-12"
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              {/* Password Strength */}
              {formData.password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-dark-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${passwordStrength.color} transition-all duration-300`}
                      style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{passwordStrength.text}</span>
                </div>
              )}
            </div>
            
            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input-field pl-12"
                  placeholder="Confirm your password"
                  required
                />
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-red-400 text-sm mt-1">Passwords don't match</p>
              )}
            </div>
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || formData.password !== formData.confirmPassword}
              className="w-full btn-primary flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
          
          {/* Login Link */}
          <p className="text-center text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
