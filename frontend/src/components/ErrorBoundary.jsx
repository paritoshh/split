/**
 * ===========================================
 * ERROR BOUNDARY
 * ===========================================
 * Catches JavaScript errors in the component tree
 * and displays a fallback UI instead of crashing.
 * ===========================================
 */

import { Component } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    // Clear any corrupted state
    localStorage.removeItem('token')
    window.location.href = '/'
  }

  handleClearAndReload = () => {
    // Clear all app data and reload
    localStorage.clear()
    // Also clear Capacitor preferences if available
    if (window.Capacitor) {
      import('@capacitor/preferences').then(({ Preferences }) => {
        Preferences.clear().finally(() => {
          window.location.href = '/'
        })
      }).catch(() => {
        window.location.href = '/'
      })
    } else {
      window.location.href = '/'
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-300 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            {/* Error Icon */}
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>

            {/* Error Message */}
            <h1 className="text-2xl font-display font-bold text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-400 mb-6">
              The app encountered an unexpected error. Please try one of the options below.
            </p>

            {/* Error Details (collapsed) */}
            {this.state.error && (
              <details className="mb-6 text-left bg-dark-100 rounded-xl p-4 border border-gray-800">
                <summary className="text-sm text-gray-400 cursor-pointer">
                  Technical Details
                </summary>
                <pre className="mt-3 text-xs text-red-400 overflow-auto max-h-32">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={this.handleReload}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Reload App
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full btn-secondary flex items-center justify-center gap-2"
              >
                <Home className="w-5 h-5" />
                Go to Home
              </button>

              <button
                onClick={this.handleClearAndReload}
                className="w-full py-3 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Clear all data & restart
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

