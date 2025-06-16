'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { checkDebugAccess, DebugUserState } from '@/lib/debug-user'
import ResetButton from './reset-button'

export default function DebugPanel() {
  const [debugState, setDebugState] = useState<DebugUserState | null>(null)
  const [showPanel, setShowPanel] = useState(false)

  useEffect(() => {
    checkDebugAccess().then(setDebugState)
  }, [])

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = '/auth/login'
    } catch (error) {
      console.error('Error during logout:', error)
      window.location.href = '/auth/login'
    }
  }

  if (!debugState?.hasDebugAccess) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {showPanel ? (
        <div className="bg-gray-900 text-white border border-gray-700 rounded-lg p-4 shadow-xl max-w-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="text-sm font-medium text-gray-100">
              🐛 Debug Mode
            </div>
            <button
              onClick={() => setShowPanel(false)}
              className="text-gray-400 hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          
          <div className="text-xs text-gray-300 mb-3">
            User: {debugState.userEmail}
            <span className="block font-medium text-blue-400">Debug Access Enabled</span>
          </div>

          <div className="space-y-3">
            <ResetButton 
              userEmail={debugState.userEmail}
              className="w-full"
            />
            
            <button
              onClick={handleLogout}
              className="w-full px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
            >
              🚪 Sign Out
            </button>
            
            <div className="text-xs text-gray-400">
              Reset all data to test onboarding flow
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowPanel(true)}
          className="bg-gray-800 text-white px-3 py-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors text-sm font-medium border border-gray-600"
        >
          🐛
        </button>
      )}
    </div>
  )
} 