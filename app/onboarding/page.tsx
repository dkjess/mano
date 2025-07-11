'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getOrCreateGeneralTopicClient } from '@/lib/general-topic'

type OnboardingStep = 0 | 2 | 3 | 4 | 5  // Step 1 (email verification) is skipped

interface UserProfile {
  call_name?: string
  job_role?: string
  company?: string
  email_verified: boolean
  auth_method: string
  onboarding_step: number
  onboarding_completed: boolean
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null) // Will be set after background check
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  
  // Form values
  const [email, setEmail] = useState('')
  const [callName, setCallName] = useState('')
  const [jobRole, setJobRole] = useState('')
  const [company, setCompany] = useState('')

  useEffect(() => {
    loadUserProfile()
  }, [])

  const determineStartingStep = async (): Promise<OnboardingStep> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('No authenticated user')
    }

    // Check if user has email from auth
    const hasEmail = !!user.email
    
    // Get user profile if it exists
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profile?.onboarding_completed) {
      // Already completed onboarding, redirect
      router.push('/')
      return 2 // This won't be used since we're redirecting
    }

    // Determine starting step based on background check
    if (!hasEmail) {
      // Rare edge case: auth doesn't have email, need to collect it
      return 0
    } else if (profile) {
      // Existing user resuming onboarding, skip email and resume from saved step
      return Math.max(2, (profile.onboarding_step + 2)) as OnboardingStep
    } else {
      // New user with email from auth, start with name collection
      return 2
    }
  }

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Background check to determine starting step
      const startingStep = await determineStartingStep()
      
      // Initialize user data
      setUserEmail(user.email || '')
      if (user.email) {
        setEmail(user.email)
      }

      // Load profile data if it exists
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        setProfile(profile)
        setCallName(profile.call_name || '')
        setJobRole(profile.job_role || '')
        setCompany(profile.company || '')
      }

      // Set the determined starting step (this will show the UI)
      setCurrentStep(startingStep)
    } catch (error) {
      console.error('Error loading profile:', error)
      // Fallback to email collection step on error
      setCurrentStep(0)
    } finally {
      setLoading(false)
    }
  }

  const saveProgress = async (step: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('user_profiles')
      .update({ 
        onboarding_step: Math.max(0, step - 2),
        call_name: callName || null,
        job_role: jobRole || null,
        company: company || null
      })
      .eq('user_id', user.id)
  }

  const handleNext = async () => {
    setSaving(true)
    
    try {
      // Skip if currentStep is null (still determining step)
      if (currentStep === null) {
        return
      }
      
      // Validate current step
      if (currentStep === 0 && !email) {
        alert('Please enter your email')
        return
      }
      if (currentStep === 2 && !callName) {
        alert('Please enter what I should call you')
        return
      }
      if (currentStep === 3 && !jobRole) {
        alert('Please enter your job role')
        return
      }

      // Handle email submission
      if (currentStep === 0) {
        // Update user email (no verification needed)
        const { error } = await supabase.auth.updateUser({ email })
        if (error) {
          alert('Error updating email: ' + error.message)
          return
        }
        setUserEmail(email)
        
        // Skip directly to step 2 (name collection)
        setCurrentStep(2)
        await saveProgress(0)
        return
      }

      // Save progress
      await saveProgress(currentStep)

      // Move to next step or complete
      if (currentStep === 4) {
        // Complete onboarding
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from('user_profiles')
            .update({ 
              onboarding_completed: true,
              call_name: callName,
              job_role: jobRole,
              company: company || null
            })
            .eq('user_id', user.id)
          
          // Create welcome message
          await createWelcomeMessage(user.id, callName, jobRole)
          
          router.push('/')
        }
      } else if (currentStep === 5) {
        // This is the final welcome step
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from('user_profiles')
            .update({ 
              onboarding_completed: true,
              call_name: callName,
              job_role: jobRole,
              company: company || null
            })
            .eq('user_id', user.id)
          
          // Create welcome message
          await createWelcomeMessage(user.id, callName, jobRole)
          
          router.push('/')
        }
      } else {
        setCurrentStep((currentStep + 1) as OnboardingStep)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleBack = async () => {
    if (currentStep !== null && currentStep > 0) {
      await saveProgress(currentStep - 1)
      setCurrentStep((currentStep - 1) as OnboardingStep)
    }
  }

  const createWelcomeMessage = async (userId: string, userName: string, userRole?: string) => {
    try {
      // Get or create the General topic
      const generalTopic = await getOrCreateGeneralTopicClient(userId, supabase)
      
      // Create personalized welcome message
      const roleContext = userRole ? ` as a ${userRole}` : ''
      const welcomeContent = `Hi ${userName}! 👋 

I'm Mano, your AI management companion. I'm here to help you become a better leader and navigate the complexities of management${roleContext}.

**Here's how I can help you:**

• **Difficult conversations** - Practice tough discussions, get scripts for feedback, handle conflict resolution
• **Decision making** - Work through complex decisions with incomplete information, weigh trade-offs
• **Developing your people** - Career development plans, coaching strategies, performance management  
• **Managing up** - Build stronger relationships with your manager, advocate for your team, navigate politics
• **Staying calm under pressure** - Stress management techniques, maintaining composure in crises
• **Building trust** - Become the manager people want to work for, strengthen team dynamics

**💡 How to get the most from Mano:**

**Add People** when you want to:
- Prepare for 1-on-1s with specific team members
- Navigate complex relationships with your manager or peers
- Track ongoing development conversations
- Get personalized advice about individual situations

**Create Topics** when you're working on:
- Specific projects or initiatives
- Recurring challenges (like "Team Morale" or "Technical Debt")
- Strategic planning areas
- Cross-functional collaborations

I'll remember everything we discuss and help you see patterns across conversations. When you talk about someone in General chat, I might suggest creating a dedicated space for them.

**My coaching style:**
I believe the best insights often come from within. Sometimes I'll ask you thoughtful questions to help you explore your own thinking before offering advice. Other times, when you need specific guidance or frameworks, I'll share them directly. Think of me as a thought partner who helps you discover solutions, not just someone who gives answers.

What's on your mind today? Feel free to share a current challenge, or I can help you set up your first few People profiles to get started.`

      // Insert the welcome message
      await supabase
        .from('messages')
        .insert({
          content: welcomeContent,
          topic_id: generalTopic.id,
          person_id: null,
          is_user: false, // This is from Mano (assistant)
          user_id: userId
        })

    } catch (error) {
      console.error('Error creating welcome message:', error)
      // Don't block onboarding completion if welcome message fails
    }
  }

  const handleSkip = async () => {
    if (currentStep === 4) {
      // Company is optional, complete onboarding
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('user_profiles')
          .update({ 
            onboarding_completed: true,
            call_name: callName,
            job_role: jobRole
          })
          .eq('user_id', user.id)
        
        // Create welcome message
        await createWelcomeMessage(user.id, callName, jobRole)
        
        router.push('/')
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !saving && currentStep !== null) {
      e.preventDefault()
      handleNext()
    }
  }


  const renderStep = () => {
    if (currentStep === null) {
      return null
    }
    
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-8">
            <h1 className="text-4xl font-light text-foreground">
              I need your email address to save your conversations
            </h1>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="your@email.com"
              className="onboarding-input w-full text-4xl font-light h-20 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0"
              style={{
                borderBottom: '2px solid rgba(0,0,0,0.3)',
                borderImage: 'none',
                boxShadow: 'none'
              }}
              autoFocus
            />
          </div>
        )
      
      case 2:
        return (
          <div className="space-y-8">
            <h1 className="text-4xl font-light text-foreground">
              Hi, I'm Mano.<br />
              What should I call you?
            </h1>
            <input
              type="text"
              value={callName}
              onChange={(e) => setCallName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Your name"
              className="onboarding-input w-full text-4xl font-light h-20 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0"
              style={{
                borderBottom: '2px solid rgba(0,0,0,0.3)',
                borderImage: 'none',
                boxShadow: 'none'
              }}
              autoFocus
            />
          </div>
        )
      
      case 3:
        return (
          <div className="space-y-8">
            <h1 className="text-4xl font-light text-foreground">
              Nice to meet you, {callName}.<br />
              What's your job role?
            </h1>
            <input
              type="text"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g. Engineering Manager"
              className="onboarding-input w-full text-4xl font-light h-20 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0"
              style={{
                borderBottom: '2px solid rgba(0,0,0,0.3)',
                borderImage: 'none',
                boxShadow: 'none'
              }}
              autoFocus
            />
          </div>
        )
      
      case 4:
        return (
          <div className="space-y-8">
            <h1 className="text-4xl font-light text-foreground">
              At which company do you work?
            </h1>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Company name"
              className="onboarding-input w-full text-4xl font-light h-20 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0"
              style={{
                borderBottom: '2px solid rgba(0,0,0,0.3)',
                borderImage: 'none',
                boxShadow: 'none'
              }}
              autoFocus
            />
          </div>
        )
      
      case 5:
        return (
          <div className="space-y-8">
            <h1 className="text-4xl font-light text-foreground">
              Thanks {callName}!<br />
              I'm here to help with any management challenge.
            </h1>
          </div>
        )
    }
  }

  if (loading || currentStep === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-muted-foreground">
          {loading ? 'Loading...' : 'Preparing your onboarding...'}
        </div>
      </div>
    )
  }

  const showBackButton = currentStep !== null && currentStep > 0
  const showSkipButton = currentStep === 4
  const continueText = currentStep === 5 ? 'Start chatting' : 'Continue'

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="mb-12">
          {renderStep()}
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            {showBackButton && (
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={saving}
                className="text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {showSkipButton && (
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={saving}
                className="text-muted-foreground"
              >
                Skip for now
              </Button>
            )}
            
            <Button
              onClick={handleNext}
              disabled={saving}
              size="lg"
              className="min-w-[140px]"
            >
              {saving ? 'Saving...' : continueText}
              {!saving && <ChevronRight className="h-4 w-4 ml-2" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}