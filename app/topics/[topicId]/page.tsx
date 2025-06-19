"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { usePeople } from '@/lib/contexts/people-context';
import { useTopicConversation } from '@/lib/hooks/useTopicConversation';
import { useTopics } from '@/lib/hooks/useTopics';
import { EnhancedChatInput } from '@/components/chat/EnhancedChatInput';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { useFileDropZone } from '@/lib/hooks/useFileDropZone';
import { ChatDropZone } from '@/components/chat/ChatDropZone';
import { useStreamingResponse } from '@/lib/hooks/useStreamingResponse';
import type { Message } from '@/types/database';

export default function TopicPage() {
  const params = useParams();
  const topicId = params.topicId as string;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { people } = usePeople();
  const { topics } = useTopics();
  const { 
    topic, 
    messages, 
    isLoading, 
    sendMessage,
    addMessage,
    refreshMessages 
  } = useTopicConversation(topicId);

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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const scrollTimer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(scrollTimer);
  }, [messages, streamingMessage]);

  // Handle streaming completion
  useEffect(() => {
    const handleStreamingComplete = async () => {
      if (streamingMessage?.isComplete && !streamingMessage.isStreaming) {
        // The streaming API now handles saving messages, so we just need to refresh
        await refreshMessages();
        clearStreamingMessage();
      }
    };

    handleStreamingComplete();
  }, [streamingMessage, clearStreamingMessage, refreshMessages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading || streamingMessage?.isStreaming) return;
    
    try {
      clearFiles();

      // Start AI streaming response (this will handle saving both user and AI messages)
      const assistantMessageId = `assistant-${Date.now()}`;
      await startStreaming(assistantMessageId, async () => {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content.trim(),
            person_id: 'general', // Use general for topic conversations
            isTopicConversation: true,
            topicTitle: topic?.title,
            topicId: topicId
          })
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        return response.body!;
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
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

  const getParticipantNames = () => {
    if (!topic?.participants?.length) return 'No participants';
    
    const participantNames = topic.participants
      .map(participantId => {
        const person = people.find(p => p.id === participantId);
        return person?.name || 'Unknown';
      })
      .filter(name => name !== 'Unknown');
    
    if (participantNames.length === 0) return 'No participants';
    if (participantNames.length === 1) return participantNames[0];
    if (participantNames.length === 2) return participantNames.join(' and ');
    
    const lastParticipant = participantNames.pop();
    return `${participantNames.join(', ')}, and ${lastParticipant}`;
  };

  if (!topic) {
    return (
      <div className="loading-state">
        <div className="loading-emoji">💬</div>
        <div className="loading-text">Loading topic...</div>
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

          <section className="nav-section">
            <div className="nav-section-header">
              <h2 className="nav-section-title">Topics</h2>
              <Link href="/topics/new" className="add-topic-button">
                +
              </Link>
            </div>
            <div className="nav-section-items">
              {topics.map(t => (
                <Link 
                  key={t.id} 
                  href={`/topics/${t.id}`} 
                  className={`nav-item ${topicId === t.id ? 'active' : ''}`}
                >
                  <span className="nav-item-emoji">💬</span>
                  <div className="nav-item-content">
                    <span className="nav-item-name">{t.title}</span>
                    <span className="nav-item-subtitle">
                      {t.participants.length} participants
                    </span>
                  </div>
                </Link>
              ))}
              
              {topics.length === 0 && (
                <div className="empty-topics">
                  <Link href="/topics/new" className="create-first-topic">
                    💬 Create your first topic
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

      <main className={`main-content ${mobileMenuOpen ? 'mobile-pushed' : ''}`}>
        <ChatDropZone
          isDragActive={isDragActive}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          fileInputRef={fileInputRef}
          onFileInputChange={handleFileInputChange}
          disabled={isLoading}
        >
          <div className="conversation-container">
            <header className="conversation-header">
              <div className="conversation-header-content">
                <h1 className="conversation-title">💬 {topic.title}</h1>
                <p className="conversation-subtitle">
                  {getParticipantNames()}
                </p>
              </div>
              <button 
                className="mobile-menu-button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                ☰
              </button>
            </header>

            <div className="conversation-messages">
              {messages.length === 0 && !isLoading ? (
                <div className="empty-state">
                  <div className="empty-state-emoji">💬</div>
                  <h3 className="empty-state-title">Start the discussion</h3>
                  <p className="empty-state-subtitle">
                    Begin your conversation about {topic.title}
                  </p>
                </div>
              ) : (
                <div className="message-group">
                  {messages.map((message, index) => (
                    <MessageBubble
                      key={message.id || index}
                      content={message.content}
                      isUser={message.is_user ?? (message.role === 'user')}
                      timestamp={new Date(message.created_at)}
                      avatar={message.is_user ?? (message.role === 'user') ? undefined : '💬'}
                    />
                  ))}
                  
                  {/* Show streaming message */}
                  {streamingMessage && (
                    <MessageBubble
                      key={streamingMessage.id}
                      content={streamingMessage.content}
                      isUser={false}
                      timestamp={new Date()}
                      avatar="💬"
                      isStreaming={streamingMessage.isStreaming}
                    />
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className={mobileMenuOpen ? 'mobile-pushed' : ''}>
              <EnhancedChatInput
                onSend={handleSendMessage}
                disabled={isLoading}
                placeholder={`Discuss ${topic.title}...`}
                files={files}
                onRemoveFile={removeDroppedFile}
                onOpenFileDialog={openFileDialog}
              />
            </div>
          </div>
        </ChatDropZone>
      </main>
    </div>
  );
} 