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
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Users,
  Receipt,
  ArrowRight,
  RefreshCw,
  Banknote
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

  // Calculate total balance
  const totalBalance = balances.reduce((sum, b) => sum + b.amount, 0)

  // Split balances into owed and owing
  const youAreOwed = balances.filter(b => b.amount > 0)
  const youOwe = balances.filter(b => b.amount < 0)

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-1">
            Welcome back, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-gray-400">Here's your expense summary</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="btn-secondary p-3"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link to="/add-expense" className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Expense
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* Total Balance */}
        <div className="card">
          <p className="text-gray-400 text-sm mb-2">Total Balance</p>
          <p className={`text-3xl font-bold ${totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalBalance >= 0 ? '+' : ''}₹{Math.abs(totalBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {totalBalance >= 0 ? 'You are owed overall' : 'You owe overall'}
          </p>
        </div>

        {/* You Are Owed */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <p className="text-gray-400 text-sm">You are owed</p>
          </div>
          <p className="text-3xl font-bold text-green-400">
            +₹{youAreOwed.reduce((sum, b) => sum + b.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            from {youAreOwed.length} {youAreOwed.length === 1 ? 'person' : 'people'}
          </p>
        </div>

        {/* You Owe */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <p className="text-gray-400 text-sm">You owe</p>
          </div>
          <p className="text-3xl font-bold text-red-400">
            -₹{Math.abs(youOwe.reduce((sum, b) => sum + b.amount, 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            to {youOwe.length} {youOwe.length === 1 ? 'person' : 'people'}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Groups Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-400" />
              Your Groups
            </h2>
            <Link to="/groups" className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
              View all
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="card animate-pulse">
                  <div className="h-5 bg-dark-200 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-dark-200 rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="card text-center py-8">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">No groups yet</p>
              <Link to="/groups" className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create Group
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.slice(0, 4).map(group => (
                <Link
                  key={group.id}
                  to={`/groups/${group.id}`}
                  className="card block hover:border-primary-500/50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{group.name}</h3>
                      <p className="text-sm text-gray-500">
                        {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                    <div className={`text-right ${group.your_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      <p className="font-semibold">
                        {group.your_balance >= 0 ? '+' : ''}₹{Math.abs(group.your_balance || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {group.your_balance >= 0 ? 'you are owed' : 'you owe'}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Expenses Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-secondary-400" />
              Recent Expenses
            </h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="card animate-pulse">
                  <div className="h-5 bg-dark-200 rounded w-2/3 mb-2" />
                  <div className="h-4 bg-dark-200 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div className="card text-center py-8">
              <Receipt className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">No expenses yet</p>
              <Link to="/add-expense" className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Expense
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map(expense => {
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center
                          ${getCategoryColor(expense.category)}`}>
                          <Receipt className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{expense.description}</h3>
                          <p className="text-sm text-gray-500">
                            {expense.group_name || 'Personal'} • {formatDate(expense.expense_date)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {balance >= 0 ? '+' : ''}₹{Math.abs(balance).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {userPaid ? 'you lent' : 'you owe'}
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

      {/* Balance Details */}
      {balances.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-display font-semibold text-white mb-4">
            Balance Details
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {balances.map(balance => (
              <div key={balance.user_id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                      <span className="text-primary-400 font-semibold">
                        {balance.user_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{balance.user_name}</p>
                      <p className="text-sm text-gray-500">{balance.user_email}</p>
                    </div>
                  </div>
                  <div className={`text-right ${balance.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    <p className="font-semibold">
                      {balance.amount >= 0 ? 'owes you' : 'you owe'}
                    </p>
                    <p className="text-lg font-bold">
                      ₹{Math.abs(balance.amount).toFixed(2)}
                    </p>
                  </div>
                </div>
                
                {/* Settle Up Button */}
                <button
                  onClick={() => {
                    setSelectedBalance(balance)
                    setShowSettleModal(true)
                  }}
                  className="w-full mt-4 py-2 px-4 rounded-lg border border-primary-500/50 text-primary-400 
                    hover:bg-primary-500/10 transition-colors flex items-center justify-center gap-2"
                >
                  <Banknote className="w-4 h-4" />
                  {balance.amount < 0 ? 'Settle Up' : 'Record Payment'}
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

