'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTopics } from '@/lib/hooks/useTopics'
import { ConversationalModal } from '@/components/ui/ConversationalModal'
import { ManoMessage } from '@/components/ui/ManoMessage'

interface NewTopicModalProps {
  isOpen: boolean
  onClose: () => void
}

interface TopicFormData {
  title: string
}

export function NewTopicModal({ isOpen, onClose }: NewTopicModalProps) {
  const router = useRouter()
  const { createTopic } = useTopics()

  // State management
  const [topicData, setTopicData] = useState<TopicFormData>({
    title: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTopicData({ title: '' })
      setIsLoading(false)
      setError('')
    }
  }, [isOpen])

  const getMessage = () => {
    return "What would you like to discuss?"
  }

  const handleTitleSubmit = () => {
    if (topicData.title.trim()) {
      handleCreateTopic()
    }
  }

  const handleCreateTopic = async () => {
    setIsLoading(true)
    setError('')

    try {
      console.log('🔵 NewTopicModal: Creating topic via API:', {
        title: topicData.title.trim()
      })

      // Use the API route to ensure AI welcome message generation
      const response = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: topicData.title.trim(),
          participants: []
        })
      })

      console.log('🔵 NewTopicModal: API response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create topic')
      }

      const { topic } = await response.json()
      console.log('🔵 NewTopicModal: Topic created successfully:', topic)

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

  const canContinue = topicData.title.trim()

  return (
    <ConversationalModal isOpen={isOpen} onClose={onClose}>
      <ManoMessage message={getMessage()} key="topic-title" />

      {/* Step Content */}
      <div className="space-y-6">
        <div className="space-y-4">
          <input
            type="text"
            value={topicData.title}
            onChange={(e) => setTopicData(prev => ({ ...prev, title: e.target.value }))}
            onKeyPress={(e) => handleKeyPress(e, handleTitleSubmit)}
            placeholder="e.g., Team Performance, Project Planning"
            className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          <button
            onClick={handleTitleSubmit}
            disabled={!canContinue || isLoading}
            className="w-full h-11 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Start Discussion'
            )}
          </button>
        </div>

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