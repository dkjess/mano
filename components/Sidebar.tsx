'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePeople } from '@/lib/contexts/people-context'
import { useTopics } from '@/lib/hooks/useTopics'
import { getOrCreateGeneralTopicClient } from '@/lib/general-topic'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  currentPersonId?: string
  currentTopicId?: string
}

export function Sidebar({ currentPersonId, currentTopicId }: SidebarProps) {
  const { people } = usePeople()
  const { topics } = useTopics()
  const [generalTopicId, setGeneralTopicId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Get the General topic ID for the current user
  useEffect(() => {
    const loadGeneralTopic = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const generalTopic = await getOrCreateGeneralTopicClient(user.id)
          setGeneralTopicId(generalTopic.id)
        }
      } catch (error) {
        console.error('Error loading General topic:', error)
      } finally {
        setLoading(false)
      }
    }

    loadGeneralTopic()
  }, [])

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

  // Check if we're currently on the General topic
  const isOnGeneralTopic = () => {
    return currentTopicId === generalTopicId || currentPersonId === 'general'
  }

  // Filter out the General topic from the regular topics list since it's shown in Coach section
  const regularTopics = topics.filter(topic => 
    topic.title !== 'General' && topic.id !== generalTopicId
  )

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="sidebar-header-content">
          <h1 className="app-title">🤲 Mano</h1>
          <p className="app-subtitle">Your management companion</p>
        </div>
      </header>
        
      <nav className="sidebar-nav">
        <section className="nav-section">
          <h2 className="nav-section-title">Coach</h2>
          <div className="nav-section-items">
            {loading ? (
              <div className="nav-item nav-item--special nav-item--loading">
                <span className="nav-item-emoji">🤲</span>
                <div className="nav-item-content">
                  <span className="nav-item-name">General</span>
                  <span className="nav-item-subtitle">Loading...</span>
                </div>
              </div>
            ) : generalTopicId ? (
              <Link 
                href={`/topics/${generalTopicId}`}
                className={`nav-item nav-item--special ${isOnGeneralTopic() ? 'active' : ''}`}
              >
                <span className="nav-item-emoji">🤲</span>
                <div className="nav-item-content">
                  <span className="nav-item-name">General</span>
                  <span className="nav-item-subtitle">Management coaching</span>
                </div>
              </Link>
            ) : (
              <Link 
                href="/people/general" 
                className={`nav-item nav-item--special ${currentPersonId === 'general' ? 'active' : ''}`}
              >
                <span className="nav-item-emoji">🤲</span>
                <div className="nav-item-content">
                  <span className="nav-item-name">General</span>
                  <span className="nav-item-subtitle">Management coaching</span>
                </div>
              </Link>
            )}
          </div>
        </section>
        
        <section className="nav-section">
          <div className="nav-section-header">
            <h2 className="nav-section-title">Your Team</h2>
            <Link href="/people/new" className="add-button">
              +
            </Link>
          </div>
          <div className="nav-section-items">
            {people.map(person => (
              <Link 
                key={person.id} 
                href={`/people/${person.id}`} 
                className={`nav-item ${currentPersonId === person.id ? 'active' : ''}`}
              >
                <span className="nav-item-emoji">
                  {getRelationshipEmoji(person.relationship_type || 'peer')}
                </span>
                <div className="nav-item-content">
                  <span className="nav-item-name">{person.name}</span>
                  <span className="nav-item-subtitle">
                    {person.role || getRelationshipLabel(person.relationship_type || 'peer')}
                  </span>
                </div>
              </Link>
            ))}
            
            {people.length === 0 && (
              <div className="nav-empty">
                <Link href="/people/new" className="nav-empty-link">
                  🤲 Add your first team member
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="nav-section">
          <div className="nav-section-header">
            <h2 className="nav-section-title">Topics</h2>
            <Link href="/topics/new" className="add-button">
              +
            </Link>
          </div>
          <div className="nav-section-items">
            {regularTopics.map(topic => (
              <Link 
                key={topic.id} 
                href={`/topics/${topic.id}`} 
                className={`nav-item ${currentTopicId === topic.id ? 'active' : ''}`}
              >
                <span className="nav-item-emoji">💬</span>
                <div className="nav-item-content">
                  <span className="nav-item-name">{topic.title}</span>
                  <span className="nav-item-subtitle">
                    {topic.participants.length === 0 
                      ? 'No participants' 
                      : `${topic.participants.length} participant${topic.participants.length === 1 ? '' : 's'}`
                    }
                  </span>
                </div>
              </Link>
            ))}
            
            {regularTopics.length === 0 && (
              <div className="nav-empty">
                <Link href="/topics/new" className="nav-empty-link">
                  💬 Create your first topic
                </Link>
              </div>
            )}
          </div>
        </section>
      </nav>
      
      <div className="sidebar-footer">
        <Link 
          href="/people/new" 
          className="sidebar-footer-button"
        >
          <span>🤲</span>
          <span>Add Person</span>
        </Link>
      </div>
    </aside>
  )
} 