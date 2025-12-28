/**
 * ===========================================
 * VOICE PARSER SERVICE
 * ===========================================
 * Parses voice input to extract expense details.
 * 
 * Example inputs:
 * - "create expense with Paritosh, Akshay, Suman of 500 for Cricket"
 * - "add 300 rupees for dinner with John and Mary"
 * - "split 1000 between everyone for party"
 * ===========================================
 */

/**
 * Parse voice input and extract expense details
 * @param {string} transcript - The voice transcript
 * @param {Array} groupMembers - Array of {user_id, user_name} from the group
 * @returns {Object} Parsed expense data
 */
export function parseVoiceExpense(transcript, groupMembers) {
  const text = transcript.toLowerCase().trim()
  
  const result = {
    amount: null,
    description: 'General Expense',
    matchedMembers: [],      // Members matched exactly
    ambiguousNames: [],      // Names with multiple matches
    unmatchedNames: [],      // Names not found in group
    includeAll: false,       // Whether to include everyone
    rawTranscript: transcript,
    confidence: 'low'
  }

  // Extract amount - look for numbers
  const amountPatterns = [
    /(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:rupees?|rs\.?|₹|inr)?/gi,
    /(?:rupees?|rs\.?|₹|inr)\s*(\d+(?:,\d+)?(?:\.\d+)?)/gi,
    /(?:of|for|amount)\s*(\d+(?:,\d+)?(?:\.\d+)?)/gi,
  ]
  
  for (const pattern of amountPatterns) {
    const match = text.match(pattern)
    if (match) {
      // Extract just the number
      const numMatch = match[0].match(/(\d+(?:,\d+)?(?:\.\d+)?)/)
      if (numMatch) {
        result.amount = parseFloat(numMatch[1].replace(/,/g, ''))
        break
      }
    }
  }

  // Extract description - look for "for" keyword
  const descPatterns = [
    /(?:for|on|towards)\s+['"]?([a-z\s]+?)['"]?(?:\s+with|\s+between|\s+of|\s+amount|\s*$)/i,
    /(?:expense|split|add)\s+(?:for\s+)?['"]?([a-z\s]+?)['"]?\s+(?:with|of|between)/i,
  ]
  
  for (const pattern of descPatterns) {
    const match = transcript.match(pattern)
    if (match && match[1]) {
      const desc = match[1].trim()
      // Filter out common words that aren't descriptions
      if (!['the', 'a', 'an', 'with', 'and', 'or'].includes(desc.toLowerCase())) {
        result.description = capitalizeWords(desc)
        break
      }
    }
  }

  // Check for "everyone" or "all"
  if (/\b(everyone|everybody|all\s*members?|all\s*of\s*us|whole\s*group)\b/i.test(text)) {
    result.includeAll = true
    result.matchedMembers = groupMembers.map(m => ({
      user_id: m.user_id,
      user_name: m.user_name,
      matched: true
    }))
    result.confidence = 'high'
    return result
  }

  // Extract names - look for words after "with" or between commas
  const namePatterns = [
    /(?:with|between|include|add)\s+([a-z,\s&]+?)(?:\s+(?:of|for|amount|rupees?|rs|₹|\d)|\s*$)/i,
    /(?:split|share|divide)\s+(?:.*?)\s+(?:with|between)\s+([a-z,\s&]+)/i,
  ]
  
  let namesString = ''
  for (const pattern of namePatterns) {
    const match = transcript.match(pattern)
    if (match && match[1]) {
      namesString = match[1]
      break
    }
  }

  // If no names found with patterns, try to find names directly
  if (!namesString) {
    // Look for group member names in the transcript
    const memberNames = groupMembers.map(m => m.user_name.toLowerCase())
    const words = text.split(/[\s,&]+/)
    
    for (const word of words) {
      if (memberNames.some(name => name.includes(word) || word.includes(name.split(' ')[0]))) {
        namesString += word + ' '
      }
    }
  }

  // Parse names from the string
  if (namesString) {
    const names = namesString
      .split(/[,&]|\s+and\s+/i)
      .map(n => n.trim())
      .filter(n => n && n.length > 1 && !['with', 'between', 'of', 'for', 'the', 'a'].includes(n.toLowerCase()))

    // Match names to group members
    for (const name of names) {
      const matches = findMembersByName(name, groupMembers)
      
      if (matches.length === 1) {
        // Exact or single match
        result.matchedMembers.push({
          ...matches[0],
          searchedName: name,
          matched: true
        })
      } else if (matches.length > 1) {
        // Multiple matches - ambiguous
        result.ambiguousNames.push({
          searchedName: name,
          possibleMatches: matches
        })
      } else {
        // No match found
        result.unmatchedNames.push(name)
      }
    }
  }

  // Calculate confidence
  if (result.amount && result.matchedMembers.length > 0) {
    result.confidence = result.ambiguousNames.length === 0 && result.unmatchedNames.length === 0 
      ? 'high' 
      : 'medium'
  } else if (result.amount || result.matchedMembers.length > 0) {
    result.confidence = 'medium'
  }

  return result
}

/**
 * Find group members by name (fuzzy matching)
 */
function findMembersByName(searchName, groupMembers) {
  const search = searchName.toLowerCase().trim()
  const matches = []

  for (const member of groupMembers) {
    const fullName = member.user_name.toLowerCase()
    const firstName = fullName.split(' ')[0]
    const lastName = fullName.split(' ').slice(-1)[0]

    // Check for exact match
    if (fullName === search || firstName === search || lastName === search) {
      matches.push({
        user_id: member.user_id,
        user_name: member.user_name,
        matchType: 'exact'
      })
    }
    // Check for partial match (name starts with search)
    else if (firstName.startsWith(search) || fullName.startsWith(search)) {
      matches.push({
        user_id: member.user_id,
        user_name: member.user_name,
        matchType: 'partial'
      })
    }
    // Check for fuzzy match (search is part of name)
    else if (fullName.includes(search) || search.includes(firstName)) {
      matches.push({
        user_id: member.user_id,
        user_name: member.user_name,
        matchType: 'fuzzy'
      })
    }
  }

  // Sort by match quality: exact > partial > fuzzy
  return matches.sort((a, b) => {
    const order = { exact: 0, partial: 1, fuzzy: 2 }
    return order[a.matchType] - order[b.matchType]
  })
}

/**
 * Capitalize first letter of each word
 */
function capitalizeWords(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Check if browser supports speech recognition
 */
export function isSpeechRecognitionSupported() {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

/**
 * Create a speech recognition instance
 */
export function createSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) return null

  const recognition = new SpeechRecognition()
  recognition.continuous = false
  recognition.interimResults = true
  recognition.lang = 'en-IN' // Indian English for better name recognition
  
  return recognition
}

