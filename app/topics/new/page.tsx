"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePeople } from '@/lib/contexts/people-context';
import { useTopics } from '@/lib/hooks/useTopics';

export default function NewTopicPage() {
  const [title, setTitle] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const { people } = usePeople();
  const { createTopic } = useTopics();
  const router = useRouter();

  const handleCreate = async () => {
    if (!title.trim()) return;

    setIsCreating(true);
    try {
      const topic = await createTopic(title.trim(), selectedParticipants);
      if (topic) {
        router.push(`/topics/${topic.id}`);
      }
    } catch (error) {
      console.error('Failed to create topic:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleParticipant = (personId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(personId)
        ? prev.filter(id => id !== personId)
        : [...prev, personId]
    );
  };

  const getRelationshipEmoji = (relationshipType: string) => {
    switch (relationshipType) {
      case 'direct_report': return '👥';
      case 'manager': return '👆';
      case 'stakeholder': return '🤝';
      case 'peer': return '👋';
      default: return '🙋';
    }
  };

  return (
    <div className="conversation-app">
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1 className="app-title">🤲 Mano</h1>
          <p className="app-subtitle">Your management companion</p>
        </header>
        
        <nav className="navigation">
          <section className="nav-section">
            <h2 className="nav-section-title">Coach</h2>
            <div className="nav-section-items">
              <Link href="/people/general" className="nav-item nav-item--special">
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
              <Link href="/people/new" className="add-person-button">
                +
              </Link>
            </div>
            <div className="nav-section-items">
              {people.map(person => (
                <Link key={person.id} href={`/people/${person.id}`} className="nav-item">
                  <span className="nav-item-emoji">
                    {getRelationshipEmoji(person.relationship_type || 'peer')}
                  </span>
                  <div className="nav-item-content">
                    <span className="nav-item-name">{person.name}</span>
                    <span className="nav-item-subtitle">
                      {person.role || person.relationship_type}
                    </span>
                  </div>
                </Link>
              ))}
              
              {people.length === 0 && (
                <div className="empty-people">
                  <Link href="/people/new" className="create-first-person">
                    🤲 Add your first team member
                  </Link>
                </div>
              )}
            </div>
          </section>
        </nav>
        
        <div className="nav-add-person">
          <Link href="/people/new" className="add-person-nav-button">
            <span>🤲</span>
            <span>Add Person</span>
          </Link>
        </div>
      </aside>

      <main className="main-content">
        <div className="new-topic-page">
          <div className="new-topic-container">
            <header className="conversation-header">
              <div className="conversation-header-content">
                <h1 className="conversation-title">💬 Create New Topic</h1>
                <p className="conversation-subtitle">Start a focused discussion</p>
              </div>
            </header>
            
            <div className="conversation-messages">
              <div className="form-group">
                <label htmlFor="title" className="form-label">Topic Title</label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q4 Strategy Planning"
                  className="topic-title-input"
                  disabled={isCreating}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Participants (Optional)</label>
                <p className="form-description">
                  Select team members who are relevant to this topic discussion
                </p>
                <div className="participants-list">
                  {people.map(person => (
                    <div key={person.id} className="participant-item">
                      <input
                        type="checkbox"
                        id={`person-${person.id}`}
                        checked={selectedParticipants.includes(person.id)}
                        onChange={() => toggleParticipant(person.id)}
                        disabled={isCreating}
                      />
                      <label htmlFor={`person-${person.id}`} className="participant-label">
                        <span className="participant-emoji">
                          {getRelationshipEmoji(person.relationship_type || 'peer')}
                        </span>
                        <div className="participant-info">
                          <span className="participant-name">{person.name}</span>
                          <span className="participant-role">{person.role || person.relationship_type}</span>
                        </div>
                      </label>
                    </div>
                  ))}
                  
                  {people.length === 0 && (
                    <div className="empty-participants">
                      <p>No team members added yet.</p>
                      <Link href="/people/new">Add your first team member</Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="conversation-input">
              <div className="form-actions">
                <button
                  onClick={handleCreate}
                  disabled={!title.trim() || isCreating}
                  className="create-button"
                >
                  {isCreating ? '🤲 Creating...' : '💬 Create Topic'}
                </button>
                <Link href="/people/general" className="cancel-button">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 