'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePeople } from '@/lib/contexts/people-context'
import { useTopics } from '@/lib/hooks/useTopics'
import { getOrCreateGeneralTopicClient } from '@/lib/general-topic'
import { MobileLayout, ConversationListItem } from '@/components/MobileLayout'
import { PlusIcon, UserGroupIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface ConversationItem {
  id: string
  title: string
  subtitle?: string
  emoji: string
  href: string
  type: 'general' | 'person' | 'topic'
  lastMessage?: string
  timestamp?: string
  isActive?: boolean
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generalTopicId, setGeneralTopicId] = useState<string | null>(null)
  const { people } = usePeople()
  const { topics } = useTopics()
  const supabase = createClient()

  useEffect(() => {
    loadConversations()
  }, [people, topics])

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get the General topic
      const generalTopic = await getOrCreateGeneralTopicClient(user.id)
      setGeneralTopicId(generalTopic.id)

      const conversationList: ConversationItem[] = []

      // Add General conversation (always first)
      conversationList.push({
        id: 'general',
        title: 'General',
        subtitle: 'Management coaching',
        emoji: '🤲',
        href: `/topics/${generalTopic.id}`,
        type: 'general'
      })

      // Add people conversations
      people.forEach(person => {
        conversationList.push({
          id: person.id,
          title: person.name,
          subtitle: person.role || getRelationshipLabel(person.relationship_type || 'peer'),
          emoji: getRelationshipEmoji(person.relationship_type || 'peer'),
          href: `/people/${person.id}`,
          type: 'person'
        })
      })

      // Add topic conversations (excluding General topic)
      topics
        .filter(topic => topic.id !== generalTopic.id)
        .forEach(topic => {
          conversationList.push({
            id: topic.id,
            title: topic.title,
            subtitle: `${topic.participants.length} participants`,
            emoji: '💬',
            href: `/topics/${topic.id}`,
            type: 'topic'
          })
        })

      // TODO: Fetch last messages and timestamps for each conversation
      // This would require additional API calls to get recent messages

      setConversations(conversationList)
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRelationshipEmoji = (relationshipType: string) => {
    switch (relationshipType) {
      case 'manager': return '👨‍💼'
      case 'direct_report': return '👤'
      case 'peer': return '🤝'
      case 'stakeholder': return '📊'
      default: return '👤'
    }
  }

  const getRelationshipLabel = (relationshipType: string) => {
    switch (relationshipType) {
      case 'manager': return 'Manager'
      case 'direct_report': return 'Direct Report'
      case 'peer': return 'Peer'
      case 'stakeholder': return 'Stakeholder'
      default: return 'Team Member'
    }
  }

  const headerActions = (
    <div className="flex items-center space-x-2">
      <Link
        href="/people/new"
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Add person"
      >
        <UserGroupIcon className="w-5 h-5 text-gray-600" />
      </Link>
      <Link
        href="/topics/new"
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Create topic"
      >
        <ChatBubbleLeftRightIcon className="w-5 h-5 text-gray-600" />
      </Link>
    </div>
  )

  if (loading) {
    return (
      <MobileLayout
        title="Conversations"
        showBackButton={false}
        rightAction={headerActions}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-2xl mb-2">🤲</div>
            <div className="text-gray-500">Loading conversations...</div>
          </div>
        </div>
      </MobileLayout>
    )
  }

  return (
    <MobileLayout
      title="Conversations"
      showBackButton={false}
      rightAction={headerActions}
    >
      <div className="conversations-list">
        {conversations.length === 0 ? (
          <div className="empty-state flex flex-col items-center justify-center h-full px-6 text-center">
            <div className="empty-state-emoji text-6xl mb-4">🤲</div>
            <h2 className="empty-state-title text-xl font-semibold text-gray-900 mb-2">
              Welcome to Mano
            </h2>
            <p className="empty-state-subtitle text-gray-600 mb-6">
              Start by having a conversation with your management coach or adding your first team member.
            </p>
            
            <div className="empty-state-actions space-y-3 w-full max-w-sm">
              {generalTopicId && (
                <Link
                  href={`/topics/${generalTopicId}`}
                  className="block w-full bg-blue-600 text-white text-center py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Start General Coaching
                </Link>
              )}
              
              <Link
                href="/people/new"
                className="block w-full border border-gray-300 text-gray-700 text-center py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Add Team Member
              </Link>
            </div>
          </div>
        ) : (
          <div className="conversation-groups">
            {/* Coach Section */}
            <div className="conversation-group">
              <div className="group-header px-4 py-2 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                  Coach
                </h3>
              </div>
              {conversations
                .filter(conv => conv.type === 'general')
                .map(conversation => (
                  <ConversationListItem
                    key={conversation.id}
                    title={conversation.title}
                    subtitle={conversation.subtitle}
                    emoji={conversation.emoji}
                    href={conversation.href}
                    isActive={conversation.isActive}
                    lastMessage={conversation.lastMessage}
                    timestamp={conversation.timestamp}
                  />
                ))}
            </div>

            {/* Team Section */}
            {conversations.filter(conv => conv.type === 'person').length > 0 && (
              <div className="conversation-group">
                <div className="group-header px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                    Your Team
                  </h3>
                </div>
                {conversations
                  .filter(conv => conv.type === 'person')
                  .map(conversation => (
                    <ConversationListItem
                      key={conversation.id}
                      title={conversation.title}
                      subtitle={conversation.subtitle}
                      emoji={conversation.emoji}
                      href={conversation.href}
                      isActive={conversation.isActive}
                      lastMessage={conversation.lastMessage}
                      timestamp={conversation.timestamp}
                    />
                  ))}
              </div>
            )}

            {/* Topics Section */}
            {conversations.filter(conv => conv.type === 'topic').length > 0 && (
              <div className="conversation-group">
                <div className="group-header px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                    Topics
                  </h3>
                </div>
                {conversations
                  .filter(conv => conv.type === 'topic')
                  .map(conversation => (
                    <ConversationListItem
                      key={conversation.id}
                      title={conversation.title}
                      subtitle={conversation.subtitle}
                      emoji={conversation.emoji}
                      href={conversation.href}
                      isActive={conversation.isActive}
                      lastMessage={conversation.lastMessage}
                      timestamp={conversation.timestamp}
                    />
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MobileLayout>
  )
}