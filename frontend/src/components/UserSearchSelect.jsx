/**
 * ===========================================
 * USER SEARCH SELECT COMPONENT
 * ===========================================
 * Reusable component for searching and selecting users.
 * Used in:
 * - CreateGroupModal (GroupsPage)
 * - AddMemberModal (GroupDetailPage)
 * - AddExpensePage
 * ===========================================
 */

import { useState, useEffect } from 'react'
import { authAPI } from '../services/api'
import { Search, UserPlus, X } from 'lucide-react'

function UserSearchSelect({ 
  selectedUsers = [], 
  onSelectionChange,
  excludeUserIds = [],
  placeholder = "Search by name or email (min 4 chars)...",
  multiple = true,
  label = "Add People"
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [allSearchResults, setAllSearchResults] = useState([]) // Store unfiltered results
  const [searchLoading, setSearchLoading] = useState(false)

  // Search users with debounce (only when searchQuery changes)
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 4) {
        setSearchResults([])
        setAllSearchResults([])
        return
      }
      
      setSearchLoading(true)
      try {
        const response = await authAPI.searchUsers(searchQuery)
        // Store all results (we'll filter in a separate effect)
        setAllSearchResults(response.data)
      } catch (err) {
        console.error('Search failed:', err)
        setAllSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }

    const debounceTimer = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounceTimer)
    // Only depend on searchQuery - don't trigger on selectedUsers changes
  }, [searchQuery])

  // Filter results when selectedUsers or excludeUserIds change (without new API call)
  useEffect(() => {
    if (allSearchResults.length === 0) {
      setSearchResults([])
      return
    }
    
    // Filter out excluded users and already selected users
    const selectedIds = selectedUsers.map(u => u.id)
    const allExcluded = [...excludeUserIds, ...selectedIds]
    setSearchResults(allSearchResults.filter(u => !allExcluded.includes(u.id)))
  }, [allSearchResults, selectedUsers, excludeUserIds])

  const handleSelectUser = (user) => {
    if (multiple) {
      onSelectionChange([...selectedUsers, user])
    } else {
      onSelectionChange([user])
    }
    setSearchQuery('')
    setSearchResults([])
  }

  const handleRemoveUser = (userId) => {
    onSelectionChange(selectedUsers.filter(u => u.id !== userId))
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-12"
          placeholder={placeholder}
        />
        {searchLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-gray-600 border-t-primary-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Search hint */}
      {searchQuery.length > 0 && searchQuery.length < 4 && (
        <p className="text-sm text-gray-500 mt-2">Type at least 4 characters to search</p>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mt-2 bg-dark-200 border border-gray-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
          {searchResults.map(result => (
            <button
              key={result.id}
              type="button"
              onClick={() => handleSelectUser(result)}
              className="w-full p-3 flex items-center gap-3 hover:bg-dark-100 transition-colors border-b border-gray-700 last:border-0"
            >
              <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center">
                <span className="text-primary-400 text-sm font-medium">
                  {result.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-left flex-1">
                <p className="text-white font-medium text-sm">{result.name}</p>
                <p className="text-xs text-gray-500">{result.email}</p>
              </div>
              <UserPlus className="w-4 h-4 text-gray-500" />
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {searchQuery.length >= 4 && !searchLoading && searchResults.length === 0 && (
        <p className="text-sm text-gray-500 mt-2">No users found</p>
      )}

      {/* Selected Users */}
      {selectedUsers.length > 0 && (
        <div className="mt-3 space-y-2">
          {multiple && (
            <p className="text-xs text-gray-400">Selected ({selectedUsers.length})</p>
          )}
          <div className="space-y-2">
            {selectedUsers.map(user => (
              <div
                key={user.id}
                className="flex items-center justify-between p-2 bg-dark-200 rounded-xl border border-primary-500/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center">
                    <span className="text-primary-400 text-sm font-medium">
                      {user.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-white text-sm">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveUser(user.id)}
                  className="p-1 text-gray-500 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default UserSearchSelect

