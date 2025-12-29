/**
 * ===========================================
 * DASHBOARD PAGE
 * ===========================================
 * Main page after login - shows overview of
 * balances, recent expenses, and groups.
 * ===========================================
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'
import { expensesAPI, groupsAPI } from '../services/api'
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
  Mic
} from 'lucide-react'

function DashboardPage() {
  const { user } = useAuth()
  const [balances, setBalances] = useState([])
  const [groups, setGroups] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Settle up modal state
  const [showSettleModal, setShowSettleModal] = useState(false)
  const [selectedBalance, setSelectedBalance] = useState(null)
  
  // Voice expense modal state
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)

  // Fetch data on component mount
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError('')

    try {
      // Fetch all data in parallel
      const [balancesRes, groupsRes, expensesRes] = await Promise.all([
        expensesAPI.getOverallBalances().catch(() => ({ data: [] })),
        groupsAPI.getAll().catch(() => ({ data: [] })),
        expensesAPI.getAll({ limit: 5 }).catch(() => ({ data: [] }))
      ])

      setBalances(balancesRes.data)
      setGroups(groupsRes.data)
      setExpenses(expensesRes.data)
    } catch (err) {
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
          <Link to="/add-expense" className="btn-primary flex items-center gap-1 text-xs sm:text-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400">{error}</p>
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

        {/* Recent Expenses Section */}
        <div>
          <div className="flex items-center justify-between mb-2 lg:mb-4">
            <h2 className="text-sm sm:text-base lg:text-xl font-display font-semibold text-white flex items-center gap-1 lg:gap-2">
              <Receipt className="w-4 h-4 lg:w-5 lg:h-5 text-secondary-400" />
              Recent
            </h2>
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
          ) : expenses.length === 0 ? (
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
              {expenses.slice(0, 4).map(expense => {
                // Determine if user paid or owes
                const userPaid = expense.paid_by_id === user?.id
                const userSplit = expense.splits?.find(s => s.user_id === user?.id)
                const userShare = userSplit?.amount || 0
                const balance = userPaid ? expense.amount - userShare : -userShare

                return (
                  <Link 
                    key={expense.id} 
                    to={`/expenses/${expense.id}`}
                    className="card block hover:border-primary-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                          ${getCategoryColor(expense.category)}`}>
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-white text-sm truncate">{expense.description}</h3>
                          <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                            {expense.group_name || 'Personal'} • {formatDate(expense.expense_date)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-semibold text-sm ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ₹{Math.abs(balance).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  </Link>
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
                    <p className="text-sm font-bold">₹{Math.abs(balance.amount).toFixed(0)}</p>
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

