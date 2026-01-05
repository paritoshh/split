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
    
    // Initial connectivity check
    this.checkConnectivity()
    
    // Poll connectivity every 5 seconds
    setInterval(() => {
      this.checkConnectivity()
    }, 5000)
  }

  /**
   * Test actual network connectivity
   */
  async checkConnectivity() {
    if (this.checkingConnectivity) return
    
    this.checkingConnectivity = true
    
    try {
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve(false), 2000)
      })
      
      const fetchPromise = fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: AbortSignal.timeout(2000)
      }).then(() => true).catch(() => false)
      
      const actuallyOnline = await Promise.race([fetchPromise, timeoutPromise])
      
      if (actuallyOnline !== this.isOnline) {
        this.isOnline = actuallyOnline
        console.log(actuallyOnline ? '🌐 Network: Actually Online' : '📴 Network: Actually Offline')
        this.notifyListeners(actuallyOnline)
      }
    } catch (error) {
      // If check fails, assume offline
      if (this.isOnline) {
        this.isOnline = false
        console.log('📴 Network: Connectivity check failed, assuming offline')
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
    console.log('📴 Network: Browser reports offline')
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

