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
    this.isOnline = navigator.onLine
    this.listeners = []
    this.checkingConnectivity = false
    
    // Listen to browser online/offline events
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))
    
    // Initial connectivity check (delayed to not interfere with app startup)
    setTimeout(() => {
      this.checkConnectivity()
    }, 1000)
    
    // Poll connectivity every 10 seconds (less frequent to avoid interference)
    setInterval(() => {
      this.checkConnectivity()
    }, 10000)
  }

  /**
   * Test actual network connectivity
   */
  async checkConnectivity() {
    if (this.checkingConnectivity) return
    
    this.checkingConnectivity = true
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1500)
      
      // Use a lightweight check that won't interfere with API calls
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
        this.notifyListeners(actuallyOnline)
      }
    } catch (error) {
      // Silently handle errors - don't spam console
      if (this.isOnline && error.name !== 'AbortError') {
        this.isOnline = false
        this.notifyListeners(false)
      }
    } finally {
      this.checkingConnectivity = false
    }
  }

  handleOnline() {
    // Trigger connectivity check when browser says online
    this.checkConnectivity()
  }

  handleOffline() {
    this.isOnline = false
    this.notifyListeners(false)
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

