'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getOrCreateGeneralTopicClient } from '@/lib/general-topic'

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

      // Check if user is on mobile
      const isMobile = window.innerWidth < 1024 // lg breakpoint
      
      if (isMobile) {
        // Mobile users go to conversations overview
        router.push('/conversations')
      } else {
        // Desktop users go to General topic
        try {
          const generalTopic = await getOrCreateGeneralTopicClient(user.id)
          
          if (!profile?.onboarding_completed) {
            // New user - go straight to General topic for onboarding
            router.push(`/topics/${generalTopic.id}`)
          } else {
            // Existing user - go to General topic (or could be enhanced to remember last conversation)
            router.push(`/topics/${generalTopic.id}`)
          }
        } catch (topicError) {
          console.error('Error getting General topic:', topicError)
          // Fallback to people page if topic creation fails
          router.push('/people')
        }
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