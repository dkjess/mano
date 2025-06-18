"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Person, Message } from '@/types/database';
import PersonSuggestion from '@/components/chat/person-suggestion';
import ProfileCompletionPrompt from '@/components/chat/profile-completion-prompt';
import { PersonDetectionResult } from '@/lib/person-detection';
import { createClient } from '@/lib/supabase/client';

interface StagedFile {
  file: File;
  content: string;
  id: string;
}

export default function PersonDetailPage() {
  const params = useParams();
  const personId = params.id as string;
  
  const [person, setPerson] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [retryData, setRetryData] = useState<{message: string, shouldShow: boolean} | null>(null);
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [processingFile, setProcessingFile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [personSuggestion, setPersonSuggestion] = useState<PersonDetectionResult | null>(null);
  const [profilePrompt, setProfilePrompt] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPersonAndMessages();
    fetchAllPeople();
  }, [personId]);

  // Set up real-time subscription for people changes
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel('people_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'people'
        }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPeople(prev => [...prev, payload.new as Person]);
          } else if (payload.eventType === 'UPDATE') {
            setPeople(prev => prev.map(p => 
              p.id === payload.new.id ? payload.new as Person : p
            ));
          } else if (payload.eventType === 'DELETE') {
            setPeople(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  useEffect(() => {
    updateSendButton();
  }, [newMessage, stagedFiles]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const updateSendButton = () => {
    const hasContent = newMessage.trim().length > 0 || stagedFiles.length > 0;
    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
      if (hasContent) {
        sendButton.classList.add('visible');
      } else {
        sendButton.classList.remove('visible');
      }
    }
  };

  const fetchPersonAndMessages = async () => {
    try {
      // Handle special case for 'general' assistant
      if (personId === 'general') {
        setPerson({
          id: 'general',
          user_id: '', 
          name: 'General',
          role: 'Your Management Coach',
          relationship_type: 'assistant',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // Fetch messages for general conversation
        const messagesResponse = await fetch(`/api/messages?person_id=general`);
        if (!messagesResponse.ok) {
          console.error('Failed to fetch general messages:', messagesResponse.status);
          setMessages([]);
        } else {
          const messagesData = await messagesResponse.json();
          setMessages(messagesData.messages || []);
        }
      } else {
        // Fetch person details
        const peopleResponse = await fetch('/api/people');
        const peopleData = await peopleResponse.json();
        const foundPerson = peopleData.people?.find((p: Person) => p.id === personId);
        
        if (!foundPerson) {
          console.error('Person not found');
          return;
        }
        
        setPerson(foundPerson);

        // Fetch messages
        const messagesResponse = await fetch(`/api/messages?person_id=${personId}`);
        const messagesData = await messagesResponse.json();
        setMessages(messagesData.messages || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPeople = async () => {
    try {
      const response = await fetch('/api/people');
      const data = await response.json();
      setPeople(data.people || []);
    } catch (error) {
      console.error('Error fetching people:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent, retryMessage?: string) => {
    e.preventDefault();
    const messageText = retryMessage || newMessage.trim();
    
    // Don't send if no message and no files
    if (!messageText && stagedFiles.length === 0) return;
    
    if (sending) return;

    setSending(true);
    if (!retryMessage) {
      setNewMessage('');
      if (typingAreaRef.current) {
        typingAreaRef.current.textContent = '';
      }
    }
    setRetryData(null);

    try {
      // Combine message with file contents
      let combinedMessage = messageText;
      
      if (stagedFiles.length > 0) {
        const fileContents = stagedFiles.map(staged => 
          `📎 **${staged.file.name}** (${(staged.file.size / 1024).toFixed(1)}KB)\n\n${staged.content}`
        ).join('\n\n---\n\n');
        
        combinedMessage = messageText 
          ? `${messageText}\n\n${fileContents}`
          : fileContents;
      }

      // Use regular chat endpoint to get person detection results
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: personId,
          message: combinedMessage
        })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      
      // Add messages to the conversation
      const userMessage: Message = {
        id: data.userMessage.id,
        person_id: personId,
        content: combinedMessage,
        role: 'user',
        created_at: data.userMessage.created_at,
        updated_at: data.userMessage.updated_at
      };

      const assistantMessage: Message = {
        id: data.assistantMessage.id,
        person_id: personId,
        content: data.assistantMessage.content,
        role: 'assistant',
        created_at: data.assistantMessage.created_at,
        updated_at: data.assistantMessage.updated_at
      };

      // Add both messages to state
      setMessages(prev => [...prev, userMessage, assistantMessage]);
      
      // Clear staged files after successful send
      setStagedFiles([]);

      // Handle person detection
      if (data.personDetection) {
        setPersonSuggestion(data.personDetection);
      }

      // Handle profile completion prompt
      if (data.profilePrompt) {
        setProfilePrompt(data.profilePrompt);
      }

      // Handle retry logic if needed
      if (data.shouldRetry) {
        setRetryData({ message: messageText, shouldShow: true });
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setRetryData({ message: messageText, shouldShow: true });
    } finally {
      setSending(false);
    }
  };

  const processFile = async (file: File): Promise<string> => {
    if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      return await file.text();
    } else if (file.type === 'application/json') {
      return await file.text();
    } else {
      return `[File: ${file.name} (${file.type || 'unknown type'})]`;
    }
  };

  const handleFileUpload = async (files: FileList) => {
    setProcessingFile(true);
    const newStagedFiles: StagedFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Skip if file is too large (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        console.warn(`File ${file.name} is too large (max 5MB)`);
        continue;
      }
      
      try {
        const content = await processFile(file);
        newStagedFiles.push({
          file,
          content,
          id: `${file.name}-${Date.now()}-${Math.random()}`
        });
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    }
    
    setStagedFiles(prev => [...prev, ...newStagedFiles]);
    setProcessingFile(false);
  };

  const removeFile = (fileId: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.md')) return '📝';
    if (fileName.endsWith('.txt')) return '📄';
    if (fileName.endsWith('.json')) return '🔧';
    if (fileName.endsWith('.csv')) return '📊';
    return '📎';
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

  const getRelationshipLabel = (relationshipType: string) => {
    switch (relationshipType) {
      case 'direct_report': return 'Direct Report';
      case 'manager': return 'Manager';
      case 'stakeholder': return 'Stakeholder';
      case 'peer': return 'Peer';
      default: return relationshipType;
    }
  };

  const handleTypingInput = (e: React.FormEvent<HTMLDivElement>) => {
    setNewMessage(e.currentTarget.textContent || '');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim() || stagedFiles.length > 0) {
        sendMessage(e);
      }
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

  const handlePersonAdded = (newPerson: Person) => {
    // Refresh people list
    setPeople(prev => [...prev, newPerson]);
    
    // Clear suggestion
    setPersonSuggestion(null);
    
    // Optional: Show success message
    console.log(`Added ${newPerson.name} to your team!`);
  };

  const handleDismissSuggestion = () => {
    setPersonSuggestion(null);
  };

  const handleProfileComplete = (field: string, value: string) => {
    setProfilePrompt(null);
    
    // Update the person in our local state if it matches
    if (person && person.id === personId) {
      setPerson(prev => prev ? { ...prev, [field]: value } : prev);
    }
    
    // Optional: Show success message
    console.log(`Updated ${field}: ${value}`);
  };

  const handleProfileDismiss = () => {
    setProfilePrompt(null);
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-emoji">🤲</div>
        <div className="loading-text">Loading conversation...</div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="empty-state">
        <div className="empty-state-emoji">🤷</div>
        <h3 className="empty-state-title">Person not found</h3>
        <Link href="/people" className="add-person-button">
          👈 Back to People
        </Link>
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
              <Link 
                href="/people/general" 
                className={`nav-item nav-item--special ${personId === 'general' ? 'active' : ''}`}
                onClick={closeMobileMenu}
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
            <h2 className="nav-section-title">Your Team</h2>
            <div className="nav-section-items">
              {people.map(p => (
                <Link 
                  key={p.id} 
                  href={`/people/${p.id}`} 
                  className={`nav-item ${p.id === person.id ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  <span className="nav-item-emoji">
                    {getRelationshipEmoji(p.relationship_type || 'peer')}
                  </span>
                  <div className="nav-item-content">
                    <span className="nav-item-name">{p.name}</span>
                    <span className="nav-item-subtitle">
                      {p.role || getRelationshipLabel(p.relationship_type || 'peer')}
                    </span>
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
        <div className="conversation-container">
          <header className="conversation-header">
            <div className="conversation-header-content">
              <h1 className="conversation-title">
                {personId === 'general' ? '🤲' : getRelationshipEmoji(person.relationship_type || 'peer')} {person.name}
              </h1>
              <p className="conversation-subtitle">
                {personId === 'general' 
                  ? 'Management coaching and strategic advice' 
                  : person.role || getRelationshipLabel(person.relationship_type || 'peer')
                }
              </p>
            </div>
            <button 
              className="mobile-menu-button"
              onClick={toggleMobileMenu}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          </header>

          <div className="conversation-messages">
            {messages.length === 0 && !sending ? (
              <div className="empty-state">
                <div className="empty-state-emoji">💬</div>
                <h3 className="empty-state-title">Start the conversation</h3>
                <p className="empty-state-subtitle">
                  {personId === 'general' 
                    ? 'Ask for management advice, discuss strategy, or work through challenges'
                    : `Begin your conversation with ${person.name}`
                  }
                </p>
              </div>
            ) : (
              <div className="message-group">
                {messages.map((message, index) => (
                  <div key={message.id || index}>
                    {message.role === 'user' ? (
                      <div className="message-user">
                        <div className="message-user-label">You</div>
                        <div className="message-user-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <div className="message-assistant">
                        <div className="message-assistant-emoji">
                          {personId === 'general' ? '🤲' : getRelationshipEmoji(person.relationship_type || 'peer')}
                        </div>
                        <div className="message-assistant-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                    <div className="message-timestamp">
                      {new Date(message.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
                
                {sending && (
                  <div className="message-loading">
                    <div className="message-loading-emoji">
                      {personId === 'general' ? '🤲' : getRelationshipEmoji(person.relationship_type || 'peer')}
                    </div>
                    <div className="message-loading-dots">
                      Thinking...
                    </div>
                  </div>
                )}

                {personSuggestion && (
                  <PersonSuggestion
                    detectedPeople={personSuggestion.detectedPeople}
                    onPersonAdded={handlePersonAdded}
                    onDismiss={handleDismissSuggestion}
                  />
                )}

                {profilePrompt && person && (
                  <ProfileCompletionPrompt
                    personId={person.id}
                    personName={person.name}
                    prompt={profilePrompt}
                    onComplete={handleProfileComplete}
                    onDismiss={handleProfileDismiss}
                  />
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={`conversation-input ${mobileMenuOpen ? 'mobile-pushed' : ''}`}>
            <div className="input-container">
              <div
                ref={typingAreaRef}
                contentEditable
                onInput={handleTypingInput}
                onKeyDown={handleKeyDown}
                className="input-field"
                style={{ minHeight: '48px' }}
                suppressContentEditableWarning={true}
              />
              {newMessage.trim().length === 0 && stagedFiles.length === 0 && (
                <div style={{
                  position: 'absolute',
                  top: 'var(--space-md)',
                  left: 0,
                  color: 'var(--color-gray-400)',
                  fontStyle: 'italic',
                  pointerEvents: 'none',
                  fontFamily: 'var(--font-secondary)',
                  fontSize: '16px'
                }}>
                  Continue the conversation...
                </div>
              )}
            </div>
            
            <button
              id="sendButton"
              onClick={sendMessage}
              disabled={sending}
              className="send-button"
            >
              {sending ? '⏳' : '→'}
            </button>
          </div>

          {retryData?.shouldShow && (
            <div style={{
              position: 'fixed',
              bottom: '120px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--color-white)',
              border: '1px solid var(--color-gray-200)',
              borderRadius: 'var(--space-sm)',
              padding: 'var(--space-md) var(--space-lg)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              fontFamily: 'var(--font-secondary)',
              fontSize: '14px'
            }}>
              <span>Message failed to send</span>
              <button
                onClick={(e) => sendMessage(e, retryData.message)}
                style={{
                  background: 'var(--color-black)',
                  color: 'var(--color-white)',
                  border: 'none',
                  padding: 'var(--space-sm) var(--space-md)',
                  borderRadius: 'var(--space-sm)',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Retry
              </button>
              <button
                onClick={() => setRetryData(null)}
                style={{
                  background: 'transparent',
                  color: 'var(--color-gray-500)',
                  border: 'none',
                  padding: 'var(--space-sm)',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}