/**
 * ===========================================
 * LAYOUT COMPONENT
 * ===========================================
 * Shared layout for authenticated pages.
 * Includes sidebar/navbar and main content area.
 * ===========================================
 */

import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import {
  LayoutDashboard,
  Users,
  Receipt,
  Plus,
  LogOut,
  Menu,
  X,
  Split,
  User,
  Settings
} from 'lucide-react'
import { useState, lazy, Suspense } from 'react'
import NotificationBell from './NotificationBell'
import OfflineBanner from './OfflineBanner'
import PendingExpensesBanner from './PendingExpensesBanner'
import SyncIndicator from './SyncIndicator'
// Lazy load OfflineIndicator to avoid module loading issues
const OfflineIndicator = lazy(() => import('./OfflineIndicator'))

function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isOfflineBannerVisible, setIsOfflineBannerVisible] = useState(false)
  const [isPendingBannerVisible, setIsPendingBannerVisible] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/groups', label: 'Groups', icon: Users },
    { path: '/add-expense', label: 'Add Expense', icon: Plus }
  ]

  const isActive = (path) => location.pathname === path

  // Calculate total banner height (each banner is approximately 40-45px tall)
  // Using 45px to be safe and account for padding
  const bannerHeight = (isOfflineBannerVisible ? 45 : 0) + (isPendingBannerVisible ? 45 : 0)

  return (
    <div className="min-h-screen bg-dark-300">
      {/* Offline Banner - shown at top when offline */}
      <OfflineBanner onVisibilityChange={setIsOfflineBannerVisible} />
      {/* Pending Expenses Banner - shown when there are pending expenses */}
      <PendingExpensesBanner onVisibilityChange={setIsPendingBannerVisible} />
      
      {/* Mobile Header - add top margin to push below fixed banners */}
      <header 
        className="lg:hidden flex items-center justify-between p-2 sm:p-3 bg-dark-200 border-b border-gray-800 transition-all duration-200"
        style={{ 
          marginTop: bannerHeight > 0 ? `${bannerHeight}px` : '0px',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)'
        }}
      >
        <Link to="/dashboard" className="flex items-center gap-1.5">
          <div className="w-7 h-7 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
            <Split className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-display font-bold text-white">Hisab</span>
        </Link>

        <div className="flex items-center gap-1">
          <Suspense fallback={null}>
            <OfflineIndicator />
          </Suspense>
          <SyncIndicator />
          <NotificationBell />
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg bg-dark-100 hover:bg-dark-200 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay - compact */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-dark-200 p-4 animate-slide-right safe-top">
            <div className="flex items-center justify-between mb-4">
              <Link to="/dashboard" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                  <Split className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-display font-bold text-white">Hisab</span>
              </Link>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <nav className="space-y-1">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm
                    ${isActive(item.path)
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-gray-400 hover:bg-dark-100 hover:text-white'
                    }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* User section at bottom */}
            <div className="absolute bottom-4 left-4 right-4">
              <Link
                to="/profile"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2 p-3 rounded-lg bg-dark-100 mb-2 hover:bg-dark-300 transition-colors"
              >
                <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center">
                  <span className="text-primary-400 font-semibold text-sm">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <Settings className="w-4 h-4 text-gray-500" />
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-gray-400 hover:bg-dark-100 hover:text-red-400 transition-all text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Log out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-dark-200 border-r border-gray-800 fixed">
          {/* Logo */}
          <div className="p-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                <Split className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-display font-bold text-white">Hisab</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-2">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                  ${isActive(item.path)
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-gray-400 hover:bg-dark-100 hover:text-white'
                  }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center gap-3 mb-3">
              <Link 
                to="/profile"
                className="flex items-center gap-3 p-3 rounded-xl bg-dark-100 flex-1 hover:bg-dark-300 transition-colors"
              >
                <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                  <span className="text-primary-400 font-semibold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{user?.name}</p>
                  <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                </div>
                <Settings className="w-4 h-4 text-gray-500" />
              </Link>
              <NotificationBell />
            </div>
            <div className="mb-3 space-y-2">
              <Suspense fallback={null}>
                <OfflineIndicator />
              </Suspense>
              <SyncIndicator />
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-gray-400 hover:bg-dark-100 hover:text-red-400 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Log out</span>
            </button>
          </div>
        </aside>

        {/* Main Content - add top padding on desktop when banners are visible */}
        <main 
          className="flex-1 lg:ml-64 p-3 sm:p-4 lg:p-8 pb-6 safe-bottom"
          style={{
            paddingTop: typeof window !== 'undefined' && window.innerWidth >= 1024 && bannerHeight > 0
              ? `calc(2rem + ${bannerHeight}px)`
              : undefined
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout

