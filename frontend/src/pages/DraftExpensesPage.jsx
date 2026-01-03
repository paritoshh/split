/**
 * ===========================================
 * DRAFT EXPENSES PAGE
 * ===========================================
 * View and manage draft expenses created via voice commands.
 * - List all draft expenses
 * - Edit draft expenses
 * - Submit draft expenses (convert to real expenses)
 * ===========================================
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { expensesAPI } from '../services/api'
import Layout from '../components/Layout'
import {
  ArrowLeft,
  Receipt,
  Edit3,
  CheckCircle,
  Trash2,
  Calendar,
  Users,
  DollarSign,
  FileText,
  Loader2,
  AlertCircle
} from 'lucide-react'

function DraftExpensesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submittingId, setSubmittingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    fetchDrafts()
  }, [])

  const fetchDrafts = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await expensesAPI.getDrafts()
      console.log('📝 Drafts API response:', response)
      const draftsData = response.data || []
      console.log('📝 Drafts data:', draftsData.length, draftsData)
      setDrafts(draftsData)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load draft expenses')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitDraft = async (draftId) => {
    try {
      setSubmittingId(draftId)
      setError('')
      await expensesAPI.submitDraft(draftId)
      // Refresh the list
      await fetchDrafts()
      // Show success message (you can add a toast notification here)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to submit draft expense')
    } finally {
      setSubmittingId(null)
    }
  }

  const handleDeleteDraft = async (draftId) => {
    if (!window.confirm('Are you sure you want to delete this draft?')) {
      return
    }
    
    try {
      setDeletingId(draftId)
      setError('')
      await expensesAPI.delete(draftId)
      // Refresh the list
      await fetchDrafts()
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete draft expense')
    } finally {
      setDeletingId(null)
    }
  }

  const handleEditDraft = (draft) => {
    // Navigate to add expense page with draft data
    const params = new URLSearchParams({
      draft: draft.id,
      amount: draft.amount,
      description: draft.description,
      group_id: draft.group_id || '',
      expense_date: draft.expense_date ? draft.expense_date.split('T')[0] : new Date().toISOString().split('T')[0]
    })
    navigate(`/add-expense?${params.toString()}`)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatAmount = (amount) => {
    return `₹${parseFloat(amount).toFixed(2)}`
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg hover:bg-dark-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary-500" />
              Draft Expenses
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Review and submit your saved draft expenses
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Drafts list */}
        {(() => {
          console.log('📝 Rendering DraftExpensesPage - drafts:', drafts.length, drafts)
          return null
        })()}
        {drafts.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">No draft expenses</h3>
            <p className="text-sm text-gray-500 mb-6">
              Draft expenses created via voice commands will appear here
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="bg-dark-200 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left side - Expense details */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Receipt className="w-5 h-5 text-primary-500" />
                      <h3 className="text-lg font-semibold text-white">
                        {draft.description || 'Untitled Expense'}
                      </h3>
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-md">
                        Draft
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-white font-medium">
                          {formatAmount(draft.amount)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-300 text-sm">
                          {formatDate(draft.expense_date)}
                        </span>
                      </div>
                      
                      {draft.group_name && (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-300 text-sm">
                            {draft.group_name}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-300 text-sm">
                          {draft.splits?.length || 0} {draft.splits?.length === 1 ? 'person' : 'people'}
                        </span>
                      </div>
                    </div>

                    {draft.notes && (() => {
                      // Clean notes - remove __DRAFT_SPLIT_INFO__ part
                      const cleanNotes = draft.notes.replace(/__DRAFT_SPLIT_INFO__:.*/, '').trim()
                      return cleanNotes ? (
                        <p className="text-sm text-gray-400 mb-2">
                          {cleanNotes}
                        </p>
                      ) : null
                    })()}

                    {/* Split details */}
                    {draft.splits && draft.splits.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-xs text-gray-500 mb-2">Split with:</p>
                        <div className="flex flex-wrap gap-2">
                          {draft.splits.map((split) => (
                            <span
                              key={split.user_id}
                              className="px-2 py-1 bg-dark-300 rounded text-xs text-gray-300"
                            >
                              {split.user_name}: {formatAmount(split.amount)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right side - Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleSubmitDraft(draft.id)}
                      disabled={submittingId === draft.id || deletingId === draft.id}
                      className="btn-primary flex items-center justify-center gap-2 min-w-[120px]"
                    >
                      {submittingId === draft.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Submit
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleEditDraft(draft)}
                      disabled={submittingId === draft.id || deletingId === draft.id}
                      className="btn-secondary flex items-center justify-center gap-2 min-w-[120px]"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                    
                    <button
                      onClick={() => handleDeleteDraft(draft.id)}
                      disabled={submittingId === draft.id || deletingId === draft.id}
                      className="btn-secondary flex items-center justify-center gap-2 min-w-[120px] text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
                    >
                      {deletingId === draft.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
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
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default DraftExpensesPage

