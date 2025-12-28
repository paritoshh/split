/**
 * ===========================================
 * NOTIFICATION BELL COMPONENT
 * ===========================================
 * Shows notification count and dropdown list.
 * ===========================================
 */

import { useState, useEffect, useRef } from 'react'
import { notificationsAPI } from '../services/api'
import { Bell, X, Check, CheckCheck, Receipt, Users, Wallet } from 'lucide-react'

function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  // Fetch unread count on mount and periodically
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount()
      setUnreadCount(response.data.count)
    } catch (err) {
      console.error('Failed to fetch unread count')
    }
  }

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const response = await notificationsAPI.getAll()
      setNotifications(response.data)
    } catch (err) {
      console.error('Failed to fetch notifications')
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      fetchNotifications()
    }
  }

  const markAsRead = async (id) => {
    try {
      await notificationsAPI.markAsRead([id])
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, is_read: true } : n
      ))
      setUnreadCount(Math.max(0, unreadCount - 1))
    } catch (err) {
      console.error('Failed to mark as read')
    }
  }

  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead()
      setNotifications(notifications.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all as read')
    }
  }

  const getIcon = (type) => {
    switch (type) {
      case 'expense_added':
        return <Receipt className="w-5 h-5 text-primary-400" />
      case 'settlement':
        return <Wallet className="w-5 h-5 text-green-400" />
      case 'group_invite':
        return <Users className="w-5 h-5 text-blue-400" />
      default:
        return <Bell className="w-5 h-5 text-gray-400" />
    }
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg bg-dark-100 hover:bg-dark-200 transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown - fixed on mobile, absolute on desktop */}
      {isOpen && (
        <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto top-16 sm:top-full sm:right-0 sm:mt-2 sm:w-72 lg:w-80 bg-dark-100 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-[100] animate-fade-in max-h-[70vh] sm:max-h-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <h3 className="font-semibold text-white text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[calc(70vh-50px)] sm:max-h-[350px]">
            {loading ? (
              <div className="p-6 text-center">
                <div className="w-5 h-5 border-2 border-gray-600 border-t-primary-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 border-b border-gray-800 hover:bg-dark-200 transition-colors
                    ${!notification.is_read ? 'bg-primary-500/5' : ''}`}
                >
                  <div className="flex gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(notification.notification_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${!notification.is_read ? 'text-white font-medium' : 'text-gray-300'}`}>
                        {notification.title}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
                      <p className="text-[10px] text-gray-600 mt-1">{formatTime(notification.created_at)}</p>
                    </div>
                    {!notification.is_read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="flex-shrink-0 p-1 text-gray-500 hover:text-primary-400"
                        title="Mark as read"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell

