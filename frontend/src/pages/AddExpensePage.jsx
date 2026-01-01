/**
 * ===========================================
 * ADD EXPENSE PAGE
 * ===========================================
 * Form to create a new expense with splitting options.
 * - Select/deselect members for splitting
 * - Equal and Exact split types
 * - Works with and without groups
 * ===========================================
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../App'
import { expensesAPI, groupsAPI, authAPI } from '../services/api'
import Layout from '../components/Layout'
import {
  ArrowLeft,
  Receipt,
  Users,
  Hash,
  Calendar,
  FileText,
  CheckCircle,
  ArrowRight,
  X,
  Search,
  UserPlus,
  Check
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

function AddExpensePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preSelectedGroup = searchParams.get('group')

  const [groups, setGroups] = useState([])
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    notes: '',
    category: 'other',
    group_id: preSelectedGroup || '',
    split_type: 'equal',
    expense_date: new Date().toISOString().split('T')[0]
  })
  
  // All available members (from group or searched)
  const [availableMembers, setAvailableMembers] = useState([])
  // Selected member IDs for splitting
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  // For exact split - amounts per user
  const [exactAmounts, setExactAmounts] = useState({})
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1) // 1: Details, 2: Split
  
  // User search state (for non-group expenses)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Initialize with current user
  useEffect(() => {
    if (user) {
      const currentUserMember = {
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        isCurrentUser: true
      }
      setAvailableMembers([currentUserMember])
      setSelectedMemberIds([user.id])
    }
  }, [user])

  // Fetch groups on mount
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await groupsAPI.getAll()
        setGroups(response.data)
      } catch (err) {
        console.error('Failed to fetch groups')
      }
    }
    fetchGroups()
  }, [])

  // Fetch group members when group changes
  useEffect(() => {
    const fetchGroupMembers = async () => {
      if (formData.group_id) {
        try {
          const response = await groupsAPI.getOne(formData.group_id)
          const members = (response.data.members || []).map(m => ({
            user_id: m.user_id,
            user_name: m.user_name,
            user_email: m.user_email,
            isCurrentUser: m.user_id === user?.id
          }))
          setAvailableMembers(members)
          // Select all members by default
          setSelectedMemberIds(members.map(m => m.user_id))
        } catch (err) {
          console.error('Failed to fetch group members')
        }
      } else {
        // Reset to just current user
        if (user) {
          setAvailableMembers([{
            user_id: user.id,
            user_name: user.name,
            user_email: user.email,
            isCurrentUser: true
          }])
          setSelectedMemberIds([user.id])
        }
      }
      setExactAmounts({})
    }
    fetchGroupMembers()
  }, [formData.group_id, user])

  // Search users with debounce (for non-group expenses)
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 4 || formData.group_id) {
        setSearchResults([])
        return
      }
      
      setSearchLoading(true)
      try {
        const response = await authAPI.searchUsers(searchQuery)
        // Filter out already added users
        const existingIds = availableMembers.map(m => m.user_id)
        setSearchResults(response.data.filter(u => !existingIds.includes(u.id)))
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        setSearchLoading(false)
      }
    }

    const debounceTimer = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery, availableMembers, formData.group_id])

  // Toggle member selection
  const toggleMember = (userId) => {
    if (selectedMemberIds.includes(userId)) {
      // Don't allow deselecting if only 1 person left (need at least 2 for split)
      if (selectedMemberIds.length <= 1) return
      
      setSelectedMemberIds(selectedMemberIds.filter(id => id !== userId))
      // Remove from exact amounts
      const newAmounts = { ...exactAmounts }
      delete newAmounts[userId]
      setExactAmounts(newAmounts)
    } else {
      setSelectedMemberIds([...selectedMemberIds, userId])
    }
  }

  // Select/Deselect all members
  const selectAllMembers = () => {
    setSelectedMemberIds(availableMembers.map(m => m.user_id))
  }

  const deselectAllMembers = () => {
    // Keep at least one member selected (first in list)
    const firstMember = availableMembers[0]
    if (firstMember) {
      setSelectedMemberIds([firstMember.user_id])
    }
    setExactAmounts({})
  }

  // Add user from search to available members
  const addSearchedUser = (userToAdd) => {
    const newMember = {
      user_id: userToAdd.id,
      user_name: userToAdd.name,
      user_email: userToAdd.email,
      isCurrentUser: false
    }
    setAvailableMembers([...availableMembers, newMember])
    setSelectedMemberIds([...selectedMemberIds, userToAdd.id])
    setSearchQuery('')
    setSearchResults([])
  }

  // Remove user from available members (only for non-group)
  const removeUser = (userId) => {
    if (userId === user?.id || formData.group_id) return
    setAvailableMembers(availableMembers.filter(m => m.user_id !== userId))
    setSelectedMemberIds(selectedMemberIds.filter(id => id !== userId))
    const newAmounts = { ...exactAmounts }
    delete newAmounts[userId]
    setExactAmounts(newAmounts)
  }

  // Handle exact amount change
  const handleExactAmountChange = (userId, amount) => {
    setExactAmounts({
      ...exactAmounts,
      [userId]: amount
    })
  }

  // Get selected participants
  const selectedParticipants = availableMembers.filter(m => selectedMemberIds.includes(m.user_id))

  // Calculate split preview
  const calculateSplitPreview = () => {
    const amount = parseFloat(formData.amount) || 0
    const participantCount = selectedParticipants.length
    
    if (formData.split_type === 'equal') {
      return participantCount > 0 ? (amount / participantCount).toFixed(2) : '0.00'
    }
    return null
  }

  // Validate exact split totals
  const validateExactSplit = () => {
    if (formData.split_type !== 'exact') return true
    
    const total = selectedMemberIds.reduce((sum, id) => sum + (parseFloat(exactAmounts[id]) || 0), 0)
    const expenseAmount = parseFloat(formData.amount) || 0
    
    return Math.abs(total - expenseAmount) < 0.01
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateExactSplit()) {
      setError('Exact split amounts must equal the total expense amount')
      return
    }
    
    setLoading(true)
    setError('')

    try {
      // Prepare expense data
      const expenseData = {
        amount: parseFloat(formData.amount),
        description: formData.description,
        category: formData.category,
        split_type: formData.split_type,
        expense_date: new Date(formData.expense_date).toISOString(),
      }
      
      // Only include optional fields if they have values
      // Convert group_id to string and only include if not empty
      // Handle both empty string and null cases - be very explicit
      const groupIdRaw = formData.group_id
      console.log('🔍 Group ID Debug:', {
        raw: groupIdRaw,
        type: typeof groupIdRaw,
        isNull: groupIdRaw === null,
        isUndefined: groupIdRaw === undefined,
        isEmpty: groupIdRaw === '',
        truthy: !!groupIdRaw
      })
      
      if (groupIdRaw !== null && groupIdRaw !== undefined && groupIdRaw !== '') {
        const groupIdValue = String(groupIdRaw).trim()
        console.log('✅ Group ID value after conversion:', groupIdValue)
        if (groupIdValue !== '' && groupIdValue !== 'null' && groupIdValue !== 'undefined') {
          expenseData.group_id = groupIdValue
          console.log('✅ Added group_id to expenseData:', expenseData.group_id)
        } else {
          console.log('❌ Group ID value is invalid after conversion')
        }
      } else {
        console.log('❌ Group ID is null/undefined/empty, not adding to expenseData')
      }
      // If group_id is empty/null/undefined, we don't include it in expenseData at all
      // This prevents sending null or empty string to the backend
      
      // Only include notes if it has a non-empty value
      if (formData.notes && formData.notes !== '' && formData.notes !== null) {
        const notesValue = formData.notes.trim()
        if (notesValue !== '') {
          expenseData.notes = notesValue
        }
      }

      if (formData.split_type === 'equal') {
        // For equal split, just pass user IDs (excluding current user)
        expenseData.split_with_user_ids = selectedMemberIds.filter(id => id !== user?.id)
      } else if (formData.split_type === 'exact') {
        // For exact split, pass detailed splits
        expenseData.splits = selectedMemberIds.map(userId => ({
          user_id: userId,
          amount: parseFloat(exactAmounts[userId]) || 0
        }))
      }

      // Debug: Log the expense data before sending
      console.log('Expense data being sent:', JSON.stringify(expenseData, null, 2))
      console.log('formData.group_id value:', formData.group_id, 'type:', typeof formData.group_id)
      console.log('formData.notes value:', formData.notes, 'type:', typeof formData.notes)
      
      // Final check: Remove any null/undefined/empty values to prevent sending them
      // Specifically check group_id and notes
      if ('group_id' in expenseData && (expenseData.group_id === null || expenseData.group_id === undefined || expenseData.group_id === '')) {
        delete expenseData.group_id
      }
      if ('notes' in expenseData && (expenseData.notes === null || expenseData.notes === undefined || expenseData.notes === '')) {
        delete expenseData.notes
      }
      
      // Also do a general cleanup for any other fields
      Object.keys(expenseData).forEach(key => {
        if (expenseData[key] === null || expenseData[key] === undefined || expenseData[key] === '') {
          delete expenseData[key]
        }
      })
      
      console.log('Expense data after cleanup:', JSON.stringify(expenseData, null, 2))
      console.log('Has group_id?', 'group_id' in expenseData, expenseData.group_id)

      await expensesAPI.create(expenseData)

      // Navigate back
      if (formData.group_id) {
        navigate(`/groups/${formData.group_id}`)
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.message || 'Failed to create expense')
    } finally {
      setLoading(false)
    }
  }

  const splitAmount = calculateSplitPreview()
  const exactTotal = selectedMemberIds.reduce((sum, id) => sum + (parseFloat(exactAmounts[id]) || 0), 0)

  return (
    <Layout>
      {/* Header - compact on mobile */}
      <div className="flex items-center gap-2 mb-4 lg:mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg bg-dark-100 hover:bg-dark-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <div>
          <h1 className="text-lg sm:text-xl lg:text-3xl font-display font-bold text-white">
            Add Expense
          </h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl">
        {/* Step 1: Basic Details */}
        {step === 1 && (
          <div className="space-y-3 lg:space-y-6 animate-fade-in">
            {/* Amount */}
            <div>
              <label className="input-label">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg sm:text-2xl text-gray-400">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input-field pl-8 sm:pl-12 text-xl sm:text-2xl font-bold h-12 sm:h-14"
                  placeholder="0.00"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="input-label">Description <span className="text-red-400">*</span></label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field pl-9"
                  placeholder="What was this for?"
                  required
                  minLength={1}
                  maxLength={255}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Required field</p>
            </div>

            {/* Group */}
            <div>
              <label className="input-label">Group <span className="text-gray-500">(optional)</span></label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <select
                  value={formData.group_id}
                  onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                  className="input-field pl-9 appearance-none"
                >
                  <option value="">No group</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category - compact grid */}
            <div>
              <label className="input-label">Category</label>
              <div className="grid grid-cols-4 gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.value })}
                    className={`p-1.5 sm:p-2 rounded-lg border transition-all flex flex-col items-center
                      ${formData.category === cat.value
                        ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                        : 'bg-dark-100 border-gray-700 text-gray-400'
                      }`}
                  >
                    <span className="text-base sm:text-lg">{cat.emoji}</span>
                    <span className="text-[8px] sm:text-[10px] truncate w-full text-center">{cat.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="input-label">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  className="input-field pl-9"
                />
              </div>
            </div>

            {/* Notes - hidden on mobile by default */}
            <div className="hidden sm:block">
              <label className="input-label">Notes <span className="text-gray-500">(optional)</span></label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-field resize-none"
                rows={2}
                placeholder="Any additional details..."
              />
            </div>

            {/* Next Button */}
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!formData.amount || !formData.description}
              className="w-full btn-primary flex items-center justify-center gap-1"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Split Options */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            {/* Summary */}
            <div className="card bg-gradient-to-br from-primary-500/10 to-secondary-500/10 border-primary-500/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-primary-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">₹{parseFloat(formData.amount || 0).toLocaleString('en-IN')}</p>
                  <p className="text-gray-400">{formData.description}</p>
                </div>
              </div>
            </div>

            {/* Split Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Split Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'equal', label: 'Equal', icon: Users, desc: 'Split equally' },
                  { value: 'exact', label: 'Exact', icon: Hash, desc: 'Enter amounts' }
                ].map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, split_type: type.value })}
                    className={`p-4 rounded-xl border transition-all text-left
                      ${formData.split_type === type.value
                        ? 'bg-primary-500/20 border-primary-500'
                        : 'bg-dark-100 border-gray-700 hover:border-gray-600'
                      }`}
                  >
                    <type.icon className={`w-5 h-5 mb-2 ${formData.split_type === type.value ? 'text-primary-400' : 'text-gray-400'}`} />
                    <p className={`font-medium ${formData.split_type === type.value ? 'text-white' : 'text-gray-300'}`}>
                      {type.label}
                    </p>
                    <p className="text-sm text-gray-500">{type.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* User Search (only when no group selected) */}
            {!formData.group_id && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Add People <span className="text-gray-500">(type at least 4 characters)</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field pl-12"
                    placeholder="Search by name or email..."
                  />
                  {searchLoading && (
                    <div className="absolute right-4 top-3.5">
                      <div className="w-5 h-5 border-2 border-gray-600 border-t-primary-500 rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                
                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-2 bg-dark-100 border border-gray-700 rounded-xl overflow-hidden">
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
                
                {searchQuery.length > 0 && searchQuery.length < 4 && (
                  <p className="text-sm text-gray-500 mt-2">Type at least 4 characters to search</p>
                )}
              </div>
            )}

            {/* Members Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">
                  Split with ({selectedParticipants.length} of {availableMembers.length} selected)
                </label>
                {availableMembers.length > 1 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllMembers}
                      className="text-xs text-primary-400 hover:text-primary-300"
                    >
                      Select All
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      type="button"
                      onClick={deselectAllMembers}
                      className="text-xs text-gray-400 hover:text-gray-300"
                    >
                      Deselect All
                    </button>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                {availableMembers.map(member => {
                  const isSelected = selectedMemberIds.includes(member.user_id)
                  const isCurrentUser = member.isCurrentUser
                  
                  return (
                    <div
                      key={member.user_id}
                      className={`p-3 rounded-xl border transition-all flex items-center gap-3
                        ${isSelected 
                          ? 'bg-primary-500/10 border-primary-500/50' 
                          : 'bg-dark-100 border-gray-700 opacity-60'
                        }`}
                    >
                      {/* Checkbox */}
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
                      
                      <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                        <span className="text-primary-400 font-medium">
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
                      
                      {/* Amount input for exact split (only if selected) */}
                      {isSelected && formData.split_type === 'exact' && (
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={exactAmounts[member.user_id] || ''}
                            onChange={(e) => handleExactAmountChange(member.user_id, e.target.value)}
                            className="w-full bg-dark-200 border border-gray-600 rounded-lg py-2 pl-6 pr-2 text-white text-right focus:outline-none focus:border-primary-500"
                            placeholder="0.00"
                          />
                        </div>
                      )}
                      
                      {/* Equal split preview (only if selected) */}
                      {isSelected && formData.split_type === 'equal' && (
                        <span className="text-gray-400 text-sm">₹{splitAmount}</span>
                      )}
                      
                      {/* Remove button (only for non-group, non-current-user) */}
                      {!formData.group_id && !isCurrentUser && (
                        <button
                          type="button"
                          onClick={() => removeUser(member.user_id)}
                          className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Split Summary */}
            <div className="card">
              {formData.split_type === 'equal' ? (
                <>
                  <p className="text-gray-400 text-sm mb-2">Equal Split Preview</p>
                  <p className="text-2xl font-bold text-white">
                    ₹{splitAmount} <span className="text-gray-500 text-base font-normal">per person</span>
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-sm">Exact Split Total</p>
                    <p className={`text-sm ${Math.abs(exactTotal - parseFloat(formData.amount || 0)) < 0.01 ? 'text-green-400' : 'text-red-400'}`}>
                      {Math.abs(exactTotal - parseFloat(formData.amount || 0)) < 0.01 ? '✓ Balanced' : `₹${(parseFloat(formData.amount || 0) - exactTotal).toFixed(2)} remaining`}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    ₹{exactTotal.toFixed(2)} <span className="text-gray-500 text-base font-normal">of ₹{parseFloat(formData.amount || 0).toFixed(2)}</span>
                  </p>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 btn-secondary"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || selectedParticipants.length < 2 || (formData.split_type === 'exact' && !validateExactSplit())}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Add Expense
                    <CheckCircle className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </Layout>
  )
}

export default AddExpensePage
