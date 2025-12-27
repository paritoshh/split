/**
 * ===========================================
 * GROUPS PAGE
 * ===========================================
 * List all groups and create new ones.
 * Now supports adding members when creating a group.
 * ===========================================
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { groupsAPI } from '../services/api'
import Layout from '../components/Layout'
import UserSearchSelect from '../components/UserSearchSelect'
import {
  Plus,
  Users,
  Search,
  X,
  ArrowRight,
  Briefcase,
  Home,
  Heart,
  Plane,
  Dumbbell,
  PartyPopper
} from 'lucide-react'

// Category icons
const categoryIcons = {
  trip: Plane,
  home: Home,
  couple: Heart,
  sports: Dumbbell,
  party: PartyPopper,
  work: Briefcase,
  other: Users
}

const categoryColors = {
  trip: 'bg-blue-500/20 text-blue-400',
  home: 'bg-yellow-500/20 text-yellow-400',
  couple: 'bg-pink-500/20 text-pink-400',
  sports: 'bg-green-500/20 text-green-400',
  party: 'bg-purple-500/20 text-purple-400',
  work: 'bg-orange-500/20 text-orange-400',
  other: 'bg-gray-500/20 text-gray-400'
}

function GroupsPage() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = async () => {
    setLoading(true)
    try {
      const response = await groupsAPI.getAll()
      setGroups(response.data)
    } catch (err) {
      setError('Failed to load groups')
    } finally {
      setLoading(false)
    }
  }

  // Filter groups by search
  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-1">
            Groups
          </h1>
          <p className="text-gray-400">Manage your expense groups</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Group
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search groups..."
          className="input-field pl-12"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Groups Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="h-12 w-12 bg-dark-200 rounded-xl mb-4" />
              <div className="h-5 bg-dark-200 rounded w-2/3 mb-2" />
              <div className="h-4 bg-dark-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            {searchQuery ? 'No groups found' : 'No groups yet'}
          </h3>
          <p className="text-gray-400 mb-6">
            {searchQuery
              ? 'Try a different search term'
              : 'Create your first group to start splitting expenses'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Group
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map(group => {
            const IconComponent = categoryIcons[group.category] || Users
            const colorClass = categoryColors[group.category] || categoryColors.other

            return (
              <Link
                key={group.id}
                to={`/groups/${group.id}`}
                className="card group hover:border-primary-500/50"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorClass}`}>
                  <IconComponent className="w-6 h-6" />
                </div>

                <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-primary-400 transition-colors">
                  {group.name}
                </h3>

                {group.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {group.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-800">
                  <span className="text-sm text-gray-400">
                    {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                  </span>
                  <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-primary-400 transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            fetchGroups()
          }}
        />
      )}
    </Layout>
  )
}

// Create Group Modal Component - Uses shared UserSearchSelect component
function CreateGroupModal({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'other'
  })
  const [selectedMembers, setSelectedMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await groupsAPI.create({
        ...formData,
        member_user_ids: selectedMembers.map(m => m.id)
      })
      onCreated()
    } catch (err) {
      setError(err.message || 'Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  const categories = [
    { value: 'trip', label: 'Trip', icon: Plane },
    { value: 'home', label: 'Home', icon: Home },
    { value: 'couple', label: 'Couple', icon: Heart },
    { value: 'sports', label: 'Sports', icon: Dumbbell },
    { value: 'party', label: 'Party', icon: PartyPopper },
    { value: 'work', label: 'Work', icon: Briefcase },
    { value: 'other', label: 'Other', icon: Users }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-dark-100 rounded-2xl p-6 w-full max-w-lg border border-gray-800 animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-display font-bold text-white mb-6">
          Create Group
        </h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              placeholder="e.g., Badminton Squad"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field resize-none"
              placeholder="What's this group for?"
              rows={2}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category
            </label>
            <div className="grid grid-cols-4 gap-2">
              {categories.map(cat => {
                const Icon = cat.icon
                const isSelected = formData.category === cat.value
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.value })}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1
                      ${isSelected
                        ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                        : 'bg-dark-200 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{cat.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Add Members - Using shared component */}
          <UserSearchSelect
            selectedUsers={selectedMembers}
            onSelectionChange={setSelectedMembers}
            label="Add Members (optional)"
            placeholder="Search by name or email..."
            multiple={true}
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !formData.name}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Create Group
                {selectedMembers.length > 0 && ` with ${selectedMembers.length} member${selectedMembers.length !== 1 ? 's' : ''}`}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default GroupsPage
