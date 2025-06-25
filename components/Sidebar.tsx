'use client'

import Link from 'next/link'
import { useState, forwardRef, useImperativeHandle, useEffect } from 'react'
import { usePeople } from '@/lib/contexts/people-context'
import { useTopics } from '@/lib/hooks/useTopics'

interface SidebarProps {
  currentPersonId?: string
  currentTopicId?: string
}

export interface SidebarRef {
  toggleSidebar: () => void
}

export const Sidebar = forwardRef<SidebarRef, SidebarProps>(function Sidebar({ currentPersonId, currentTopicId }, ref) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { people } = usePeople()
  const { topics } = useTopics()

  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      console.log('📱 Screen check:', { width: window.innerWidth, isMobile: mobile })
      
      // On desktop, sidebar should always be "open" conceptually
      if (!mobile) {
        setIsOpen(true)
        console.log('🖥️ Desktop mode: Setting sidebar state to open')
      } else {
        console.log('📱 Mobile mode: Sidebar state controlled by user')
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const closeSidebar = () => {
    console.log('🔄 Close sidebar clicked', { 
      currentState: isOpen, 
      isMobile, 
      screenWidth: window.innerWidth 
    })
    
    if (isMobile) {
      setIsOpen(false)
      console.log('📱 Mobile: Sidebar closed')
    } else {
      console.log('🖥️ Desktop: Ignoring close (sidebar always visible)')
    }
  }

  const toggleSidebar = () => {
    console.log('🔄 Toggle sidebar clicked', { 
      currentState: isOpen, 
      isMobile, 
      screenWidth: window.innerWidth 
    })
    
    if (isMobile) {
      setIsOpen(!isOpen)
      console.log('📱 Mobile: Sidebar toggled to', !isOpen)
    } else {
      console.log('🖥️ Desktop: Ignoring toggle (sidebar always visible)')
    }
  }

  useImperativeHandle(ref, () => ({
    toggleSidebar
  }))

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

  return (
    <>
      {/* Mobile menu button - only visible on mobile */}
      <button 
        className="sidebar-toggle"
        onClick={toggleSidebar}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      {/* Mobile overlay - only active on mobile when sidebar is open */}
      <div 
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={closeSidebar}
      />
      
      {/* Sidebar - responsive, always visible on desktop, collapsible on mobile */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Debug info - remove this later */}
        <div style={{ 
          position: 'absolute', 
          top: '10px', 
          right: '10px', 
          background: 'red', 
          color: 'white', 
          padding: '4px', 
          fontSize: '10px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div>State: {isOpen ? 'OPEN' : 'CLOSED'} | Mobile: {isMobile ? 'YES' : 'NO'}</div>
          <div>Classes: "sidebar{isOpen ? ' open' : ''}"</div>
          <button 
            onClick={() => {
              console.log('🔄 RESET: Forcing state reset')
              setIsOpen(false)
              const mobile = window.innerWidth <= 768
              setIsMobile(mobile)
              console.log('🔄 RESET: New state', { isOpen: false, isMobile: mobile, width: window.innerWidth })
            }}
            style={{
              background: 'white',
              color: 'red',
              border: 'none',
              padding: '2px 4px',
              fontSize: '8px',
              cursor: 'pointer'
            }}
          >
            RESET
          </button>
        </div>
        
        <header className="sidebar-header">
          <div className="sidebar-header-content">
            <h1 className="app-title">🤲 Mano</h1>
            <p className="app-subtitle">Your management companion</p>
          </div>
          {/* Close button - only visible on mobile */}
          <button 
            className="sidebar-close"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            ×
          </button>
        </header>
        
        <nav className="sidebar-nav">
          <section className="nav-section">
            <h2 className="nav-section-title">Coach</h2>
            <div className="nav-section-items">
              <Link 
                href="/people/general" 
                className={`nav-item nav-item--special ${currentPersonId === 'general' ? 'active' : ''}`}
                onClick={closeSidebar}
              >
                <span className="nav-item-emoji">🤲</span>
                <div className="nav-item-content">
                  <span className="nav-item-name">General</span>
                  <span className="nav-item-subtitle">Management coaching</span>
                </div>
              </Link>
            </div>
          </section>
          
          <section className="nav-section">
            <div className="nav-section-header">
              <h2 className="nav-section-title">Your Team</h2>
              <Link href="/people/new" className="add-button" onClick={closeSidebar}>
                +
              </Link>
            </div>
            <div className="nav-section-items">
              {people.map(person => (
                <Link 
                  key={person.id} 
                  href={`/people/${person.id}`} 
                  className={`nav-item ${currentPersonId === person.id ? 'active' : ''}`}
                  onClick={closeSidebar}
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
                  <Link href="/people/new" className="nav-empty-link" onClick={closeSidebar}>
                    🤲 Add your first team member
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="nav-section">
            <div className="nav-section-header">
              <h2 className="nav-section-title">Topics</h2>
              <Link href="/topics/new" className="add-button" onClick={closeSidebar}>
                +
              </Link>
            </div>
            <div className="nav-section-items">
              {topics.map(topic => (
                <Link 
                  key={topic.id} 
                  href={`/topics/${topic.id}`} 
                  className={`nav-item ${currentTopicId === topic.id ? 'active' : ''}`}
                  onClick={closeSidebar}
                >
                  <span className="nav-item-emoji">💬</span>
                  <div className="nav-item-content">
                    <span className="nav-item-name">{topic.title}</span>
                    <span className="nav-item-subtitle">
                      {topic.participants.length} participants
                    </span>
                  </div>
                </Link>
              ))}
              
              {topics.length === 0 && (
                <div className="nav-empty">
                  <Link href="/topics/new" className="nav-empty-link" onClick={closeSidebar}>
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
            onClick={closeSidebar}
          >
            <span>🤲</span>
            <span>Add Person</span>
          </Link>
        </div>
      </aside>
    </>
  )
}) 