/**
 * ===========================================
 * EXPENSE DETAIL PAGE
 * ===========================================
 * View and edit expense details.
 * Only the creator can edit/delete.
 * ===========================================
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../App'
import { expensesAPI, groupsAPI, authAPI } from '../services/api'
import Layout from '../components/Layout'
import {
  ArrowLeft,
  Calendar,
  Users,
  Edit2,
  Trash2,
  Save,
  AlertTriangle,
  FileText,
  Tag,
  Check,
  Search,
  UserPlus,
  Loader2,
  X
} from 'lucide-react'

const categories = [
  { value: 'food', label: 'Food & Drinks', emoji: '🍕' },
  { value: 'transport', label: 'Transport', emoji: '🚗' },
  { value: 'sports', label: 'Sports', emoji: '🏸' },
  { value: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { value: 'utilities', label: 'Utilities', emoji: '💡' },
  { value: 'rent', label: 'Rent', emoji: '🏠' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'other', label: 'Other', emoji: '📦' }
]

function ExpenseDetailPage() {
  const { expenseId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [expense, setExpense] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  // For editing splits
  const [availableMembers, setAvailableMembers] = useState([])
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    fetchExpense()
  }, [expenseId])

  const fetchExpense = async () => {
    setLoading(true)
    try {
      const response = await expensesAPI.getOne(expenseId)
      setExpense(response.data)
      
      // Initialize edit data
      const expData = response.data
      setEditData({
        description: expData.description,
        notes: expData.notes || '',
        category: expData.category,
        amount: expData.amount,
        expense_date: new Date(expData.expense_date).toISOString().split('T')[0]
      })
      
      // Initialize selected members from splits
      const memberIds = expData.splits?.map(s => s.user_id) || []
      setSelectedMemberIds(memberIds)
      
      // Build available members from current splits
      const members = expData.splits?.map(s => ({
        user_id: s.user_id,
        user_name: s.user_name,
        user_email: s.user_email
      })) || []
      setAvailableMembers(members)
      
      // If in a group, fetch group members
      if (expData.group_id) {
        try {
          const groupResponse = await groupsAPI.getOne(expData.group_id)
          const groupMembers = groupResponse.data.members?.map(m => ({
            user_id: m.user_id,
            user_name: m.user_name,
            user_email: m.user_email
          })) || []
          
          // Merge with existing members (in case some are not in group anymore)
          const allMembers = [...members]
          groupMembers.forEach(gm => {
            if (!allMembers.find(m => m.user_id === gm.user_id)) {
              allMembers.push(gm)
            }
          })
          setAvailableMembers(allMembers)
        } catch (err) {
          console.error('Failed to fetch group members:', err)
        }
      }
    } catch (err) {
      setError('Failed to load expense')
    } finally {
      setLoading(false)
    }
  }

  // Search users (when not in a group)
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 4) {
        setSearchResults([])
        return
      }
      setSearchLoading(true)
      try {
        const response = await authAPI.searchUsers(searchQuery)
        // Filter out already selected users
        const filteredResults = response.data.filter(
          u => !availableMembers.some(m => m.user_id === u.id)
        )
        setSearchResults(filteredResults)
      } catch (err) {
        console.error('Search failed:', err)
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }
    const debounceTimer = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery, availableMembers])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    
    try {
      // Prepare update data
      const updateData = {
        description: editData.description,
        notes: editData.notes,
        category: editData.category,
        amount: parseFloat(editData.amount),
        expense_date: new Date(editData.expense_date).toISOString()
      }
      
      // Add split data if members changed
      if (selectedMemberIds.length > 0) {
        updateData.split_type = 'equal'
        updateData.split_with_user_ids = selectedMemberIds
      }
      
      await expensesAPI.update(expenseId, updateData)
      await fetchExpense() // Refresh data
      setIsEditing(false)
    } catch (err) {
      setError(err.message || 'Failed to update expense')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await expensesAPI.delete(expenseId)
      // Navigate back
      if (expense.group_id) {
        navigate(`/groups/${expense.group_id}`)
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.message || 'Failed to delete expense')
      setDeleting(false)
    }
  }

  const getCategoryInfo = (categoryValue) => {
    return categories.find(c => c.value === categoryValue) || categories[categories.length - 1]
  }

  const toggleMember = (userId) => {
    if (selectedMemberIds.includes(userId)) {
      // Don't allow deselecting if only 1 person left
      if (selectedMemberIds.length <= 1) return
      setSelectedMemberIds(selectedMemberIds.filter(id => id !== userId))
    } else {
      setSelectedMemberIds([...selectedMemberIds, userId])
    }
  }

  const addSearchedUser = (searchedUser) => {
    // Add to available members
    const newMember = {
      user_id: searchedUser.id,
      user_name: searchedUser.name,
      user_email: searchedUser.email
    }
    setAvailableMembers([...availableMembers, newMember])
    setSelectedMemberIds([...selectedMemberIds, searchedUser.id])
    setSearchQuery('')
    setSearchResults([])
  }

  const selectAllMembers = () => {
    setSelectedMemberIds(availableMembers.map(m => m.user_id))
  }

  const deselectAllMembers = () => {
    // Keep at least one member
    if (availableMembers.length > 0) {
      setSelectedMemberIds([availableMembers[0].user_id])
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse">
          <div className="h-8 bg-dark-100 rounded w-1/3 mb-4" />
          <div className="h-4 bg-dark-100 rounded w-1/4 mb-8" />
          <div className="card">
            <div className="h-6 bg-dark-200 rounded w-1/2 mb-4" />
            <div className="h-4 bg-dark-200 rounded w-1/3" />
          </div>
        </div>
      </Layout>
    )
  }

  if (error && !expense) {
    return (
      <Layout>
        <div className="text-center py-16">
          <p className="text-red-400 mb-4">{error || 'Expense not found'}</p>
          <button onClick={() => navigate(-1)} className="btn-primary">
            Go Back
          </button>
        </div>
      </Layout>
    )
  }

  const isCreator = expense?.paid_by_id === user?.id
  const categoryInfo = getCategoryInfo(expense?.category)
  const userSplit = expense?.splits?.find(s => s.user_id === user?.id)
  const userPaid = expense?.paid_by_id === user?.id
  const userShare = userSplit?.amount || 0
  const balance = userPaid ? expense?.amount - userShare : -userShare

  // Calculate per person amount for editing
  const perPersonAmount = selectedMemberIds.length > 0 
    ? parseFloat(editData.amount || 0) / selectedMemberIds.length 
    : 0

  return (
    <Layout>
      {/* Header - compact on mobile */}
      <div className="flex items-center justify-between mb-3 lg:mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg bg-dark-100 hover:bg-dark-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-display font-bold text-white">
              Expense
            </h1>
            <p className="text-xs text-gray-400">
              {expense?.group_name ? (
                <Link to={`/groups/${expense.group_id}`} className="hover:text-primary-400">
                  {expense.group_name}
                </Link>
              ) : (
                'Personal'
              )}
            </p>
          </div>
        </div>

        {isCreator && !isEditing && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-lg bg-dark-100 hover:bg-dark-200 transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* Main Info Card */}
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center text-3xl">
              {categoryInfo.emoji}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    className="input-field text-xl font-bold"
                    placeholder="Description"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-2xl text-primary-400">₹</span>
                    <input
                      type="number"
                      value={editData.amount}
                      onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                      className="input-field text-2xl font-bold w-40"
                      placeholder="Amount"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white mb-1">{expense?.description}</h2>
                  <p className="text-3xl font-bold text-primary-400">
                    ₹{expense?.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Balance Info */}
          {!isEditing && balance !== 0 && (
            <div className={`mt-4 p-3 rounded-xl ${balance > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              <p className={`font-medium ${balance > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {balance > 0 
                  ? `You lent ₹${balance.toFixed(2)}` 
                  : `You owe ₹${Math.abs(balance).toFixed(2)}`
                }
              </p>
            </div>
          )}
        </div>

        {/* Details Card */}
        <div className="card space-y-4">
          {/* Paid By */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
              <span className="text-primary-400 font-semibold">
                {expense?.paid_by_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Paid by</p>
              <p className="text-white font-medium">
                {expense?.paid_by_name}
                {userPaid && <span className="text-gray-500 ml-2">(you)</span>}
              </p>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-dark-200 rounded-full flex items-center justify-center">
              <Calendar className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500">Date</p>
              {isEditing ? (
                <input
                  type="date"
                  value={editData.expense_date}
                  onChange={(e) => setEditData({ ...editData, expense_date: e.target.value })}
                  className="input-field mt-1"
                />
              ) : (
                <p className="text-white font-medium">
                  {new Date(expense?.expense_date).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Category */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-dark-200 rounded-full flex items-center justify-center">
              <Tag className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500">Category</p>
              {isEditing ? (
                <select
                  value={editData.category}
                  onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                  className="input-field mt-1"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.emoji} {cat.label}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-white font-medium">
                  {categoryInfo.emoji} {categoryInfo.label}
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          {(expense?.notes || isEditing) && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-dark-200 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">Notes</p>
                {isEditing ? (
                  <textarea
                    value={editData.notes}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                    className="input-field mt-1 resize-none"
                    rows={3}
                    placeholder="Add notes..."
                  />
                ) : (
                  <p className="text-white">{expense?.notes || 'No notes'}</p>
                )}
              </div>
            </div>
          )}

          {/* Split Type */}
          {!isEditing && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-dark-200 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Split Type</p>
                <p className="text-white font-medium capitalize">{expense?.split_type}</p>
              </div>
            </div>
          )}
        </div>

        {/* Splits Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Split Details</h3>
            {isEditing && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllMembers}
                  className="text-sm text-primary-400 hover:text-primary-300"
                >
                  Select All
                </button>
                <span className="text-gray-600">|</span>
                <button
                  type="button"
                  onClick={deselectAllMembers}
                  className="text-sm text-gray-400 hover:text-gray-300"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              {/* Search for users (when not in a group) */}
              {!expense?.group_id && (
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field pl-12"
                    placeholder="Search users to add (min 4 chars)..."
                  />
                  {searchLoading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                    </div>
                  )}
                  
                  {searchQuery.length >= 4 && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-dark-100 border border-gray-700 rounded-xl overflow-hidden z-10 max-h-60 overflow-y-auto">
                      {searchResults.map(result => (
                        <button
                          key={result.id}
                          type="button"
                          onClick={() => addSearchedUser(result)}
                          className="w-full p-3 flex items-center gap-3 hover:bg-dark-200 transition-colors border-b border-gray-700 last:border-0"
                        >
                          <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center">
                            <span className="text-primary-400 text-sm font-medium">
                              {result.name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-left flex-1">
                            <p className="text-white font-medium">{result.name}</p>
                            <p className="text-sm text-gray-500">{result.email}</p>
                          </div>
                          <UserPlus className="w-5 h-5 text-gray-500" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Member selection */}
              <div className="space-y-2">
                {availableMembers.map(member => {
                  const isSelected = selectedMemberIds.includes(member.user_id)
                  const isCurrentUser = member.user_id === user?.id
                  
                  return (
                    <div
                      key={member.user_id}
                      className={`p-3 rounded-xl border transition-all ${
                        isSelected 
                          ? 'border-primary-500/50 bg-primary-500/5' 
                          : 'border-gray-700 bg-dark-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleMember(member.user_id)}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer
                            ${isSelected 
                              ? 'bg-primary-500 border-primary-500' 
                              : 'border-gray-600 hover:border-gray-500'
                            }
                          `}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </button>
                        
                        <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center">
                          <span className="text-primary-400 text-sm font-medium">
                            {member.user_name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">
                            {member.user_name}
                            {isCurrentUser && <span className="text-gray-500 ml-2">(you)</span>}
                          </p>
                          <p className="text-sm text-gray-500 truncate">{member.user_email}</p>
                        </div>
                        
                        {isSelected && (
                          <div className="text-right">
                            <p className="text-white font-medium">₹{perPersonAmount.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Summary */}
              <div className="p-4 bg-dark-200 rounded-xl">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Total Amount</span>
                  <span className="text-white font-medium">₹{parseFloat(editData.amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Split between</span>
                  <span className="text-white font-medium">{selectedMemberIds.length} people</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-700 pt-2 mt-2">
                  <span className="text-gray-400">Per person</span>
                  <span className="text-primary-400 font-medium">₹{perPersonAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {expense?.splits?.map(split => (
                <div key={split.user_id} className="flex items-center justify-between p-3 bg-dark-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center">
                      <span className="text-primary-400 text-sm font-medium">
                        {split.user_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {split.user_name}
                        {split.user_id === user?.id && <span className="text-gray-500 ml-2">(you)</span>}
                      </p>
                    </div>
                  </div>
                  <p className="text-white font-medium">₹{split.amount.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Actions */}
        {isEditing && (
          <div className="flex gap-4">
            <button
              onClick={() => {
                setIsEditing(false)
                // Reset edit data
                setEditData({
                  description: expense.description,
                  notes: expense.notes || '',
                  category: expense.category,
                  amount: expense.amount,
                  expense_date: new Date(expense.expense_date).toISOString().split('T')[0]
                })
                // Reset selected members
                setSelectedMemberIds(expense.splits?.map(s => s.user_id) || [])
                setError('')
              }}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selectedMemberIds.length === 0}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
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
              Are you sure you want to delete <strong>"{expense?.description}"</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? (
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

export default ExpenseDetailPage
