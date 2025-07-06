'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface ProfileSectionProps {
  user: any
  onUserUpdate: (user: any) => void
}

function ProfileSection({ user, onUserUpdate }: ProfileSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    full_name: user.user_metadata?.full_name || '',
    email: user.email || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Update user metadata (name)
      const { data: authData, error: authError } = await supabase.auth.updateUser({
        data: { full_name: formData.full_name.trim() }
      })

      if (authError) throw authError

      // Update email if changed
      if (formData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email.trim()
        })
        
        if (emailError) throw emailError
        setSuccess('Profile updated! Please check your email to confirm any email changes.')
      } else {
        setSuccess('Profile updated successfully!')
      }

      // Update local user state
      if (authData.user) {
        onUserUpdate(authData.user)
      }

      setIsEditing(false)
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setError(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      full_name: user.user_metadata?.full_name || '',
      email: user.email || ''
    })
    setIsEditing(false)
    setError('')
    setSuccess('')
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>
      <p className="text-gray-600 mb-6">Update your personal information and preferences.</p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
            Full Name
          </label>
          <input
            type="text"
            id="full_name"
            value={formData.full_name}
            onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            placeholder="Enter your email address"
            required
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit Profile
            </button>
          ) : (
            <div className="flex items-center space-x-3">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : null}
                Save Changes
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}

function SecuritySection() {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    // Validate passwords
    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match')
      setLoading(false)
      return
    }

    if (formData.newPassword.length < 8) {
      setError('New password must be at least 8 characters long')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword
      })

      if (error) throw error

      setSuccess('Password updated successfully!')
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (err: any) {
      console.error('Error updating password:', err)
      setError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h3>
      <p className="text-gray-600 mb-6">Manage your password and account security.</p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
            Current Password
          </label>
          <input
            type="password"
            id="currentPassword"
            value={formData.currentPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your current password"
            required
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
            New Password
          </label>
          <input
            type="password"
            id="newPassword"
            value={formData.newPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your new password"
            required
            minLength={8}
          />
          <p className="text-sm text-gray-500 mt-1">Password must be at least 8 characters long</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
            Confirm New Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={formData.confirmPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Confirm your new password"
            required
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : null}
            Update Password
          </button>
        </div>
      </form>
    </div>
  )
}

function AccountActionsSection() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  const handleLogout = async () => {
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      router.push('/auth/login')
    } catch (err: any) {
      console.error('Error logging out:', err)
      setError(err.message || 'Failed to log out')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    setLoading(true)
    setError('')

    try {
      // Note: Supabase doesn't have a direct deleteUser method from client
      // This would need to be implemented via an API route that calls admin methods
      // For now, we'll show this as coming soon
      setError('Account deletion feature is not yet implemented. Please contact support.')
    } catch (err: any) {
      console.error('Error deleting account:', err)
      setError(err.message || 'Failed to delete account')
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Account Actions</h3>
      <p className="text-gray-600 mb-6">Manage your account and data.</p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Logout Section */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-2">Sign Out</h4>
          <p className="text-gray-600 mb-4">Sign out of your account on this device.</p>
          <button
            onClick={handleLogout}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : null}
            Sign Out
          </button>
        </div>

        {/* Delete Account Section */}
        <div className="border border-red-200 rounded-lg p-6 bg-red-50">
          <h4 className="text-lg font-medium text-red-900 mb-2">Delete Account</h4>
          <p className="text-red-700 mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Account
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-red-800 font-medium">
                Are you sure? This will permanently delete your account and all conversations.
              </p>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : null}
                  Yes, Delete Account
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AccountPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('profile')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) throw error
        
        if (!user) {
          router.push('/auth/login')
          return
        }
        
        setUser(user)
      } catch (error) {
        console.error('Error loading user:', error)
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }
    
    loadUser()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">🤲</div>
          <div className="text-gray-600">Loading account...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center flex-1">
            <Link
              href="/conversations"
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors mr-3"
              aria-label="Back to conversations"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </Link>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                Account Settings
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop: Use same layout as conversations */}
      <div className="hidden lg:block">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <h1 className="text-xl font-semibold text-gray-900">Account Settings</h1>
            </div>
          </div>
        </header>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Info Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-xl font-medium text-blue-600">
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
              </h2>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <nav className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveSection('profile')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeSection === 'profile'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveSection('security')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeSection === 'security'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Security
            </button>
            <button
              onClick={() => setActiveSection('account')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeSection === 'account'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Account
            </button>
          </nav>

          {/* Content Sections */}
          <div className="p-6">
            {activeSection === 'profile' && (
              <ProfileSection user={user} onUserUpdate={setUser} />
            )}

            {activeSection === 'security' && (
              <SecuritySection />
            )}

            {activeSection === 'account' && (
              <AccountActionsSection />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}