'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePeople } from '@/lib/contexts/people-context'
import { createClient } from '@/lib/supabase/client'
import { ConversationalModal } from '@/components/ui/ConversationalModal'
import { ManoMessage } from '@/components/ui/ManoMessage'

interface NewPersonModalProps {
  isOpen: boolean
  onClose: () => void
}

interface PersonFormData {
  name: string
  relationshipType: 'direct_report' | 'manager' | 'peer' | 'stakeholder' | ''
  role: string
}

export function NewPersonModal({ isOpen, onClose }: NewPersonModalProps) {
  const router = useRouter()
  const { addPerson } = usePeople()
  const supabase = createClient()

  // State management
  const [currentStep, setCurrentStep] = useState(1)
  const [personData, setPersonData] = useState<PersonFormData>({
    name: '',
    relationshipType: '',
    role: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setPersonData({ name: '', relationshipType: '', role: '' })
      setIsLoading(false)
      setError('')
    }
  }, [isOpen])

  const getMessage = () => {
    switch (currentStep) {
      case 1:
        return "What's their name?"
      case 2:
        return `How would you describe your relationship with ${personData.name}?`
      case 3:
        return `What's ${personData.name}'s role?`
      default:
        return ''
    }
  }

  const handleNameSubmit = () => {
    if (personData.name.trim()) {
      setCurrentStep(2)
    }
  }

  const handleRelationshipSelect = (relationship: PersonFormData['relationshipType']) => {
    setPersonData(prev => ({ ...prev, relationshipType: relationship }))
    setCurrentStep(3)
  }

  const handleRoleSubmit = () => {
    if (personData.role.trim()) {
      handleCreatePerson()
    }
  }

  const handleCreatePerson = async () => {
    setIsLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      console.log('🔵 NewPersonModal: Creating person via API:', {
        name: personData.name.trim(),
        role: personData.role.trim(),
        relationship_type: personData.relationshipType
      })

      // Use the API route to ensure AI welcome message generation
      const response = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: personData.name.trim(),
          role: personData.role.trim() || null,
          relationship_type: personData.relationshipType
        })
      })

      console.log('🔵 NewPersonModal: API response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create person')
      }

      const { person } = await response.json()
      console.log('🔵 NewPersonModal: Person created successfully:', person)

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

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action()
    }
  }

  const canContinueStep1 = personData.name.trim()
  const canContinueStep3 = personData.role.trim()

  return (
    <ConversationalModal isOpen={isOpen} onClose={onClose}>
      <ManoMessage message={getMessage()} key={currentStep} />

      {/* Step Content */}
      <div className="space-y-6">
        {/* Step 1: Name */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <input
              type="text"
              value={personData.name}
              onChange={(e) => setPersonData(prev => ({ ...prev, name: e.target.value }))}
              onKeyPress={(e) => handleKeyPress(e, handleNameSubmit)}
              placeholder="Enter their name"
              className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <button
              onClick={handleNameSubmit}
              disabled={!canContinueStep1}
              className="w-full h-11 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Relationship */}
        {currentStep === 2 && (
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

        {/* Step 3: Role */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <input
              type="text"
              value={personData.role}
              onChange={(e) => setPersonData(prev => ({ ...prev, role: e.target.value }))}
              onKeyPress={(e) => handleKeyPress(e, handleRoleSubmit)}
              placeholder="e.g., Software Engineer, Product Manager"
              className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <button
              onClick={handleRoleSubmit}
              disabled={!canContinueStep3 || isLoading}
              className="w-full h-11 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Add Team Member'
              )}
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
      </div>
    </ConversationalModal>
  )
}