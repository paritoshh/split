/**
 * ===========================================
 * OFFLINE DETECTION SERVICE
 * ===========================================
 * Detects online/offline status using actual
 * connectivity test, not just navigator.onLine
 * ===========================================
 */

class OfflineDetector {
  constructor() {
    // Trust navigator.onLine initially - don't do aggressive connectivity checks
    // This prevents false negatives that block API calls
    this.isOnline = navigator.onLine
    this.listeners = []
    this.checkingConnectivity = false
    this.lastConnectivityCheck = 0
    this.connectivityCheckInterval = 60000 // Only check every 60 seconds max (very infrequent)
    this.suspectedOffline = false // Track if we suspect we're offline despite navigator.onLine
    
    // Listen to browser online/offline events
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))
    
    // Don't do initial connectivity check - trust navigator.onLine
    // Only verify connectivity if we suspect we're offline
  }

  /**
   * Test actual network connectivity (only when we suspect we're offline)
   * This is called very sparingly to avoid interfering with API calls
   */
  async checkConnectivity() {
    // Only check if we suspect we're offline
    if (!this.suspectedOffline) {
      return
    }
    
    // Throttle connectivity checks - don't run too frequently
    const now = Date.now()
    if (this.checkingConnectivity || (now - this.lastConnectivityCheck) < this.connectivityCheckInterval) {
      return
    }
    
    this.checkingConnectivity = true
    this.lastConnectivityCheck = now
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
      
      // Use a lightweight check that won't interfere with API calls
      // Use no-cors mode to avoid CORS issues
      const fetchPromise = fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      }).then(() => {
        clearTimeout(timeoutId)
        return true
      }).catch(() => {
        clearTimeout(timeoutId)
        return false
      })
      
      const actuallyOnline = await fetchPromise
      
      if (actuallyOnline !== this.isOnline) {
        this.isOnline = actuallyOnline
        this.suspectedOffline = !actuallyOnline
        this.notifyListeners(actuallyOnline)
      } else if (actuallyOnline) {
        // We're actually online, clear suspicion
        this.suspectedOffline = false
      }
    } catch (error) {
      // Only update status if we were online and got an error (not AbortError)
      if (this.isOnline && error.name !== 'AbortError') {
        this.isOnline = false
        this.suspectedOffline = true
        this.notifyListeners(false)
      }
    } finally {
      this.checkingConnectivity = false
    }
  }

  handleOnline() {
    // When browser says we're online, trust it immediately
    // Don't do connectivity check - it might interfere with API calls
    if (!this.isOnline) {
      this.isOnline = true
      this.suspectedOffline = false
      this.notifyListeners(true)
    }
  }

  handleOffline() {
    // Browser says offline - trust it immediately
    this.isOnline = false
    this.suspectedOffline = true
    this.notifyListeners(false)
  }
  
  /**
   * Mark that we suspect we're offline (e.g., after API call failures)
   * This will trigger a connectivity check
   */
  suspectOffline() {
    if (!this.suspectedOffline && this.isOnline) {
      this.suspectedOffline = true
      // Check connectivity after a short delay
      setTimeout(() => {
        this.checkConnectivity()
      }, 1000)
    }
  }

  /**
   * Subscribe to online/offline status changes
   */
  onStatusChange(callback) {
    this.listeners.push(callback)
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  notifyListeners(isOnline) {
    this.listeners.forEach(callback => {
      try {
        callback(isOnline)
      } catch (error) {
        console.error('Error in offline status callback:', error)
      }
    })
  }

  /**
   * Check current online status
   */
  getStatus() {
    return this.isOnline
  }

  /**
   * Wait for online status (returns promise)
   */
  waitForOnline() {
    if (this.isOnline) {
      return Promise.resolve()
    }
    
    return new Promise((resolve) => {
      const unsubscribe = this.onStatusChange((isOnline) => {
        if (isOnline) {
          unsubscribe()
          resolve()
        }
      })
    })
  }
}

// Create singleton instance
export const offlineDetector = new OfflineDetector()

// Export convenience functions
export const isOnline = () => offlineDetector.getStatus()
export const onOnlineStatusChange = (callback) => offlineDetector.onStatusChange(callback)
export const waitForOnline = () => offlineDetector.waitForOnline()

