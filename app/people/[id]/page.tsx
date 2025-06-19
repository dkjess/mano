"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Person, Message } from '@/types/database';
import PersonSuggestion from '@/components/chat/person-suggestion';
import ProfileCompletionPrompt, { PersonSetupChatHeader } from '@/components/chat/profile-completion-prompt';
import ProfileEditForm from '@/components/profile-edit-form';
import PersonEditMenu from '@/components/person-edit-menu';
import { PersonDetectionResult } from '@/lib/person-detection';
import { createClient } from '@/lib/supabase/client';
import { usePeople } from '@/lib/contexts/people-context';
import { useMessages } from '@/lib/hooks/use-messages';
import { EnhancedChatInput } from '@/components/chat/EnhancedChatInput';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { useStreamingResponse } from '@/lib/hooks/useStreamingResponse';
import { useFileDropZone, DroppedFile } from '@/lib/hooks/useFileDropZone';
import { ChatDropZone } from '@/components/chat/ChatDropZone';
import { MessageFile } from '@/types/database';
import { useTopics } from '@/lib/hooks/useTopics';



interface StagedFile {
  file: File;
  content: string;
  id: string;
}

export default function PersonDetailPage() {
  const params = useParams();
  const personId = params.id as string;
  
  // Use context and hooks instead of local state
  const { people, getPerson, updatePerson, addPerson, deletePerson } = usePeople();
  const { messages, isLoading: messagesLoading, addMessage } = useMessages(personId);
  const { topics } = useTopics();

  // Add streaming support
  const {
    streamingMessage,
    startStreaming,
    clearStreamingMessage
  } = useStreamingResponse();

  // Add file drop zone support
  const {
    files,
    isDragActive,
    fileInputRef,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
    removeFile: removeDroppedFile,
    clearFiles,
    openFileDialog
  } = useFileDropZone();
  
  const [person, setPerson] = useState<Person | null>(null);
  const [newMessage, setNewMessage] = useState(''); // Keep for retry functionality
  const [loading, setLoading] = useState(false); // Only for initial person setup
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [retryData, setRetryData] = useState<{message: string, shouldShow: boolean} | null>(null);
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [processingFile, setProcessingFile] = useState(false);
  const [personSuggestion, setPersonSuggestion] = useState<PersonDetectionResult | null>(null);
  const [profilePrompt, setProfilePrompt] = useState<any>(null);
  const [showProfileEditForm, setShowProfileEditForm] = useState(false);
  const [showPersonEditMenu, setShowPersonEditMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingAreaRef = useRef<HTMLDivElement>(null); // Keep for retry functionality

  // Reset component state when personId changes
  useEffect(() => {
    // Clear any pending operations
    setSending(false);
    setRetryData(null);
    setShowMarkdownHelp(false);
    setStagedFiles([]);
    setProcessingFile(false);
    setPersonSuggestion(null);
    setProfilePrompt(null);
    setShowProfileEditForm(false);
    setShowPersonEditMenu(false);
    clearStreamingMessage();
    clearFiles();
  }, [personId, clearStreamingMessage, clearFiles]);

  // Setup person when personId or people change
  useEffect(() => {
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
      setLoading(false);
    } else if (people.length > 0) {
      // Find the specific person from context
      const foundPerson = getPerson(personId);
      if (foundPerson) {
        setPerson(foundPerson);
      } else {
        console.error('Person not found');
      }
      setLoading(false);
    }
  }, [personId, people, getPerson]);

  // Auto-scroll to bottom when messages load or change
  useEffect(() => {
    // Small delay to ensure DOM is updated
    const scrollTimer = setTimeout(() => {
      scrollToBottom();
    }, 100);

    return () => clearTimeout(scrollTimer);
  }, [messages, messagesLoading]);

  // Auto-scroll during streaming and when sending
  useEffect(() => {
    scrollToBottom();
  }, [sending, streamingMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Enhanced send message function with real API streaming
  const handleSendMessage = async (content: string, dropzoneFiles?: DroppedFile[]) => {
    // Don't send if already processing
    if (sending || streamingMessage?.isStreaming) return;

    setSending(true);
    setRetryData(null);

    try {
      // Combine message with file contents from both old and new systems
      let combinedMessage = content;
      
      // Handle legacy staged files
      if (stagedFiles.length > 0) {
        const fileContents = stagedFiles.map(staged => 
          `📎 **${staged.file.name}** (${(staged.file.size / 1024).toFixed(1)}KB)\n\n${staged.content}`
        ).join('\n\n---\n\n');
        
        combinedMessage = content 
          ? `${content}\n\n${fileContents}`
          : fileContents;
      }

      // Convert dropzone files to clean MessageFile format (don't add to message content)
      const messageFiles = dropzoneFiles ? convertDroppedFilesToMessageFiles(dropzoneFiles) : [];

      // For AI context, we still need file contents, but we'll process them separately
      let aiContextFiles = '';
      if (dropzoneFiles && dropzoneFiles.length > 0) {
        const dropzoneContents = await Promise.all(
          dropzoneFiles.map(async (droppedFile) => {
            const content = droppedFile.type === 'image' 
              ? `📷 **${droppedFile.file.name}** (Image, ${(droppedFile.file.size / 1024).toFixed(1)}KB)`
              : await processFile(droppedFile.file);
            return `${getFileIcon(droppedFile.file.name)} **${droppedFile.file.name}** (${(droppedFile.file.size / 1024).toFixed(1)}KB)\n\n${content}`;
          })
        );
        aiContextFiles = '\n\n' + dropzoneContents.join('\n\n---\n\n');
      }

      // Create clean user message with separate text and files
      const userMessage: Message & { files?: MessageFile[] } = {
        id: `user-${Date.now()}`,
        person_id: personId,
        content: content, // Only the user's actual message text
        is_user: true,
        role: 'user', // Legacy field for compatibility
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        files: messageFiles // Clean file attachments
      };
      addMessage(userMessage as Message);

      // Clear both file systems after sending
      setStagedFiles([]);
      clearFiles();

      // Call the real streaming API with combined message for AI context
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: personId,
          message: combinedMessage + aiContextFiles // Include file context for AI
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Start streaming with the real API response
      const streamingId = `streaming-${Date.now()}`;
      
      await startStreaming(streamingId, async () => {
        return response.body!;
      });

    } catch (error) {
      console.error('Error sending message:', error);
      setRetryData({ message: content, shouldShow: true });
    } finally {
      setSending(false);
    }
  };

  // Keep the old sendMessage for retry functionality
  const sendMessage = async (e: React.FormEvent, retryMessage?: string) => {
    e.preventDefault();
    const messageText = retryMessage || newMessage.trim();
    
    if (!messageText && stagedFiles.length === 0) return;
    
    await handleSendMessage(messageText);
    
    if (!retryMessage) {
      setNewMessage('');
      if (typingAreaRef.current) {
        typingAreaRef.current.textContent = '';
      }
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

  const getFileIconByType = (type: DroppedFile['type']): string => {
    switch (type) {
      case 'image': return '🖼️';
      case 'transcript': return '📝';
      case 'document': return '📄';
      default: return '📎';
    }
  };

  const convertDroppedFilesToMessageFiles = (droppedFiles: DroppedFile[]): MessageFile[] => {
    return droppedFiles
      .filter(file => file.type !== 'unknown') // Filter out unknown types
      .map(file => ({
        id: file.id,
        name: file.file.name,
        type: file.type as 'image' | 'transcript' | 'document', // Type assertion since we filtered unknown
        size: file.file.size,
        icon: getFileIconByType(file.type)
      }));
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
    // Add person to context
    addPerson(newPerson);
    
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

  // Check if this is a profile setup conversation
  const isProfileSetupConversation = () => {
    if (messages.length === 0 || personId === 'general') return false;
    
    const firstMessage = messages[0];
    return firstMessage.role === 'assistant' && (
      firstMessage.content.includes("Let's set up their profile") ||
      (firstMessage.content.includes("What's") && firstMessage.content.includes("role"))
    );
  };

  // Handle profile edit form
  const handleEditProfile = () => {
    setShowProfileEditForm(true);
  };

  const handleProfileSaved = (updatedPerson: Person) => {
    setPerson(updatedPerson);
    setShowProfileEditForm(false);
    
    // Update the person in the context
    updatePerson(updatedPerson);
  };

  const handleCloseProfileForm = () => {
    setShowProfileEditForm(false);
  };

  // Handle person edit menu
  const handleOpenPersonEditMenu = () => {
    setShowPersonEditMenu(true);
  };

  const handleClosePersonEditMenu = () => {
    setShowPersonEditMenu(false);
  };

  const handlePersonUpdated = (updatedPerson: Person) => {
    setPerson(updatedPerson);
    
    // Update the person in the context
    updatePerson(updatedPerson);
  };

  const handlePersonDeleted = () => {
    // Remove the person from the context so they disappear from the sidebar immediately
    if (person) {
      deletePerson(person.id);
    }
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
        <Link href="/people/general" className="add-person-button">
          👈 Back to General Chat
        </Link>
      </div>
    );
  }

  return (
    <div className="conversation-app">
      {/* Mobile overlay */}
      <div 
        className={`mobile-overlay ${mobileMenuOpen ? 'active' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
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
                onClick={() => setMobileMenuOpen(false)}
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
              <Link href="/people/new" className="add-person-button">
                +
              </Link>
            </div>
            <div className="nav-section-items">
              {people.map(person => (
                <Link 
                  key={person.id} 
                  href={`/people/${person.id}`} 
                  className={`nav-item ${personId === person.id ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
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
                <div className="empty-people">
                  <Link href="/people/new" className="create-first-person" onClick={() => setMobileMenuOpen(false)}>
                    🤲 Add your first team member
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="nav-section">
            <div className="nav-section-header">
              <h2 className="nav-section-title">Topics</h2>
              <Link href="/topics/new" className="add-topic-button">
                +
              </Link>
            </div>
            <div className="nav-section-items">
              {topics.map(topic => (
                <Link 
                  key={topic.id} 
                  href={`/topics/${topic.id}`} 
                  className="nav-item"
                  onClick={() => setMobileMenuOpen(false)}
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
                <div className="empty-topics">
                  <Link href="/topics/new" className="create-first-topic" onClick={() => setMobileMenuOpen(false)}>
                    💬 Create your first topic
                  </Link>
                </div>
              )}
            </div>
          </section>
        </nav>
        
        <div className="nav-add-person">
          <Link 
            href="/people/new" 
            className="add-person-nav-button" 
            onClick={() => setMobileMenuOpen(false)}
          >
            <span>🤲</span>
            <span>Add Person</span>
          </Link>
        </div>
      </aside>

      <main className={`main-content ${mobileMenuOpen ? 'mobile-pushed' : ''}`}>
        <ChatDropZone
          isDragActive={isDragActive}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          fileInputRef={fileInputRef}
          onFileInputChange={handleFileInputChange}
          disabled={sending || streamingMessage?.isStreaming}
        >
          <div className="conversation-container">
          {isProfileSetupConversation() && person && personId !== 'general' ? (
            <PersonSetupChatHeader
              person={person}
              chatId={personId}
              onEditProfile={handleEditProfile}
            />
          ) : (
            <header className="conversation-header">
              <div 
                className="conversation-header-content"
                onClick={personId !== 'general' ? handleOpenPersonEditMenu : undefined}
                style={{ 
                  cursor: personId !== 'general' ? 'pointer' : 'default'
                }}
                title={personId !== 'general' ? 'Click to edit profile' : undefined}
              >
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
          )}

          <div className="conversation-messages">
            {/* Loading state for messages */}
            {messagesLoading && messages.length === 0 && (
              <div className="loading-state">
                <div className="loading-emoji">🤲</div>
                <div className="loading-text">Loading conversation...</div>
              </div>
            )}

            {messages.length === 0 && !sending && !streamingMessage && !messagesLoading ? (
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
                {/* Render existing messages with new MessageBubble component */}
                {messages.map((message, index) => (
                  <MessageBubble
                    key={message.id || index}
                    content={message.content}
                    isUser={message.is_user ?? (message.role === 'user')}
                    files={(message as any).files || []} // Pass files if they exist
                    timestamp={new Date(message.created_at)}
                    avatar={message.is_user ?? (message.role === 'user') ? undefined : 
                      (personId === 'general' ? '🤲' : getRelationshipEmoji(person.relationship_type || 'peer'))
                    }
                  />
                ))}
                
                {/* Show loading state when sending */}
                {sending && (
                  <MessageBubble
                    content=""
                    isUser={false}
                    isLoading={true}
                    avatar={personId === 'general' ? '🤲' : getRelationshipEmoji(person.relationship_type || 'peer')}
                  />
                )}

                {/* Show streaming message */}
                {streamingMessage && (
                  <MessageBubble
                    content={streamingMessage.content}
                    isUser={false}
                    isStreaming={streamingMessage.isStreaming}
                    timestamp={new Date()}
                    avatar={personId === 'general' ? '🤲' : getRelationshipEmoji(person.relationship_type || 'peer')}
                    onComplete={() => {
                      // When streaming completes, add the final message to permanent state
                      const finalMessage: Message = {
                        id: `assistant-${Date.now()}`,
                        person_id: personId,
                        content: streamingMessage.content,
                        is_user: false,
                        role: 'assistant', // Legacy field for compatibility
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      };
                      addMessage(finalMessage);
                      clearStreamingMessage();
                    }}
                  />
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

          {/* Enhanced Chat Input */}
          <div className={mobileMenuOpen ? 'mobile-pushed' : ''}>
            <EnhancedChatInput
              onSend={handleSendMessage}
              disabled={sending || streamingMessage?.isStreaming}
              placeholder={personId === 'general' 
                ? 'Ask for management guidance...' 
                : `Message ${person?.name || 'Mano'}...`
              }
              files={files}
              onRemoveFile={removeDroppedFile}
              onOpenFileDialog={openFileDialog}
            />
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

          {/* Profile Edit Form Modal */}
          {showProfileEditForm && person && (
            <ProfileEditForm
              person={person}
              onSave={handleProfileSaved}
              onClose={handleCloseProfileForm}
            />
          )}

          {/* Person Edit Menu Modal */}
          {showPersonEditMenu && person && personId !== 'general' && (
            <PersonEditMenu
              person={person}
              chatId={personId}
              onClose={handleClosePersonEditMenu}
              onPersonUpdated={handlePersonUpdated}
              onPersonDeleted={handlePersonDeleted}
            />
          )}
          </div>
        </ChatDropZone>
      </main>
    </div>
  );
}