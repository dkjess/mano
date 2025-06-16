'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ResetButtonProps {
  userEmail: string
  className?: string
}

export default function ResetButton({ userEmail, className = '' }: ResetButtonProps) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const handleReset = async () => {
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/dev/reset-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Reset failed')
      }

      const result = await response.json()
      console.log('Reset successful:', result)
      
      // Redirect to trigger onboarding
      router.push('/people/general')
      router.refresh()
      
    } catch (error: any) {
      console.error('Error resetting user:', error)
      alert(`Reset failed: ${error.message}`)
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  const handleCancel = () => {
    setShowConfirm(false)
  }

  if (showConfirm) {
    return (
      <div className={`${className} space-y-2`}>
        <div className="text-sm text-red-600 font-medium">
          Reset all data for {userEmail}?
        </div>
        <div className="text-xs text-gray-500">
          This will delete all conversations, people, and reset onboarding.
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={loading}
            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Resetting...' : 'Yes, Reset'}
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={handleReset}
      className={`${className} px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors`}
    >
      🔄 Reset Test Data
    </button>
  )
} 