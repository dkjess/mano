'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePeople } from '@/lib/contexts/people-context'
import { useTopics } from '@/lib/hooks/useTopics'
import { createClient } from '@/lib/supabase/client'
import type { Person } from '@/types/database'

interface ManoOnboardingProps {
  isOpen: boolean
  onClose: () => void
  flowType: 'person' | 'topic'
}

interface PersonFormData {
  name: string
  relationshipType: 'direct_report' | 'manager' | 'peer' | 'stakeholder' | ''
  role: string
}

interface TopicFormData {
  title: string
}

export function ManoOnboarding({ isOpen, onClose, flowType }: ManoOnboardingProps) {
  const router = useRouter()
  const { addPerson } = usePeople()
  const { refetch: refreshTopics } = useTopics()
  const supabase = createClient()

  // State management
  const [currentStep, setCurrentStep] = useState(1)
  const [personData, setPersonData] = useState<PersonFormData>({
    name: '',
    relationshipType: '',
    role: ''
  })
  const [topicData, setTopicData] = useState<TopicFormData>({
    title: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showMessage, setShowMessage] = useState(false)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Start directly at name/title input step
      setCurrentStep(flowType === 'person' ? 2 : 2)
      setPersonData({ name: '', relationshipType: '', role: '' })
      setTopicData({ title: '' })
      setIsLoading(false)
      setError('')
      setShowMessage(false)
      // Trigger message animation
      setTimeout(() => setShowMessage(true), 100)
    }
  }, [isOpen, flowType])

  // Animation trigger for step changes
  useEffect(() => {
    if (isOpen) {
      setShowMessage(false)
      setTimeout(() => setShowMessage(true), 100)
    }
  }, [currentStep])

  if (!isOpen) return null

  // Person flow messages and handlers
  const getPersonMessage = () => {
    switch (currentStep) {
      case 2:
        return "What's their name?"
      case 3:
        return `How would you describe your relationship with ${personData.name}?`
      case 4:
        return `What's ${personData.name}'s role?`
      default:
        return ''
    }
  }

  // Topic flow messages
  const getTopicMessage = () => {
    switch (currentStep) {
      case 2:
        return "What would you like to discuss?"
      default:
        return ''
    }
  }

  const getMessage = () => {
    return flowType === 'person' ? getPersonMessage() : getTopicMessage()
  }

  const handlePersonNameSubmit = () => {
    if (personData.name.trim()) {
      setCurrentStep(3)
    }
  }

  const handleRelationshipSelect = (relationship: PersonFormData['relationshipType']) => {
    setPersonData(prev => ({ ...prev, relationshipType: relationship }))
    setCurrentStep(4)
  }

  const handlePersonRoleSubmit = () => {
    if (personData.role.trim()) {
      handleCreatePerson()
    }
  }

  const handleTopicTitleSubmit = () => {
    if (topicData.title.trim()) {
      handleCreateTopic()
    }
  }

  const handleCreatePerson = async () => {
    setIsLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      const newPerson: Omit<Person, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        name: personData.name.trim(),
        role: personData.role.trim(),
        relationship_type: personData.relationshipType
      }

      const { data: person, error: createError } = await supabase
        .from('people')
        .insert(newPerson)
        .select()
        .single()

      if (createError) throw createError

      addPerson(person)
      onClose()
      router.push(`/people/${person.id}`)
    } catch (err) {
      console.error('Error creating person:', err)
      setError('Failed to create person. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateTopic = async () => {
    setIsLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      const { data: topic, error: createError } = await supabase
        .from('topics')
        .insert({
          title: topicData.title.trim(),
          participants: [],
          created_by: user.id,
          status: 'active'
        })
        .select()
        .single()

      if (createError) throw createError

      refreshTopics()
      onClose()
      router.push(`/topics/${topic.id}`)
    } catch (err) {
      console.error('Error creating topic:', err)
      setError('Failed to create topic. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action()
    }
  }

  const canContinueStep2 = flowType === 'person' ? personData.name.trim() : topicData.title.trim()
  const canContinueStep4 = personData.role.trim()

  return (
    <div 
      className="fixed inset-0 z-50 bg-white"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif' }}
    >
      <div className="flex justify-center pt-20 px-4">
        <div className="w-full max-w-sm">
          {/* Mano Message */}
          <div className="mb-8">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <span className="text-2xl">🤲</span>
              </div>
              <div 
                className={`flex-1 transform transition-all duration-300 ease-out ${
                  showMessage ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                }`}
              >
                <p className="text-base font-medium text-gray-800 leading-relaxed">
                  {getMessage()}
                </p>
              </div>
            </div>
          </div>

          {/* Step Content */}
          <div className="space-y-6">
            {/* Person Flow */}
            {flowType === 'person' && (
              <>
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={personData.name}
                      onChange={(e) => setPersonData(prev => ({ ...prev, name: e.target.value }))}
                      onKeyPress={(e) => handleKeyPress(e, handlePersonNameSubmit)}
                      placeholder="Enter their name"
                      className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />
                    <button
                      onClick={handlePersonNameSubmit}
                      disabled={!canContinueStep2}
                      className="w-full h-11 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Continue
                    </button>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleRelationshipSelect('direct_report')}
                      className="h-11 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Direct Report
                    </button>
                    <button
                      onClick={() => handleRelationshipSelect('manager')}
                      className="h-11 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Manager
                    </button>
                    <button
                      onClick={() => handleRelationshipSelect('peer')}
                      className="h-11 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Peer
                    </button>
                    <button
                      onClick={() => handleRelationshipSelect('stakeholder')}
                      className="h-11 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Stakeholder
                    </button>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={personData.role}
                      onChange={(e) => setPersonData(prev => ({ ...prev, role: e.target.value }))}
                      onKeyPress={(e) => handleKeyPress(e, handlePersonRoleSubmit)}
                      placeholder="e.g., Software Engineer, Product Manager"
                      className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />
                    <button
                      onClick={handlePersonRoleSubmit}
                      disabled={!canContinueStep4 || isLoading}
                      className="w-full h-11 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'Continue'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Topic Flow */}
            {flowType === 'topic' && (
              <>
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={topicData.title}
                      onChange={(e) => setTopicData(prev => ({ ...prev, title: e.target.value }))}
                      onKeyPress={(e) => handleKeyPress(e, handleTopicTitleSubmit)}
                      placeholder="e.g., Team Performance, Project Planning"
                      className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />
                    <button
                      onClick={handleTopicTitleSubmit}
                      disabled={!canContinueStep2 || isLoading}
                      className="w-full h-11 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'Continue'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}