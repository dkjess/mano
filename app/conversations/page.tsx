'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePeople } from '@/lib/contexts/people-context'
import { useTopics } from '@/lib/hooks/useTopics'
import { getOrCreateGeneralTopicClient } from '@/lib/general-topic'
import { formatRelativeTime } from '@/lib/utils/format-time'
import { PlusIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NewPersonModal } from '@/components/NewPersonModal'
import { NewTopicModal } from '@/components/NewTopicModal'

interface ConversationItem {
  id: string
  title: string
  subtitle?: string
  emoji: string
  href: string
  type: 'general' | 'person' | 'topic'
  lastMessage?: string
  lastMessageTime?: string
  unreadCount?: number
}

interface LastMessage {
  conversation_id: string
  content: string
  created_at: string
  is_user: boolean
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generalTopicId, setGeneralTopicId] = useState<string | null>(null)
  const [newPersonModalOpen, setNewPersonModalOpen] = useState(false)
  const [newTopicModalOpen, setNewTopicModalOpen] = useState(false)
  const { people } = usePeople()
  const { topics } = useTopics()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadConversations()
  }, [people, topics])

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        setLoading(false)
        return
      }

      // Get the General topic
      let generalTopic
      try {
        generalTopic = await getOrCreateGeneralTopicClient(user.id)
        setGeneralTopicId(generalTopic.id)
      } catch (error) {
        console.error('Failed to get/create General topic:', error)
        setLoading(false)
        return
      }

      // Fetch last messages for all conversations
      const conversationIds = [
        generalTopic.id,
        ...people.map(p => p.id),
        ...topics.filter(t => t.id !== generalTopic.id).map(t => t.id)
      ]

      // Get last message for each conversation - simplified approach
      const { data: lastMessages } = await supabase
        .from('messages')
        .select('content, created_at, is_user, person_id, topic_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // Group messages by conversation
      const messageMap = new Map<string, LastMessage>()
      lastMessages?.forEach(msg => {
        const convId = msg.person_id || msg.topic_id
        if (convId && !messageMap.has(convId)) {
          messageMap.set(convId, {
            conversation_id: convId,
            content: msg.content,
            created_at: msg.created_at,
            is_user: msg.is_user
          })
        }
      })

      const conversationList: ConversationItem[] = []

      // Add General conversation (always first in Topics)
      const generalLastMsg = messageMap.get(generalTopic.id)
      conversationList.push({
        id: generalTopic.id,
        title: 'General',
        subtitle: 'Management coaching',
        emoji: '🤲',
        href: `/topics/${generalTopic.id}`,
        type: 'general',
        lastMessage: generalLastMsg ? 
          (generalLastMsg.is_user ? 'You: ' : '') + generalLastMsg.content.slice(0, 50) + (generalLastMsg.content.length > 50 ? '...' : '') 
          : 'Start a conversation with your coach',
        lastMessageTime: generalLastMsg?.created_at
      })

      // Add other topic conversations
      topics
        .filter(topic => topic.id !== generalTopic.id)
        .forEach(topic => {
          const lastMsg = messageMap.get(topic.id)
          conversationList.push({
            id: topic.id,
            title: topic.title,
            subtitle: '',
            emoji: '💬',
            href: `/topics/${topic.id}`,
            type: 'topic',
            lastMessage: lastMsg ? 
              (lastMsg.is_user ? 'You: ' : '') + lastMsg.content.slice(0, 50) + (lastMsg.content.length > 50 ? '...' : '')
              : 'No messages yet',
            lastMessageTime: lastMsg?.created_at
          })
        })

      // Add people conversations
      people.forEach(person => {
        const lastMsg = messageMap.get(person.id)
        conversationList.push({
          id: person.id,
          title: person.name,
          subtitle: person.role || getRelationshipLabel(person.relationship_type || 'peer'),
          emoji: getRelationshipEmoji(person.relationship_type || 'peer'),
          href: `/people/${person.id}`,
          type: 'person',
          lastMessage: lastMsg ? 
            (lastMsg.is_user ? 'You: ' : '') + lastMsg.content.slice(0, 50) + (lastMsg.content.length > 50 ? '...' : '')
            : 'No messages yet',
          lastMessageTime: lastMsg?.created_at
        })
      })

      console.log('Setting conversations:', conversationList.length, 'items')
      setConversations(conversationList)
    } catch (error) {
      console.error('Error loading conversations:', error)
      // Still show General conversation even if there's an error
      setConversations([{
        id: 'general-fallback',
        title: 'General',
        subtitle: 'Management coaching',
        emoji: '🤲',
        href: '/conversations',
        type: 'general',
        lastMessage: 'Start a conversation with your coach'
      }])
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">🤲</div>
          <div className="text-gray-600">Loading conversations...</div>
        </div>
      </div>
    )
  }

  const hasTopics = conversations.filter(c => c.type === 'general' || c.type === 'topic').length > 0
  const hasPeople = conversations.filter(c => c.type === 'person').length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold text-gray-900">Conversations</h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setNewTopicModalOpen(true)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-4 w-4 mr-1.5" />
                Topic
              </button>
              <button
                onClick={() => setNewPersonModalOpen(true)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-4 w-4 mr-1.5" />
                Person
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto">
        {conversations.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="text-6xl mb-4">🤲</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Welcome to Mano
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Start by having a conversation with your management coach or adding your first team member.
            </p>
            
            <div className="space-y-3 max-w-sm mx-auto">
              {generalTopicId && (
                <Link
                  href={`/topics/${generalTopicId}`}
                  className="block w-full bg-blue-600 text-white text-center py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Start with General Coaching
                </Link>
              )}
              
              <button
                onClick={() => setNewPersonModalOpen(true)}
                className="block w-full border border-gray-300 text-gray-700 text-center py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Add Your First Team Member
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-sm">
            {/* Topics Section (General first) */}
            {hasTopics && (
              <div className="border-b border-gray-200">
                <div className="px-4 sm:px-6 lg:px-8 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wider">Topics</h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {conversations
                    .filter(c => c.type === 'general' || c.type === 'topic')
                    .map(conversation => (
                      <Link
                        key={conversation.id}
                        href={conversation.href}
                        className="block px-4 sm:px-6 lg:px-8 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 text-2xl">{conversation.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {conversation.title}
                              </p>
                              {conversation.lastMessageTime && (
                                <p className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                  {formatRelativeTime(conversation.lastMessageTime)}
                                </p>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 truncate">{conversation.subtitle}</p>
                            {conversation.lastMessage && (
                              <p className="text-sm text-gray-500 truncate mt-1">
                                {conversation.lastMessage}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            )}

            {/* Your Team Section */}
            {hasPeople && (
              <div>
                <div className="px-4 sm:px-6 lg:px-8 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wider">Your Team</h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {conversations
                    .filter(c => c.type === 'person')
                    .map(conversation => (
                      <Link
                        key={conversation.id}
                        href={conversation.href}
                        className="block px-4 sm:px-6 lg:px-8 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 text-2xl">{conversation.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {conversation.title}
                              </p>
                              {conversation.lastMessageTime && (
                                <p className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                  {formatRelativeTime(conversation.lastMessageTime)}
                                </p>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 truncate">{conversation.subtitle}</p>
                            {conversation.lastMessage && (
                              <p className="text-sm text-gray-500 truncate mt-1">
                                {conversation.lastMessage}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Creation Modals */}
      <NewPersonModal 
        isOpen={newPersonModalOpen}
        onClose={() => setNewPersonModalOpen(false)}
      />
      <NewTopicModal 
        isOpen={newTopicModalOpen}
        onClose={() => setNewTopicModalOpen(false)}
      />
    </div>
  )
}