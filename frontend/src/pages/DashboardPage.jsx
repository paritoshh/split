/**
 * ===========================================
 * DASHBOARD PAGE
 * ===========================================
 * Main page after login - shows overview of
 * balances, recent expenses, and groups.
 * ===========================================
 */

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'
import { expensesAPI, groupsAPI } from '../services/api'
import { offlineDetector } from '../services/offline/detector'
import { getAllItems, QUEUE_TYPE, QUEUE_STATUS } from '../services/offline/syncQueue'
import Layout from '../components/Layout'
import SettleUpModal from '../components/SettleUpModal'
import VoiceExpenseModal from '../components/VoiceExpenseModal'
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Users,
  Receipt,
  ArrowRight,
  RefreshCw,
  Banknote,
  Mic,
  FileText
} from 'lucide-react'

function DashboardPage() {
  const { user } = useAuth()
  const [balances, setBalances] = useState([])
  const [groups, setGroups] = useState([])
  const [expenses, setExpenses] = useState([])
  const [drafts, setDrafts] = useState([])
  const [pendingExpenses, setPendingExpenses] = useState([]) // Pending expenses from queue
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('recent') // 'recent' or 'drafts'
  const [isOffline, setIsOffline] = useState(!offlineDetector.getStatus())
  const [usingCache, setUsingCache] = useState(false)
  
  // Settle up modal state
  const [showSettleModal, setShowSettleModal] = useState(false)
  const [selectedBalance, setSelectedBalance] = useState(null)
  
  // Voice expense modal state
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)

  // Use refs to prevent duplicate calls and track mount status
  const fetchingRef = useRef(false)
  const mountedRef = useRef(true)
  const unsubscribeRef = useRef(null)
  
  // Fetch data on component mount
  useEffect(() => {
    mountedRef.current = true
    
    // Initial fetch (only once, skip if already fetching)
    if (!fetchingRef.current) {
      fetchData()
    }
    
    // Listen to online/offline status changes
    const checkStatus = () => {
      if (mountedRef.current) {
        setIsOffline(!offlineDetector.getStatus())
      }
    }
    checkStatus()
    
    // Subscribe to status changes (only once)
    if (!unsubscribeRef.current) {
      unsubscribeRef.current = offlineDetector.onStatusChange((isOnline) => {
        if (!mountedRef.current) return
        
        setIsOffline(!isOnline)
        // Only refresh if coming back online AND not already fetching
        if (isOnline && !fetchingRef.current) {
          fetchData()
        }
      })
    }
    
    return () => {
      mountedRef.current = false
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [])

  const fetchData = async () => {
    // Prevent duplicate calls
    if (fetchingRef.current) {
      console.log('⏭️ Skipping duplicate fetchData call')
      return
    }
    
    fetchingRef.current = true
    setLoading(true)
    setError('')
    setUsingCache(false)

    try {
      const wasOffline = !offlineDetector.getStatus()
      
      // Fetch all data in parallel
      const [balancesRes, groupsRes, expensesRes, draftsRes] = await Promise.all([
        expensesAPI.getOverallBalances().catch((err) => {
          console.warn('Failed to fetch balances:', err)
          return { data: [] }
        }),
        groupsAPI.getAll().catch((err) => {
          console.warn('Failed to fetch groups:', err)
          return { data: [] }
        }),
        expensesAPI.getAll({ limit: 10 }).catch((err) => {
          console.warn('Failed to fetch expenses:', err)
          return { data: [] }
        }),
        expensesAPI.getDrafts().catch((err) => {
          console.warn('Failed to fetch drafts:', err)
          return { data: [] }
        })
      ])

      // Only update state if component is still mounted
      if (mountedRef.current) {
        setBalances(balancesRes.data)
        setGroups(groupsRes.data)
      setExpenses(expensesRes.data)
      const draftsData = draftsRes.data || []
      console.log('📝 Drafts fetched:', draftsData.length, draftsData)
      setDrafts(draftsData)
      
      // Load pending expenses from sync queue
      await loadPendingExpenses()
      
      // Show cache indicator if we're offline
      if (wasOffline) {
        setUsingCache(true)
      }
      }
    } catch (err) {
      if (mountedRef.current) {
        const errorMsg = err.message || 'Failed to load data. Please try again.'
        setError(errorMsg)
        
        // If offline and error, we're using cache
        if (!offlineDetector.getStatus()) {
          setUsingCache(true)
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
      fetchingRef.current = false
    }
  }

  // Load pending expenses from sync queue
  const loadPendingExpenses = async () => {
    try {
      const queueItems = await getAllItems()
      
      const pending = queueItems
        .filter(item => 
          item.type === QUEUE_TYPE.CREATE_EXPENSE && 
          (item.status === QUEUE_STATUS.PENDING || item.status === QUEUE_STATUS.SYNCING)
        )
        .map(item => ({
          id: `pending-${item.id}`,
          ...item.data,
          is_pending: true,
          queue_id: item.id,
          queue_status: item.status,
          created_at: new Date(item.createdAt).toISOString(),
          expense_date: item.data.expense_date || new Date().toISOString().split('T')[0],
          category: item.data.category || 'other',
          amount: item.data.amount || 0,
          description: item.data.description || 'Pending expense',
          paid_by_id: item.data.paid_by_id || user?.id,
          splits: item.data.splits || []
        }))
      
      setPendingExpenses(pending)
    } catch (error) {
      console.error('❌ Failed to load pending expenses:', error)
    }
  }

  // Refresh pending expenses periodically
  useEffect(() => {
    loadPendingExpenses()
    const interval = setInterval(() => {
      loadPendingExpenses()
    }, 2000) // Check every 2 seconds
    
    return () => clearInterval(interval)
  }, [])

  // Handle opening voice modal - fetch group details first
  const handleOpenVoiceModal = async (group) => {
    try {
      const response = await groupsAPI.getOne(group.id)
      setSelectedGroup(response.data)
      setShowVoiceModal(true)
    } catch (err) {
      console.error('Failed to fetch group:', err)
    }
  }

  // Calculate total balance
  const totalBalance = balances.reduce((sum, b) => sum + b.amount, 0)

  // Split balances into owed and owing
  const youAreOwed = balances.filter(b => b.amount > 0)
  const youOwe = balances.filter(b => b.amount < 0)

  return (
    <Layout>
      {/* Header - compact on mobile */}
      <div className="flex items-center justify-between gap-2 mb-4 lg:mb-8">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl lg:text-3xl font-display font-bold text-white truncate">
            Hi, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">Here's your expense summary</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-dark-100 hover:bg-dark-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 lg:w-5 lg:h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex gap-2">
            <Link to="/add-expense" className="btn-primary flex items-center gap-1 text-xs sm:text-sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </Link>
            <Link to="/drafts" className="btn-secondary flex items-center gap-1 text-xs sm:text-sm">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Drafts</span>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}
      
      {usingCache && isOffline && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-6">
          <p className="text-yellow-400 text-sm">
            📦 Showing cached data. Some information may be outdated.
          </p>
        </div>
      )}

      {/* Balance Cards - compact grid on mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6 mb-4 lg:mb-8">
        {/* Total Balance */}
        <div className="card text-center sm:text-left">
          <p className="text-gray-400 text-[10px] sm:text-xs lg:text-sm mb-1">Total</p>
          <p className={`text-sm sm:text-lg lg:text-2xl font-bold ${totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ₹{Math.abs(totalBalance).toFixed(0)}
          </p>
        </div>

        {/* You Are Owed */}
        <div className="card text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1 mb-1">
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
            <p className="text-gray-400 text-[10px] sm:text-xs lg:text-sm">Owed</p>
          </div>
          <p className="text-sm sm:text-lg lg:text-2xl font-bold text-green-400">
            ₹{youAreOwed.reduce((sum, b) => sum + b.amount, 0).toFixed(0)}
          </p>
        </div>

        {/* You Owe */}
        <div className="card text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1 mb-1">
            <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
            <p className="text-gray-400 text-[10px] sm:text-xs lg:text-sm">Owe</p>
          </div>
          <p className="text-sm sm:text-lg lg:text-2xl font-bold text-red-400">
            ₹{Math.abs(youOwe.reduce((sum, b) => sum + b.amount, 0)).toFixed(0)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 lg:gap-8">
        {/* Groups Section */}
        <div>
          <div className="flex items-center justify-between mb-2 lg:mb-4">
            <h2 className="text-sm sm:text-base lg:text-xl font-display font-semibold text-white flex items-center gap-1 lg:gap-2">
              <Users className="w-4 h-4 lg:w-5 lg:h-5 text-primary-400" />
              Groups
            </h2>
            <Link to="/groups" className="text-primary-400 hover:text-primary-300 text-xs flex items-center gap-1">
              All
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="card animate-pulse">
                  <div className="h-4 bg-dark-200 rounded w-1/3 mb-1" />
                  <div className="h-3 bg-dark-200 rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="card text-center py-4">
              <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-xs mb-2">No groups yet</p>
              <Link to="/groups" className="btn-primary text-xs py-1.5 px-3">
                <Plus className="w-3 h-3 inline mr-1" />
                Create
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.slice(0, 3).map(group => (
                <div key={group.id} className="card hover:border-primary-500/50">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/groups/${group.id}`} className="min-w-0 flex-1">
                      <h3 className="font-medium text-white text-sm truncate">{group.name}</h3>
                      <p className="text-[10px] sm:text-xs text-gray-500">
                        {group.member_count} members
                      </p>
                    </Link>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleOpenVoiceModal(group)}
                        className="p-1.5 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 transition-colors"
                        title="Voice Expense"
                      >
                        <Mic className="w-3.5 h-3.5" />
                      </button>
                      <Link to={`/groups/${group.id}`} className={`text-right ${group.your_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        <p className="font-semibold text-sm">
                          ₹{Math.abs(group.your_balance || 0).toFixed(0)}
                        </p>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Expenses / Drafts Section */}
        <div>
          <div className="flex items-center justify-between mb-2 lg:mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base lg:text-xl font-display font-semibold text-white flex items-center gap-1 lg:gap-2">
                <Receipt className="w-4 h-4 lg:w-5 lg:h-5 text-secondary-400" />
                Expenses
              </h2>
              {/* Tabs */}
              <div className="flex gap-1 bg-dark-200 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('recent')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    activeTab === 'recent'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Recent
                </button>
                <button
                  onClick={() => setActiveTab('drafts')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors relative ${
                    activeTab === 'drafts'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Drafts
                  {drafts.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-yellow-500 text-yellow-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {drafts.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="card animate-pulse">
                  <div className="h-4 bg-dark-200 rounded w-2/3 mb-1" />
                  <div className="h-3 bg-dark-200 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : activeTab === 'drafts' ? (
            // Drafts tab
            (() => {
              console.log('📝 Dashboard Drafts Tab - activeTab:', activeTab, 'drafts:', drafts.length, drafts)
              return null
            })(),
            drafts.length === 0 ? (
              <div className="card text-center py-4">
                <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-xs mb-2">No draft expenses</p>
                <Link to="/add-expense" className="btn-primary text-xs py-1.5 px-3">
                  <Plus className="w-3 h-3 inline mr-1" />
                  Create Expense
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {drafts.slice(0, 4).map(draft => {
                  // Clean notes
                  const cleanNotes = draft.notes?.replace(/__DRAFT_SPLIT_INFO__:.*/, '').trim() || ''
                  
                  return (
                    <Link 
                      key={draft.id} 
                      to={`/drafts`}
                      className="card block hover:border-yellow-500/30 transition-all border-yellow-500/20"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-yellow-500/20">
                            <FileText className="w-4 h-4 text-yellow-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-white text-sm truncate">{draft.description}</h3>
                              <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded">
                                Draft
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                              {draft.group_name || 'Personal'} • {formatDate(draft.expense_date)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-sm text-yellow-400">
                            ₹{parseFloat(draft.amount).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
                {drafts.length > 4 && (
                  <Link to="/drafts" className="card block text-center py-2 hover:border-primary-500/30 transition-all">
                    <p className="text-xs text-primary-400">View all {drafts.length} drafts →</p>
                  </Link>
                )}
              </div>
            )
          ) : expenses.filter(e => !e.is_draft).length === 0 ? (
            <div className="card text-center py-4">
              <Receipt className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-xs mb-2">No expenses yet</p>
              <Link to="/add-expense" className="btn-primary text-xs py-1.5 px-3">
                <Plus className="w-3 h-3 inline mr-1" />
                Add
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Merge regular expenses with pending expenses */}
              {(() => {
                const allExpenses = [...expenses.filter(e => !e.is_draft), ...pendingExpenses]
                console.log('📊 All expenses (regular + pending):', {
                  regular: expenses.filter(e => !e.is_draft).length,
                  pending: pendingExpenses.length,
                  total: allExpenses.length,
                  expenses: allExpenses
                })
                
                return allExpenses
                  .sort((a, b) => {
                    // Sort by date (newest first)
                    const dateA = new Date(a.expense_date || a.created_at || 0)
                    const dateB = new Date(b.expense_date || b.created_at || 0)
                    return dateB - dateA
                  })
                  .slice(0, 4)
                  .map(expense => {
                    // Determine if user paid or owes
                    const userPaid = expense.paid_by_id === user?.id
                    const userSplit = expense.splits?.find(s => s.user_id === user?.id)
                    const userShare = userSplit?.amount || 0
                    const balance = userPaid ? expense.amount - userShare : -userShare
                    const isPending = expense.is_pending === true || expense.id?.startsWith('pending-')
                    
                    console.log('🎨 Rendering expense:', {
                      id: expense.id,
                      description: expense.description,
                      is_pending: expense.is_pending,
                      idStartsWithPending: expense.id?.startsWith('pending-'),
                      isPending,
                      queue_status: expense.queue_status
                    })

                    return (
                      <div
                        key={expense.id} 
                        className={`card block transition-all ${
                          isPending 
                            ? '!border-yellow-500 border-2 bg-yellow-500/10 hover:!border-yellow-400' 
                            : 'hover:border-primary-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                              ${getCategoryColor(expense.category || 'other')}`}>
                              <Receipt className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-white text-sm truncate">{expense.description || 'Pending expense'}</h3>
                                {isPending && (
                                  <span className="px-2 py-0.5 bg-yellow-500/40 text-yellow-200 text-[10px] font-semibold rounded-md flex-shrink-0 border border-yellow-400/60 shadow-sm">
                                    {expense.queue_status === 'syncing' ? 'Syncing...' : 'Pending'}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                                {expense.group_name || 'Personal'} • {formatDate(expense.expense_date || expense.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`font-semibold text-sm ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ₹{Math.abs(balance).toFixed(2)}
                            </p>
                          </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* Balance Details - compact on mobile */}
      {balances.length > 0 && (
        <div className="mt-4 lg:mt-8">
          <h2 className="text-sm sm:text-base lg:text-xl font-display font-semibold text-white mb-2 lg:mb-4">
            Balances
          </h2>
          <div className="grid sm:grid-cols-2 gap-2 lg:gap-4">
            {balances.map(balance => (
              <div key={balance.user_id} className="card">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-400 font-semibold text-sm">
                        {balance.user_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm truncate">{balance.user_name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{balance.user_email}</p>
                    </div>
                  </div>
                  <div className={`text-right flex-shrink-0 ${balance.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    <p className="text-xs">{balance.amount >= 0 ? 'owes you' : 'you owe'}</p>
                    <p className="text-sm font-bold">₹{Math.abs(balance.amount).toFixed(2)}</p>
                  </div>
                </div>
                
                {/* Settle Up Button */}
                <button
                  onClick={() => {
                    setSelectedBalance(balance)
                    setShowSettleModal(true)
                  }}
                  className="w-full mt-2 py-1.5 px-3 rounded-lg border border-primary-500/50 text-primary-400 
                    hover:bg-primary-500/10 transition-colors flex items-center justify-center gap-1 text-xs"
                >
                  <Banknote className="w-3 h-3" />
                  {balance.amount < 0 ? 'Settle' : 'Record'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settle Up Modal */}
      <SettleUpModal
        isOpen={showSettleModal}
        onClose={() => {
          setShowSettleModal(false)
          setSelectedBalance(null)
        }}
        balance={selectedBalance}
        onSettled={fetchData}
      />

      {/* Voice Expense Modal */}
      {selectedGroup && (
        <VoiceExpenseModal
          isOpen={showVoiceModal}
          onClose={() => {
            setShowVoiceModal(false)
            setSelectedGroup(null)
          }}
          groupId={selectedGroup.id}
          groupMembers={selectedGroup.members || []}
          onExpenseCreated={fetchData}
        />
      )}
    </Layout>
  )
}

// Helper functions
function getCategoryColor(category) {
  const colors = {
    food: 'bg-orange-500/20 text-orange-400',
    transport: 'bg-blue-500/20 text-blue-400',
    sports: 'bg-green-500/20 text-green-400',
    entertainment: 'bg-purple-500/20 text-purple-400',
    utilities: 'bg-yellow-500/20 text-yellow-400',
    rent: 'bg-red-500/20 text-red-400',
    other: 'bg-gray-500/20 text-gray-400'
  }
  return colors[category] || colors.other
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

export default DashboardPage

