'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUserAndRedirect()
  }, [])

  async function checkUserAndRedirect() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Check onboarding status
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .single()

      if (!profile?.onboarding_completed) {
        // New user - go straight to general chat for onboarding
        router.push('/people/general')
      } else {
        // Existing user - go to people overview or last conversation
        router.push('/people')
      }
    } catch (error) {
      console.error('Error checking user status:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Setting up your management companion...</div>
      </div>
    )
  }

  return null
}