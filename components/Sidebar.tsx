'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePeople } from '@/lib/contexts/people-context'
import { useTopics } from '@/lib/hooks/useTopics'
import { getOrCreateGeneralTopicClient } from '@/lib/general-topic'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils/format-time'
import { ManoOnboarding } from '@/components/ManoOnboarding'

interface SidebarProps {
  currentPersonId?: string
  currentTopicId?: string
}

interface ConversationItem {
  id: string
  title: string
  subtitle?: string
  emoji: string
  href: string
  type: 'general' | 'person' | 'topic'
  lastMessage?: string
  lastMessageTime?: string
}

interface LastMessage {
  conversation_id: string
  content: string
  created_at: string
  is_user: boolean
}

export function Sidebar({ currentPersonId, currentTopicId }: SidebarProps) {
  const { people } = usePeople()
  const { topics } = useTopics()
  const [generalTopicId, setGeneralTopicId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [onboardingFlow, setOnboardingFlow] = useState<'person' | 'topic'>('person')
  const supabase = createClient()

  // Load conversations with timestamps and last messages (same logic as /conversations page)
  useEffect(() => {
    loadConversations()
  }, [people, topics])

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
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

      // Get last message for each conversation
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
            subtitle: topic.participants?.length ? `${topic.participants.length} participants` : 'No participants',
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

      setConversations(conversationList)
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter conversations by type
  const topicConversations = conversations.filter(c => c.type === 'general' || c.type === 'topic')
  const peopleConversations = conversations.filter(c => c.type === 'person')

  const getRelationshipEmoji = (relationshipType: string) => {
    return '👤' // Default person emoji for all team members
  }

  const getConversationEmoji = (type: string) => {
    switch (type) {
      case 'general': return '🤲'
      case 'topic': return '💬'
      case 'person': return '👤'
      default: return '💬'
    }
  }

  const handleNewTopic = (e: React.MouseEvent) => {
    e.preventDefault()
    setOnboardingFlow('topic')
    setOnboardingOpen(true)
  }

  const handleAddPerson = (e: React.MouseEvent) => {
    e.preventDefault()
    setOnboardingFlow('person')
    setOnboardingOpen(true)
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

  return (
    <aside className="sidebar flex flex-col w-80 bg-white border-r border-gray-200 shadow-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif' }}>
      {/* Sidebar Header */}
      <div className="sidebar-header px-6 py-5 border-b border-gray-100 bg-gray-50">
        <Link href="/conversations" className="sidebar-logo block text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
          Mano
        </Link>
      </div>
      
      {/* Navigation */}
      <nav className="sidebar-nav flex-1 overflow-y-auto py-6 bg-gray-50">
        {/* Topics Section (General first) */}
        {topicConversations.length > 0 && (
          <section className="nav-section mb-6">
            <div className="nav-section-header px-6 mb-4">
              <h2 className="nav-section-title text-xs font-bold text-gray-700 uppercase tracking-widest">Topics</h2>
            </div>
            <div className="nav-section-items">
              {topicConversations.map(conversation => (
                <Link 
                  key={conversation.id} 
                  href={conversation.href} 
                  className={`group block px-6 py-4 hover:bg-white hover:shadow-sm transition-all duration-200 border-l-3 ${
                    (conversation.type === 'general' && currentTopicId === conversation.id) || 
                    (conversation.type === 'topic' && currentTopicId === conversation.id) 
                      ? 'bg-blue-50 border-l-blue-500 shadow-sm' 
                      : 'border-l-transparent hover:border-l-gray-200'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <span className="text-lg">{getConversationEmoji(conversation.type)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-gray-700">
                          {conversation.title}
                        </h3>
                        {conversation.lastMessageTime && (
                          <span className="text-xs font-medium text-gray-500 ml-3 flex-shrink-0">
                            {formatRelativeTime(conversation.lastMessageTime)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 truncate leading-relaxed">{conversation.subtitle}</p>
                    </div>
                  </div>
                </Link>
              ))}
              
              {/* New Topic Action */}
              <button 
                onClick={handleNewTopic}
                className="group block w-full text-left px-6 py-4 hover:bg-white hover:shadow-sm transition-all duration-200 border-l-3 border-l-transparent hover:border-l-gray-200"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <span className="text-lg text-gray-400">💬</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-medium text-gray-500 group-hover:text-gray-700">
                        New topic
                      </h3>
                    </div>
                    <p className="text-xs text-gray-400 truncate leading-relaxed">Start a new conversation</p>
                  </div>
                </div>
              </button>
            </div>
          </section>
        )}

        {/* Show Topics empty state if no topics */}
        {topicConversations.length === 0 && !loading && (
          <section className="nav-section mb-6">
            <div className="nav-section-header px-6 mb-4">
              <h2 className="nav-section-title text-xs font-bold text-gray-700 uppercase tracking-widest">Topics</h2>
            </div>
            <div className="nav-section-items">
              {/* New Topic Action */}
              <button 
                onClick={handleNewTopic}
                className="group block w-full text-left px-6 py-4 hover:bg-white hover:shadow-sm transition-all duration-200 border-l-3 border-l-transparent hover:border-l-gray-200"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <span className="text-lg text-gray-400">💬</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-medium text-gray-500 group-hover:text-gray-700">
                        New topic
                      </h3>
                    </div>
                    <p className="text-xs text-gray-400 truncate leading-relaxed">Start a new conversation</p>
                  </div>
                </div>
              </button>
            </div>
          </section>
        )}

        {/* Your Team Section */}
        {peopleConversations.length > 0 && (
          <section className="nav-section">
            <div className="nav-section-header px-6 mb-4">
              <h2 className="nav-section-title text-xs font-bold text-gray-700 uppercase tracking-widest">Your Team</h2>
            </div>
            <div className="nav-section-items">
              {peopleConversations.map(conversation => (
                <Link 
                  key={conversation.id} 
                  href={conversation.href} 
                  className={`group block px-6 py-4 hover:bg-white hover:shadow-sm transition-all duration-200 border-l-3 ${
                    currentPersonId === conversation.id 
                      ? 'bg-blue-50 border-l-blue-500 shadow-sm' 
                      : 'border-l-transparent hover:border-l-gray-200'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <span className="text-lg">{getConversationEmoji(conversation.type)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-gray-700">
                          {conversation.title}
                        </h3>
                        {conversation.lastMessageTime && (
                          <span className="text-xs font-medium text-gray-500 ml-3 flex-shrink-0">
                            {formatRelativeTime(conversation.lastMessageTime)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 truncate leading-relaxed">{conversation.subtitle}</p>
                    </div>
                  </div>
                </Link>
              ))}
              
              {/* Add Team Member Action */}
              <button 
                onClick={handleAddPerson}
                className="group block w-full text-left px-6 py-4 hover:bg-white hover:shadow-sm transition-all duration-200 border-l-3 border-l-transparent hover:border-l-gray-200"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <span className="text-lg text-gray-400">👤</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-medium text-gray-500 group-hover:text-gray-700">
                        Add team member
                      </h3>
                    </div>
                    <p className="text-xs text-gray-400 truncate leading-relaxed">Add someone to your team</p>
                  </div>
                </div>
              </button>
            </div>
          </section>
        )}

        {/* Show Your Team empty state if no people */}
        {peopleConversations.length === 0 && !loading && (
          <section className="nav-section">
            <div className="nav-section-header px-6 mb-4">
              <h2 className="nav-section-title text-xs font-bold text-gray-700 uppercase tracking-widest">Your Team</h2>
            </div>
            <div className="nav-section-items">
              {/* Add Team Member Action */}
              <button 
                onClick={handleAddPerson}
                className="group block w-full text-left px-6 py-4 hover:bg-white hover:shadow-sm transition-all duration-200 border-l-3 border-l-transparent hover:border-l-gray-200"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <span className="text-lg text-gray-400">👤</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-medium text-gray-500 group-hover:text-gray-700">
                        Add team member
                      </h3>
                    </div>
                    <p className="text-xs text-gray-400 truncate leading-relaxed">Add someone to your team</p>
                  </div>
                </div>
              </button>
            </div>
          </section>
        )}
      </nav>

      {/* Onboarding Modal */}
      <ManoOnboarding 
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        flowType={onboardingFlow}
      />
    </aside>
  )
}