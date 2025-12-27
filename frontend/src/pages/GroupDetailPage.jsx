/**
 * ===========================================
 * GROUP DETAIL PAGE
 * ===========================================
 * Shows group details, members, expenses, and balances.
 * - Delete expense (creator only)
 * - Delete group (admin only)
 * - User search autocomplete when adding members
 * ===========================================
 */

import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { groupsAPI, expensesAPI } from '../services/api'
import Layout from '../components/Layout'
import UserSearchSelect from '../components/UserSearchSelect'
import {
  Plus,
  Users,
  Receipt,
  ArrowLeft,
  UserPlus,
  X,
  TrendingUp,
  TrendingDown,
  Trash2,
  AlertTriangle,
  ChevronRight
} from 'lucide-react'

function GroupDetailPage() {
  const { groupId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [group, setGroup] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [balances, setBalances] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showDeleteGroup, setShowDeleteGroup] = useState(false)
  const [showDeleteExpense, setShowDeleteExpense] = useState(null)
  const [activeTab, setActiveTab] = useState('expenses')
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [groupId])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [groupRes, expensesRes, balancesRes] = await Promise.all([
        groupsAPI.getOne(groupId),
        expensesAPI.getByGroup(groupId),
        expensesAPI.getGroupBalances(groupId).catch(() => null)
      ])

      setGroup(groupRes.data)
      setExpenses(expensesRes.data)
      if (balancesRes) setBalances(balancesRes.data)
    } catch (err) {
      setError('Failed to load group')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteExpense = async (expenseId) => {
    setDeleteLoading(true)
    try {
      await expensesAPI.delete(expenseId)
      setExpenses(expenses.filter(e => e.id !== expenseId))
      setShowDeleteExpense(null)
      // Refresh balances
      const balancesRes = await expensesAPI.getGroupBalances(groupId).catch(() => null)
      if (balancesRes) setBalances(balancesRes.data)
    } catch (err) {
      alert(err.message || 'Failed to delete expense')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDeleteGroup = async () => {
    setDeleteLoading(true)
    try {
      await groupsAPI.delete(groupId)
      navigate('/groups')
    } catch (err) {
      alert(err.message || 'Failed to delete group')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse">
          <div className="h-8 bg-dark-100 rounded w-1/3 mb-4" />
          <div className="h-4 bg-dark-100 rounded w-1/4 mb-8" />
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-dark-100 rounded-2xl" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  if (error || !group) {
    return (
      <Layout>
        <div className="text-center py-16">
          <p className="text-red-400 mb-4">{error || 'Group not found'}</p>
          <Link to="/groups" className="btn-primary">
            Back to Groups
          </Link>
        </div>
      </Layout>
    )
  }

  const isAdmin = group.members?.some(m => m.user_id === user?.id && m.role === 'admin')
  const isCreator = group.created_by_id === user?.id

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/groups')}
          className="p-2 rounded-lg bg-dark-100 hover:bg-dark-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold text-white">
            {group.name}
          </h1>
          {group.description && (
            <p className="text-gray-400 mt-1">{group.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isCreator && (
            <button
              onClick={() => setShowDeleteGroup(true)}
              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
              title="Delete Group"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <Link
            to={`/add-expense?group=${groupId}`}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Expense
          </Link>
        </div>
      </div>

      {/* Balance Cards */}
      {balances && (
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <p className="text-gray-400 text-sm mb-1">Total Expenses</p>
            <p className="text-2xl font-bold text-white">
              ₹{balances.total_expenses?.toLocaleString('en-IN') || '0'}
            </p>
          </div>
          <div className="card">
            <p className="text-gray-400 text-sm mb-1">You Paid</p>
            <p className="text-2xl font-bold text-blue-400">
              ₹{balances.your_total_paid?.toLocaleString('en-IN') || '0'}
            </p>
          </div>
          <div className="card">
            <p className="text-gray-400 text-sm mb-1">Your Share</p>
            <p className="text-2xl font-bold text-purple-400">
              ₹{balances.your_total_share?.toLocaleString('en-IN') || '0'}
            </p>
          </div>
          <div className="card">
            <p className="text-gray-400 text-sm mb-1">Your Balance</p>
            <p className={`text-2xl font-bold ${balances.your_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {balances.your_balance >= 0 ? '+' : ''}₹{balances.your_balance?.toFixed(2) || '0'}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-100 rounded-xl p-1 mb-6">
        {['expenses', 'members', 'balances'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all
              ${activeTab === tab
                ? 'bg-dark-200 text-white'
                : 'text-gray-400 hover:text-white'
              }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="space-y-3">
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">No expenses yet</p>
              <Link
                to={`/add-expense?group=${groupId}`}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add First Expense
              </Link>
            </div>
          ) : (
            expenses.map(expense => {
              const userPaid = expense.paid_by_id === user?.id
              const userSplit = expense.splits?.find(s => s.user_id === user?.id)
              const userShare = userSplit?.amount || 0
              const balance = userPaid ? expense.amount - userShare : -userShare
              const canDelete = expense.paid_by_id === user?.id

              return (
                <div key={expense.id} className="card group hover:border-primary-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <Link 
                      to={`/expenses/${expense.id}`}
                      className="flex items-center gap-4 flex-1"
                    >
                      <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                        <Receipt className="w-5 h-5 text-primary-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white group-hover:text-primary-400 transition-colors">
                          {expense.description}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Paid by {expense.paid_by_name} • {formatDate(expense.expense_date)}
                        </p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-4">
                      <Link to={`/expenses/${expense.id}`} className="text-right">
                        <p className="font-semibold text-white">
                          ₹{expense.amount.toLocaleString('en-IN')}
                        </p>
                        {balance !== 0 && (
                          <p className={`text-sm ${balance > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {balance > 0 ? `you lent ₹${balance.toFixed(2)}` : `you owe ₹${Math.abs(balance).toFixed(2)}`}
                          </p>
                        )}
                      </Link>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            setShowDeleteExpense(expense)
                          }}
                          className="p-2 rounded-lg opacity-0 group-hover:opacity-100 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-primary-400 transition-colors" />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div>
          {isAdmin && (
            <button
              onClick={() => setShowAddMember(true)}
              className="btn-secondary flex items-center gap-2 mb-4"
            >
              <UserPlus className="w-5 h-5" />
              Add Member
            </button>
          )}

          <div className="space-y-3">
            {group.members?.map(member => (
              <div key={member.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                    <span className="text-primary-400 font-semibold">
                      {member.user_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {member.user_name}
                      {member.user_id === user?.id && (
                        <span className="text-gray-500 text-sm ml-2">(you)</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">{member.user_email}</p>
                  </div>
                </div>
                <span className={`text-sm px-3 py-1 rounded-full
                  ${member.role === 'admin'
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'bg-gray-700/50 text-gray-400'
                  }`}>
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balances Tab */}
      {activeTab === 'balances' && balances?.balances && (
        <div className="space-y-3">
          {balances.balances.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">All settled up! 🎉</p>
            </div>
          ) : (
            balances.balances.map(balance => (
              <div key={balance.user_id} className="card flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {balance.amount > 0 ? (
                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-white">{balance.user_name}</p>
                    <p className="text-sm text-gray-500">
                      {balance.amount > 0 ? 'owes you' : 'you owe'}
                    </p>
                  </div>
                </div>
                <p className={`text-xl font-bold ${balance.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ₹{Math.abs(balance.amount).toFixed(2)}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <AddMemberModal
          groupId={groupId}
          existingMemberIds={group.members?.map(m => m.user_id) || []}
          onClose={() => setShowAddMember(false)}
          onAdded={() => {
            setShowAddMember(false)
            fetchData()
          }}
        />
      )}

      {/* Delete Group Confirmation Modal */}
      {showDeleteGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteGroup(false)} />
          <div className="relative bg-dark-100 rounded-2xl p-6 w-full max-w-md border border-gray-800">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-white">Delete Group</h2>
                <p className="text-gray-400 text-sm">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <strong>"{group.name}"</strong>? All expenses and data will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteGroup(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={deleteLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Group
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Expense Confirmation Modal */}
      {showDeleteExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteExpense(null)} />
          <div className="relative bg-dark-100 rounded-2xl p-6 w-full max-w-md border border-gray-800">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-white">Delete Expense</h2>
                <p className="text-gray-400 text-sm">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <strong>"{showDeleteExpense.description}"</strong> (₹{showDeleteExpense.amount})?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteExpense(null)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteExpense(showDeleteExpense.id)}
                disabled={deleteLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

// Add Member Modal - Uses shared UserSearchSelect component
function AddMemberModal({ groupId, existingMemberIds, onClose, onAdded }) {
  const [selectedUsers, setSelectedUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedUsers.length === 0) {
      setError('Please select at least one user')
      return
    }

    setLoading(true)
    setError('')

    try {
      const userIds = selectedUsers.map(u => u.id)
      await groupsAPI.addMembersBulk(groupId, userIds)
      onAdded()
    } catch (err) {
      setError(err.message || 'Failed to add members')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-dark-100 rounded-2xl p-6 w-full max-w-md border border-gray-800 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-500 hover:text-white">
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-display font-bold text-white mb-4">
          Add Members
        </h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Search - Using shared component */}
          <UserSearchSelect
            selectedUsers={selectedUsers}
            onSelectionChange={setSelectedUsers}
            excludeUserIds={existingMemberIds}
            label="Search by name or email"
            placeholder="Type at least 4 characters..."
            multiple={true}
          />

          <button
            type="submit"
            disabled={loading || selectedUsers.length === 0}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Adding...' : `Add ${selectedUsers.length || 0} Member${selectedUsers.length !== 1 ? 's' : ''}`}
          </button>
        </form>
      </div>
    </div>
  )
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export default GroupDetailPage
