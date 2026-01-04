/**
 * ===========================================
 * OFFLINE DETECTION SERVICE
 * ===========================================
 * Detects online/offline status and provides
 * callbacks for status changes.
 * ===========================================
 */

class OfflineDetector {
  constructor() {
    this.isOnline = navigator.onLine
    this.listeners = []
    
    // Listen to browser online/offline events
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))
  }

  handleOnline() {
    console.log('🌐 Network: Online')
    this.isOnline = true
    this.notifyListeners(true)
  }

  handleOffline() {
    console.log('📴 Network: Offline')
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

