/**
 * ===========================================
 * SETTLE UP MODAL
 * ===========================================
 * Modal for settling debts with other users.
 * Supports UPI deep links and manual recording.
 * ===========================================
 */

import { useState, useEffect } from 'react'
import { 
  X, 
  Smartphone, 
  CheckCircle, 
  ExternalLink, 
  AlertCircle,
  Banknote,
  CreditCard,
  Loader2,
  Copy,
  Check
} from 'lucide-react'
import { settlementsAPI } from '../services/api'
import { useAuth } from '../App'

// Detect iOS
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

const paymentMethods = [
  { value: 'upi', label: 'UPI (GPay/PhonePe)', icon: Smartphone },
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: CreditCard },
  { value: 'other', label: 'Other', icon: CheckCircle },
]

function SettleUpModal({ 
  isOpen, 
  onClose, 
  balance,  // { user_id, user_name, user_email, amount }
  groupId = null,
  onSettled 
}) {
  const { user } = useAuth()
  const [step, setStep] = useState('choose')  // choose, upi, confirm
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [upiInfo, setUpiInfo] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('upi')
  const [transactionRef, setTransactionRef] = useState('')
  const [notes, setNotes] = useState('')
  const [settleAmount, setSettleAmount] = useState('')

  useEffect(() => {
    if (isOpen && balance) {
      // Calculate default settle amount (what you owe or partial)
      setSettleAmount(Math.abs(balance.amount).toFixed(2))
      setStep('choose')
      setError('')
      setUpiInfo(null)
      setTransactionRef('')
      setNotes('')
    }
  }, [isOpen, balance])

  const handlePayViaUPI = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await settlementsAPI.getUPILink(
        balance.user_id, 
        parseFloat(settleAmount),
        groupId
      )
      setUpiInfo(response.data)
      setStep('upi')
    } catch (err) {
      setError(err.message || 'Failed to generate UPI link')
    } finally {
      setLoading(false)
    }
  }

  const [copiedUPI, setCopiedUPI] = useState(false)

  const openUPIApp = (appType = 'default') => {
    if (!upiInfo) return

    let link = upiInfo.upi_link // Default Android upi:// link

    // For iOS, use specific app schemes
    if (isIOS()) {
      const { payee_name, amount, transaction_note } = upiInfo
      // Clean name for GPay - remove special characters and limit length
      // GPay sometimes has issues with special characters in names
      const cleanName = payee_name
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
        .trim()
        .substring(0, 50) // Limit to 50 characters
      const encodedName = encodeURIComponent(cleanName || 'User')
      const encodedNote = encodeURIComponent(transaction_note)
      
      // Splitwise-style: Don't include pa parameter - let the app match from contacts
      // This avoids "Could not load banking name" and "exceeded bank limit" errors
      if (appType === 'gpay') {
        // Google Pay iOS scheme - without pa, GPay will match from contacts
        link = `gpay://upi/pay?pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}`
      } else if (appType === 'phonepe') {
        // PhonePe iOS scheme - without pa
        link = `phonepe://pay?pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}`
      } else if (appType === 'paytm') {
        // Paytm iOS scheme - without pa
        link = `paytmmp://pay?pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}`
      }
    }

    // Create a temporary <a> tag to open the link
    const a = document.createElement('a')
    a.href = link
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const copyUPIId = () => {
    if (upiInfo?.payee_upi_id) {
      navigator.clipboard.writeText(upiInfo.payee_upi_id)
      setCopiedUPI(true)
      setTimeout(() => setCopiedUPI(false), 2000)
    }
  }

  const handleRecordPayment = async () => {
    setLoading(true)
    setError('')
    
    try {
      // Determine from/to based on who owes whom
      // youOwe = true means balance.amount < 0, so YOU are paying THEM
      // youOwe = false means balance.amount > 0, so THEY are paying YOU
      const youOwe = balance.amount < 0
      
      const settlementData = {
        amount: parseFloat(settleAmount),
        group_id: groupId,
        payment_method: paymentMethod,
        transaction_ref: transactionRef || null,
        notes: notes || null
      }
      
      if (youOwe) {
        // You are paying them
        // from_user_id = you (default, don't need to specify)
        // to_user_id = them
        settlementData.to_user_id = balance.user_id
      } else {
        // They are paying you (recording payment received)
        // from_user_id = them (the payer)
        // to_user_id = you (the receiver)
        settlementData.from_user_id = balance.user_id
        settlementData.to_user_id = user.id
      }
      
      await settlementsAPI.record(settlementData)
      
      onSettled?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to record settlement')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !balance) return null

  const amountOwed = Math.abs(balance.amount)
  const youOwe = balance.amount < 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-dark-100 rounded-2xl w-full max-w-md border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-bold text-white">
              Settle Up
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-dark-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          {/* User info */}
          <div className="mt-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
              <span className="text-primary-400 text-lg font-semibold">
                {balance.user_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-white font-medium">{balance.user_name}</p>
              <p className="text-sm text-gray-500">{balance.user_email}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {step === 'choose' && (
            <div className="space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {youOwe ? 'You owe' : 'They owe you'}
                </label>
                <div className="p-4 bg-dark-200 rounded-xl">
                  <p className={`text-3xl font-bold ${youOwe ? 'text-red-400' : 'text-green-400'}`}>
                    ₹{amountOwed.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Settle Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount to settle
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                  <input
                    type="number"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="input-field pl-8"
                    min="0"
                    step="0.01"
                    max={amountOwed}
                  />
                </div>
                {parseFloat(settleAmount) < amountOwed && (
                  <p className="text-sm text-gray-500 mt-1">
                    Partial settlement - ₹{(amountOwed - parseFloat(settleAmount || 0)).toFixed(2)} will remain
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Payment method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map(method => {
                    const Icon = method.icon
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setPaymentMethod(method.value)}
                        className={`p-3 rounded-xl border flex items-center gap-2 transition-all
                          ${paymentMethod === method.value 
                            ? 'border-primary-500 bg-primary-500/10 text-white' 
                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-sm">{method.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-2">
                {paymentMethod === 'upi' && youOwe && (
                  <button
                    onClick={handlePayViaUPI}
                    disabled={loading || !settleAmount || parseFloat(settleAmount) <= 0}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Smartphone className="w-5 h-5" />
                        Pay ₹{parseFloat(settleAmount || 0).toFixed(2)} via UPI
                      </>
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!settleAmount || parseFloat(settleAmount) <= 0}
                  className={`w-full flex items-center justify-center gap-2
                    ${paymentMethod === 'upi' && youOwe
                      ? 'btn-secondary' 
                      : 'btn-primary'
                    }
                  `}
                >
                  <CheckCircle className="w-5 h-5" />
                  {youOwe ? "I've Already Paid" : "Record Payment Received"}
                </button>
              </div>
            </div>
          )}

          {step === 'upi' && upiInfo && (
            <div className="space-y-4">
              {/* UPI Info */}
              <div className="p-4 bg-dark-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Pay to</span>
                  <span className="text-white font-medium">{upiInfo.payee_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">UPI ID</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-sm">{upiInfo.payee_upi_id}</span>
                    <button 
                      onClick={copyUPIId}
                      className="p-1 rounded hover:bg-dark-300 transition-colors"
                      title="Copy UPI ID"
                    >
                      {copiedUPI ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-primary-400 font-bold text-xl">₹{upiInfo.amount}</span>
                </div>
              </div>

              {/* iOS: Show app-specific buttons */}
              {isIOS() ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400 text-center mb-2">Choose your UPI app:</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => openUPIApp('gpay')}
                      className="p-3 bg-dark-200 rounded-xl hover:bg-dark-300 transition-colors flex flex-col items-center gap-1"
                    >
                      <span className="text-2xl">💳</span>
                      <span className="text-xs text-gray-300">GPay</span>
                    </button>
                    <button
                      onClick={() => openUPIApp('phonepe')}
                      className="p-3 bg-dark-200 rounded-xl hover:bg-dark-300 transition-colors flex flex-col items-center gap-1"
                    >
                      <span className="text-2xl">📱</span>
                      <span className="text-xs text-gray-300">PhonePe</span>
                    </button>
                    <button
                      onClick={() => openUPIApp('paytm')}
                      className="p-3 bg-dark-200 rounded-xl hover:bg-dark-300 transition-colors flex flex-col items-center gap-1"
                    >
                      <span className="text-2xl">💰</span>
                      <span className="text-xs text-gray-300">Paytm</span>
                    </button>
                  </div>
                  <p className="text-center text-xs text-gray-500 mt-2">
                    GPay will match the recipient from your contacts
                  </p>
                  <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-xs text-blue-400 text-center">
                      💡 Tip: Make sure "{upiInfo.payee_name}" is saved in your phone contacts for GPay to find them easily
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Android: Single button that opens app chooser */}
                  <button
                    onClick={() => openUPIApp('default')}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Open UPI App to Pay
                  </button>
                  <p className="text-center text-sm text-gray-500">
                    This will open GPay, PhonePe, or your default UPI app
                  </p>
                </>
              )}

              {/* After payment */}
              <div className="border-t border-gray-700 pt-4 mt-4">
                <p className="text-sm text-gray-400 mb-3">After completing payment:</p>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Transaction ID (optional)
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    className="input-field"
                    placeholder="Enter UPI transaction ID"
                  />
                </div>

                <button
                  onClick={handleRecordPayment}
                  disabled={loading}
                  className="w-full mt-4 btn-secondary flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Mark as Paid
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => setStep('choose')}
                className="w-full text-gray-400 hover:text-white transition-colors text-sm"
              >
                ← Back to options
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <p className="text-gray-300">
                {youOwe 
                  ? `Confirm that you've paid ₹${parseFloat(settleAmount).toFixed(2)} to ${balance.user_name}?`
                  : `Record that you've received ₹${parseFloat(settleAmount).toFixed(2)} from ${balance.user_name}?`
                }
              </p>

              {/* Payment details */}
              <div className="p-4 bg-dark-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-primary-400 font-bold">₹{parseFloat(settleAmount).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Method</span>
                  <span className="text-white">
                    {paymentMethods.find(m => m.value === paymentMethod)?.label}
                  </span>
                </div>
              </div>

              {/* Optional fields */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Transaction Reference (optional)
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="input-field"
                  placeholder="UPI ID, receipt number, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input-field resize-none"
                  rows={2}
                  placeholder="Any additional notes..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep('choose')}
                  className="flex-1 btn-secondary"
                >
                  Back
                </button>
                <button
                  onClick={handleRecordPayment}
                  disabled={loading}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettleUpModal

