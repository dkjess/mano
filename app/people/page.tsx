"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Person } from '@/types/database';

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkUser();
    fetchPeople();
  }, []);

  const checkUser = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchPeople = async () => {
    try {
      const response = await fetch('/api/people');
      const data = await response.json();
      setPeople(data.people || []);
    } catch (error) {
      console.error('Error fetching people:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const filteredPeople = people.filter(person =>
    person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (person.role && person.role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRelationshipEmoji = (relationshipType: string) => {
    switch (relationshipType) {
      case 'direct_report': return '👥';
      case 'manager': return '👆';
      case 'stakeholder': return '🤝';
      case 'peer': return '👋';
      default: return '🙋';
    }
  };

  const getRelationshipLabel = (relationshipType: string) => {
    switch (relationshipType) {
      case 'direct_report': return 'Direct Report';
      case 'manager': return 'Manager';
      case 'stakeholder': return 'Stakeholder';
      case 'peer': return 'Peer';
      default: return relationshipType;
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-emoji">🤲</div>
        <div className="loading-text">Loading your people...</div>
      </div>
    );
  }

  return (
    <div className="conversation-app">
      {/* Mobile overlay */}
      <div 
        className={`mobile-overlay ${mobileMenuOpen ? 'active' : ''}`}
        onClick={closeMobileMenu}
      />
      
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <header className="sidebar-header">
          <h1 className="app-title">🤲 Mano</h1>
          <p className="app-subtitle">Your management companion</p>
        </header>
        
        <nav className="navigation">
          <section className="nav-section">
            <h2 className="nav-section-title">Coach</h2>
            <div className="nav-section-items">
              <Link href="/people/general" className="nav-item nav-item--special" onClick={closeMobileMenu}>
                <span className="nav-item-emoji">🤲</span>
                <div className="nav-item-content">
                  <span className="nav-item-name">General</span>
                  <span className="nav-item-subtitle">Management coaching</span>
                </div>
              </Link>
            </div>
          </section>
          
          <section className="nav-section">
            <h2 className="nav-section-title">Your Team</h2>
            <div className="nav-section-items">
              {people.map(person => (
                <Link key={person.id} href={`/people/${person.id}`} className="nav-item" onClick={closeMobileMenu}>
                  <span className="nav-item-emoji">
                    {getRelationshipEmoji(person.relationship_type || 'peer')}
                  </span>
                  <div className="nav-item-content">
                    <span className="nav-item-name">{person.name}</span>
                    <span className="nav-item-subtitle">{person.role || getRelationshipLabel(person.relationship_type || 'peer')}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </nav>
        
        <div className="nav-add-person">
          <Link href="/people/new" className="add-person-nav-button" onClick={closeMobileMenu}>
            <span>🤲</span>
            <span>Add Person</span>
          </Link>
        </div>
      </aside>

      <main className={`main-content ${mobileMenuOpen ? 'mobile-pushed' : ''}`}>
        <div className={`people-container ${mobileMenuOpen ? 'mobile-pushed' : ''}`}>
          <header className="people-header">
            <div className="conversation-header-content">
              <h1 className="people-title">👋 Your People</h1>
              <p className="people-subtitle">Manage relationships with your team and stakeholders</p>
            </div>
            
            <button 
              className="mobile-menu-button"
              onClick={toggleMobileMenu}
              aria-label="Toggle menu"
            >
              ☰
            </button>
            
            {user && (
              <div style={{ position: 'absolute', top: 'var(--space-2xl)', right: 'var(--space-2xl)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                {user.user_metadata?.avatar_url && (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="Profile"
                    style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                  />
                )}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-gray-900)', fontFamily: 'var(--font-secondary)' }}>
                    {user.user_metadata?.full_name || user.email}
                  </div>
                  {user.user_metadata?.full_name && (
                    <div style={{ fontSize: '12px', color: 'var(--color-gray-500)', fontFamily: 'var(--font-secondary)' }}>{user.email}</div>
                  )}
                </div>
                <button 
                  onClick={handleLogout}
                  style={{ 
                    fontFamily: 'var(--font-secondary)', 
                    fontSize: '13px', 
                    fontWeight: '500',
                    color: 'var(--color-gray-600)',
                    padding: 'var(--space-sm) var(--space-md)',
                    border: '1px solid var(--color-gray-200)',
                    borderRadius: 'var(--space-sm)',
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.background = 'var(--color-gray-50)';
                    (e.target as HTMLElement).style.borderColor = 'var(--color-gray-300)';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.background = 'transparent';
                    (e.target as HTMLElement).style.borderColor = 'var(--color-gray-200)';
                  }}
                >
                  👋 Sign Out
                </button>
              </div>
            )}
          </header>

          <div className="people-search">
            <input
              type="text"
              placeholder="🔍 Search people..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredPeople.length === 0 && !searchTerm ? (
            <div className="empty-state">
              <div className="empty-state-emoji">🤲</div>
              <h3 className="empty-state-title">No people yet</h3>
              <p className="empty-state-subtitle">
                Add your first team member or stakeholder to get started
              </p>
              <Link href="/people/new" className="add-person-button">
                🤲 Add Your First Person
              </Link>
            </div>
          ) : searchTerm && filteredPeople.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-emoji">🔍</div>
              <h3 className="empty-state-title">No people found</h3>
              <p className="empty-state-subtitle">
                Try adjusting your search terms
              </p>
            </div>
          ) : (
            <div>
              {/* General Management Assistant - Always show at top when not searching */}
              {!searchTerm && (
                <Link href="/people/general" className="person-item person-item--special">
                  <div className="person-content">
                    <div className="person-emoji">🤲</div>
                    <div className="person-details">
                      <div className="person-name">General</div>
                      <div className="person-role">Management coaching and strategic advice</div>
                    </div>
                    <div className="person-meta">
                      <div>Management Assistant</div>
                      <div>Always available</div>
                    </div>
                  </div>
                </Link>
              )}

              {/* Team Members */}
              {filteredPeople.map(person => (
                <Link key={person.id} href={`/people/${person.id}`} className="person-item">
                  <div className="person-content">
                    <div className="person-emoji">
                      {getRelationshipEmoji(person.relationship_type || 'peer')}
                    </div>
                    <div className="person-details">
                      <div className="person-name">{person.name}</div>
                      <div className="person-role">
                        {person.role || getRelationshipLabel(person.relationship_type || 'peer')}
                      </div>
                    </div>
                    <div className="person-meta">
                      <div>{getRelationshipLabel(person.relationship_type || 'peer')}</div>
                      <div>{new Date(person.updated_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}


        </div>
      </main>
    </div>
  );
}