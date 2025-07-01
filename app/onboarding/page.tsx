'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(0)
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

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      setUserEmail(user.email || '')

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
        
        // Resume from saved step
        if (!profile.onboarding_completed) {
          // Check if we need email collection
          if (!user.email) {
            setCurrentStep(0)
          } else {
            // Skip email verification, go straight to name collection
            setCurrentStep(Math.max(2, (profile.onboarding_step + 2)) as OnboardingStep)
          }
        } else {
          // Already completed onboarding
          router.push('/')
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error)
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
    if (currentStep > 0) {
      await saveProgress(currentStep - 1)
      setCurrentStep((currentStep - 1) as OnboardingStep)
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
        
        router.push('/')
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !saving) {
      e.preventDefault()
      handleNext()
    }
  }


  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-8">
            <h1 className="text-4xl font-light text-foreground">
              I need your email to save your conversations
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const showBackButton = currentStep > 0
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