/**
 * ===========================================
 * VOICE EXPENSE MODAL
 * ===========================================
 * Create expenses using voice input.
 * - Records voice and converts to text (Web Speech API)
 * - Parses text using AI (OpenAI GPT-4o-mini)
 * - Falls back to regex parsing if AI unavailable
 * - Shows draft for review before submitting
 * - Handles duplicate names with selection UI
 * ===========================================
 */

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../App'
import { expensesAPI, aiAPI } from '../services/api'
import { 
  parseVoiceExpense, 
  isSpeechRecognitionSupported,
  createSpeechRecognition 
} from '../services/voiceParser'
import {
  X,
  Mic,
  MicOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  Edit3,
  Users,
  Receipt,
  Calendar,
  RefreshCw,
  ChevronDown,
  Check,
  Sparkles,
  Zap
} from 'lucide-react'

function VoiceExpenseModal({ 
  isOpen, 
  onClose, 
  groupId, 
  groupMembers,  // Array of { user_id, user_name, user_email }
  onExpenseCreated 
}) {
  const { user } = useAuth()
  
  // Voice recording state
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  
  // Parsed expense state
  const [parsedExpense, setParsedExpense] = useState(null)
  const [step, setStep] = useState('record') // record, parsing, review, submit
  const [parsingMode, setParsingMode] = useState(null) // 'ai' or 'local'
  
  // Editable draft fields
  const [draftAmount, setDraftAmount] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftDate, setDraftDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedMembers, setSelectedMembers] = useState([])
  const [ambiguousSelections, setAmbiguousSelections] = useState({})
  
  // Loading/error state
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  // AI status
  const [aiEnabled, setAiEnabled] = useState(false)
  
  // Speech recognition ref
  const recognitionRef = useRef(null)

  // Check if speech recognition is supported
  const isSupported = isSpeechRecognitionSupported()

  // Check AI status on mount
  useEffect(() => {
    aiAPI.getStatus()
      .then(res => {
        console.log('🤖 AI Status Response:', res.data)
        const enabled = res.data?.ai_enabled || false
        console.log('🤖 AI Enabled:', enabled)
        setAiEnabled(enabled)
      })
      .catch((err) => {
        console.error('❌ Failed to check AI status:', err)
        setAiEnabled(false)
      })
  }, [])

  useEffect(() => {
    if (isOpen) {
      resetState()
    }
    return () => {
      stopListening()
    }
  }, [isOpen])

  // Auto-analyze when user stops speaking
  const prevIsListeningRef = useRef(false)
  useEffect(() => {
    // Detect transition from listening (true) to not listening (false)
    if (prevIsListeningRef.current && !isListening && step === 'record') {
      // Small delay to ensure transcript state is updated
      const timer = setTimeout(() => {
        if (transcript.trim()) {
          handleParseVoice()
        }
      }, 4000)  // 4 second delay to allow natural pauses in speech
      return () => clearTimeout(timer)
    }
    prevIsListeningRef.current = isListening
  }, [isListening, step, transcript])

  const resetState = () => {
    setTranscript('')
    setInterimTranscript('')
    setParsedExpense(null)
    setStep('record')
    setParsingMode(null)
    setDraftAmount('')
    setDraftDescription('')
    setDraftDate(new Date().toISOString().split('T')[0])
    setSelectedMembers([])
    setAmbiguousSelections({})
    setError('')
    setSuccess(false)
    setIsListening(false)
    setParsing(false)
  }

  const startListening = () => {
    if (!isSupported) {
      setError('Voice recognition is not supported in your browser. Try Chrome or Safari.')
      return
    }

    const recognition = createSpeechRecognition()
    if (!recognition) {
      setError('Failed to initialize voice recognition')
      return
    }

    recognitionRef.current = recognition

    recognition.onstart = () => {
      setIsListening(true)
      setError('')
    }

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcriptText
        } else {
          interim += transcriptText
        }
      }

      if (final) {
        setTranscript(prev => prev + ' ' + final)
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.')
      } else if (event.error === 'no-speech') {
        setError('No speech detected. Please try again.')
      } else {
        setError(`Voice recognition error: ${event.error}`)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    try {
      recognition.start()
    } catch (err) {
      setError('Failed to start voice recognition')
      setIsListening(false)
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }

  const handleParseVoice = async () => {
    const fullTranscript = (transcript + ' ' + interimTranscript).trim()
    if (!fullTranscript) {
      setError('No voice input detected. Please try again.')
      return
    }

    setStep('parsing')
    setParsing(true)
    setError('')

    let parsed = null

    // Try AI parsing first if enabled
    if (aiEnabled) {
      try {
        console.log('🤖 Attempting AI parsing...')
        const response = await aiAPI.parseVoiceExpense(fullTranscript, groupMembers)
        const aiResult = response.data

        if (aiResult.success) {
          console.log('✅ AI parsing successful')
          setParsingMode('ai')
          parsed = {
            amount: aiResult.amount,
            description: aiResult.description,
            expenseDate: aiResult.expense_date,  // YYYY-MM-DD or null
            matchedMembers: aiResult.matched_members.map(m => ({
              user_id: m.user_id,
              user_name: m.user_name,
              confidence: m.confidence
            })),
            ambiguousNames: aiResult.ambiguous_names.map(a => ({
              searchedName: a.searched_name,
              possibleMatches: a.possible_matches.map(p => ({
                user_id: p.user_id,
                user_name: p.user_name,
                confidence: p.confidence
              }))
            })),
            unmatchedNames: aiResult.unmatched_names,
            confidence: aiResult.confidence,
            rawTranscript: fullTranscript
          }
        } else {
          console.warn('⚠️ AI parsing returned success=false:', aiResult.error)
        }
      } catch (err) {
        console.error('❌ AI parsing failed, falling back to local:', err)
        console.error('Error details:', err.response?.data || err.message)
        // Show user-friendly error if AI fails
        if (err.response?.status === 503) {
          setError('AI features are not configured. Using local parsing instead.')
        }
      }
    } else {
      console.log('ℹ️ AI not enabled, using local parsing')
    }

    // Fallback to local parsing
    if (!parsed) {
      setParsingMode('local')
      parsed = parseVoiceExpense(fullTranscript, groupMembers)
    }

    setParsedExpense(parsed)

    // Set draft values
    setDraftAmount(parsed.amount?.toString() || '')
    setDraftDescription(parsed.description || 'General Expense')
    // Use parsed date if available, otherwise use today
    if (parsed.expenseDate) {
      setDraftDate(parsed.expenseDate)
    }
    
    // Set selected members - include matched members AND all ambiguous matches by default
    // User can remove the ones they don't want during review
    const memberIds = parsed.matchedMembers.map(m => m.user_id)
    
    // Also add all ambiguous matches by default (user will remove unwanted ones)
    parsed.ambiguousNames.forEach(amb => {
      amb.possibleMatches.forEach(match => {
        if (!memberIds.includes(match.user_id)) {
          memberIds.push(match.user_id)
        }
      })
    })
    setSelectedMembers(memberIds)

    // No longer need ambiguousSelections - we add all and user removes unwanted
    setAmbiguousSelections({})

    setParsing(false)
    setStep('review')
  }

  const handleAmbiguousSelect = (index, userId) => {
    setAmbiguousSelections(prev => ({
      ...prev,
      [index]: userId
    }))
    
    // Add to selected members if not already there
    if (!selectedMembers.includes(userId)) {
      setSelectedMembers(prev => [...prev, userId])
    }
  }

  const toggleMember = (userId) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSubmit = async () => {
    // Validate
    if (!draftAmount || parseFloat(draftAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }
    if (selectedMembers.length === 0) {
      setError('Please select at least one member to split with')
      return
    }
    if (!draftDescription.trim()) {
      setError('Please enter a description')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Build expense data
      // For equal splits, use split_with_user_ids (backend auto-includes payer)
      const expenseData = {
        amount: parseFloat(draftAmount),
        description: draftDescription.trim(),
        group_id: groupId ? String(groupId) : undefined, // UUID is a string, not a number
        category: 'other',
        expense_date: new Date(draftDate).toISOString(),
        split_type: 'equal',
        split_with_user_ids: selectedMembers,
        is_draft: false
      }
      
      // Remove group_id if it's empty/null/undefined
      if (!expenseData.group_id) {
        delete expenseData.group_id
      }

      await expensesAPI.create(expenseData)
      setSuccess(true)
      
      setTimeout(() => {
        onExpenseCreated?.()
        onClose()
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to create expense')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDraft = async () => {
    // Validate minimum fields
    if (!draftAmount || parseFloat(draftAmount) <= 0) {
      setError('Please enter a valid amount to save as draft')
      return
    }
    if (!draftDescription.trim()) {
      setError('Please enter a description to save as draft')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Build expense data as draft
      const expenseData = {
        amount: parseFloat(draftAmount),
        description: draftDescription.trim(),
        group_id: groupId ? String(groupId) : undefined,
        category: 'other',
        expense_date: new Date(draftDate).toISOString(),
        split_type: 'equal',
        split_with_user_ids: selectedMembers,
        is_draft: true  // Mark as draft
      }
      
      // Remove group_id if it's empty/null/undefined
      if (!expenseData.group_id) {
        delete expenseData.group_id
      }

      console.log('Saving draft expense:', expenseData)
      const response = await expensesAPI.create(expenseData)
      console.log('Draft expense saved:', response.data)
      
      setSuccess(true)
      
      setTimeout(() => {
        onExpenseCreated?.()
        onClose()
      }, 1500)
    } catch (err) {
      console.error('Error saving draft expense:', err)
      setError(err.response?.data?.detail || err.message || 'Failed to save draft expense')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-dark-100 rounded-2xl w-full max-w-lg border border-gray-800 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-dark-100 p-4 border-b border-gray-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center">
              <Mic className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                Voice Expense
                {aiEnabled && (
                  <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500">
                {step === 'record' ? 'Speak to create expense' : 
                 step === 'parsing' ? 'Analyzing your speech...' : 'Review and submit'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-dark-200 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-green-400 text-sm">Expense created successfully!</p>
            </div>
          )}

          {/* Recording Step */}
          {step === 'record' && (
            <div className="space-y-4">
              {/* AI Status Badge */}
              {aiEnabled ? (
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-sm text-purple-300 font-medium">AI-Powered Parsing</p>
                    <p className="text-xs text-gray-400">GPT-4o-mini will understand your speech naturally</p>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  <div>
                    <p className="text-sm text-yellow-300 font-medium">AI Not Available</p>
                    <p className="text-xs text-gray-400">Using local regex parsing. Set OPENAI_API_KEY to enable AI.</p>
                  </div>
                </div>
              )}

              {/* Voice button */}
              <div className="flex flex-col items-center py-6">
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={!isSupported}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                    isListening 
                      ? 'bg-red-500 animate-pulse scale-110' 
                      : 'bg-primary-500 hover:bg-primary-600 hover:scale-105'
                  } ${!isSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isListening ? (
                    <MicOff className="w-10 h-10 text-white" />
                  ) : (
                    <Mic className="w-10 h-10 text-white" />
                  )}
                </button>
                <p className="mt-4 text-sm text-gray-400">
                  {isListening ? 'Listening... Tap to stop' : 'Tap to start speaking'}
                </p>
              </div>

              {/* Transcript display */}
              <div className="bg-dark-200 rounded-xl p-4 min-h-[100px]">
                <p className="text-xs text-gray-500 mb-2">What you said:</p>
                <p className="text-white">
                  {transcript}
                  <span className="text-gray-500 italic">{interimTranscript}</span>
                  {!transcript && !interimTranscript && (
                    <span className="text-gray-600">Your speech will appear here...</span>
                  )}
                </p>
              </div>

              {/* Example prompts */}
              <div className="bg-dark-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-2">Try saying:</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• "Create expense with Paritosh and Akshay of 500 for Cricket"</li>
                  <li>• "Add 300 rupees for dinner with everyone"</li>
                  <li>• "Paritosh aur Suman ke saath 1000 ka party expense"</li>
                </ul>
              </div>

              {/* Parse button */}
              <button
                onClick={handleParseVoice}
                disabled={(!transcript && !interimTranscript) || parsing}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {aiEnabled ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Analyze with AI
                  </>
                ) : (
                  <>
                    Review Expense
                    <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Parsing Step */}
          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <Loader2 className="w-16 h-16 text-primary-500 animate-spin" />
                {aiEnabled && (
                  <Sparkles className="w-6 h-6 text-purple-400 absolute -top-1 -right-1 animate-pulse" />
                )}
              </div>
              <p className="mt-4 text-gray-400">
                {aiEnabled ? 'AI is analyzing your speech...' : 'Processing...'}
              </p>
            </div>
          )}

          {/* Review Step */}
          {step === 'review' && parsedExpense && (
            <div className="space-y-4">
              {/* Original voice command - shown prominently for review */}
              <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Mic className="w-4 h-4 text-primary-400" />
                  <p className="text-xs text-primary-400 font-medium">What you said:</p>
                </div>
                <p className="text-white italic">"{parsedExpense.rawTranscript}"</p>
              </div>

              {/* Parsing mode indicator */}
              <div className={`flex items-center gap-2 text-sm ${
                parsingMode === 'ai' ? 'text-purple-400' : 'text-blue-400'
              }`}>
                {parsingMode === 'ai' ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Parsed with AI (GPT-4o-mini)
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Parsed locally (regex)
                  </>
                )}
              </div>

              {/* Confidence indicator */}
              <div className={`flex items-center gap-2 text-sm ${
                parsedExpense.confidence === 'high' ? 'text-green-400' :
                parsedExpense.confidence === 'medium' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  parsedExpense.confidence === 'high' ? 'bg-green-400' :
                  parsedExpense.confidence === 'medium' ? 'bg-yellow-400' : 'bg-red-400'
                }`} />
                {parsedExpense.confidence === 'high' ? 'High confidence - review and submit' :
                 parsedExpense.confidence === 'medium' ? 'Medium confidence - please verify details' :
                 'Low confidence - please fill in missing details'}
              </div>

              {/* Editable Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Receipt className="w-4 h-4 inline mr-1" />
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                  <input
                    type="number"
                    value={draftAmount}
                    onChange={(e) => setDraftAmount(e.target.value)}
                    className="input-field pl-8 text-lg font-bold"
                    placeholder="Enter amount"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Editable Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Edit3 className="w-4 h-4 inline mr-1" />
                  Description
                </label>
                <input
                  type="text"
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  className="input-field"
                  placeholder="What's this expense for?"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date
                </label>
                <input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Ambiguous names - Keep/Remove selection */}
              {parsedExpense.ambiguousNames.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <p className="text-sm font-medium text-yellow-400 mb-1">
                    ⚠️ Multiple people found with similar names
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    All matches are included by default. Remove the ones you don't want.
                  </p>
                  {parsedExpense.ambiguousNames.map((amb, idx) => (
                    <div key={idx} className="mb-4 last:mb-0">
                      <p className="text-sm text-gray-300 mb-2">
                        You said "<span className="text-white font-medium">{amb.searchedName}</span>":
                      </p>
                      <div className="space-y-2">
                        {amb.possibleMatches.map(match => {
                          const isKept = selectedMembers.includes(match.user_id)
                          return (
                            <div
                              key={match.user_id}
                              className={`flex items-center justify-between p-2 rounded-lg transition-all ${
                                isKept 
                                  ? 'bg-green-500/20 border border-green-500/30' 
                                  : 'bg-dark-200 border border-gray-700 opacity-50'
                              }`}
                            >
                              <span className={`text-sm ${isKept ? 'text-white' : 'text-gray-500 line-through'}`}>
                                {match.user_name}
                              </span>
                              <div className="flex gap-1">
                                {isKept ? (
                                  <button
                                    onClick={() => toggleMember(match.user_id)}
                                    className="p-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                                    title="Remove"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => toggleMember(match.user_id)}
                                    className="p-1.5 rounded-md bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors"
                                    title="Keep"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Unmatched names warning */}
              {parsedExpense.unmatchedNames.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <p className="text-sm text-red-400">
                    ⚠️ Could not find: {parsedExpense.unmatchedNames.join(', ')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Select members manually below
                  </p>
                </div>
              )}

              {/* Member Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Split with ({selectedMembers.length} selected)
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {groupMembers.map(member => {
                    const isSelected = selectedMembers.includes(member.user_id)
                    const isCurrentUser = member.user_id === user?.id
                    
                    return (
                      <div
                        key={member.user_id}
                        onClick={() => toggleMember(member.user_id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-primary-500/50 bg-primary-500/10' 
                            : 'border-gray-700 bg-dark-200 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'bg-primary-500 border-primary-500' 
                              : 'border-gray-600'
                          }`}>
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-medium text-sm">
                              {member.user_name}
                              {isCurrentUser && <span className="text-gray-500 ml-1">(you)</span>}
                            </p>
                          </div>
                          {isSelected && draftAmount && (
                            <span className="text-primary-400 text-sm">
                              ₹{(parseFloat(draftAmount) / selectedMembers.length).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-3 pt-2">
                {/* Save as Draft button - always visible */}
                <button
                  onClick={handleSaveDraft}
                  disabled={loading || !draftAmount || !draftDescription.trim()}
                  className="w-full btn-secondary flex items-center justify-center gap-2 bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/50 text-yellow-300"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      Save as Draft
                    </>
                  )}
                </button>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setStep('record')
                      setTranscript('')
                      setInterimTranscript('')
                    }}
                    className="flex-1 btn-secondary flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Re-record
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !draftAmount || selectedMembers.length === 0}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Create Expense
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VoiceExpenseModal
