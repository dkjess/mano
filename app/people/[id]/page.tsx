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
import { MobileLayout } from '@/components/MobileLayout';
import { ConversationHeader } from '@/components/ConversationHeader';
import { ThinkingLoader } from '@/components/chat/ThinkingLoader';
import { EnhancedThinkingLoader } from '@/components/chat/EnhancedThinkingLoader';



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
  const { messages, isLoading: messagesLoading, addMessage, refresh: refreshMessages } = useMessages(personId);
  const { topics } = useTopics();

  // Add streaming support
  const {
    streamingMessage,
    startStreaming,
    clearStreamingMessage
  } = useStreamingResponse();

  // Add thinking loader state
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingHasFiles, setThinkingHasFiles] = useState(false);
  const [thinkingFileCount, setThinkingFileCount] = useState(0);

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
    setIsThinking(false);
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

  // Handle streaming completion - convert to permanent message
  useEffect(() => {
    if (streamingMessage?.isComplete && !streamingMessage.isStreaming) {
      console.log('🔄 COMPLETION DEBUG: Streaming completed, converting to permanent message...');
      console.log('🔄 COMPLETION DEBUG: Streaming message content length:', streamingMessage.content.length);
      
      // Convert streaming message to permanent message
      const permanentMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: streamingMessage.content,
        is_user: false,
        person_id: personId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Add to messages array (this represents the saved message)
      addMessage(permanentMessage);
      
      // Clear streaming message
      clearStreamingMessage();
      
      console.log('✅ COMPLETION DEBUG: Converted to permanent message:', permanentMessage.id);
    }
  }, [streamingMessage?.isComplete, streamingMessage?.isStreaming, addMessage, clearStreamingMessage, personId]);

  const scrollToBottom = () => {
    const container = document.querySelector('.conversation-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  // Scroll to bottom when conversation loads or messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 150);
    
    return () => clearTimeout(timer);
  }, [personId, messages.length, isThinking]);

  // Enhanced send message function with real API streaming
  const handleSendMessage = async (content: string, dropzoneFiles?: DroppedFile[]) => {
    // Don't send if already processing
    if (sending || streamingMessage?.isStreaming || isThinking) return;

    // Check if we have either content or files
    const trimmedContent = content.trim();
    const hasFiles = files.length > 0;
    
    if (!trimmedContent && !hasFiles) {
      console.log('No content or files to send');
      return;
    }

    // Create optimistic user message with files for immediate display
    const optimisticUserMessage = {
      id: `temp-${Date.now()}`,
      content: trimmedContent || '[File attachment]',
      is_user: true,
      person_id: personId,
      created_at: new Date().toISOString(),
      files: files.map(f => ({
        id: f.id,
        name: f.file.name,
        type: f.type as 'image' | 'transcript' | 'document',
        size: f.file.size,
        icon: getFileIconByType(f.type),
        status: 'uploading' as const
      }))
    };

    // Add optimistic message to UI immediately
    setMessages(prev => [...prev, optimisticUserMessage as any]);

    setSending(true);
    setRetryData(null);

    // Show thinking loader with file context after user message appears
    setIsThinking(true);
    setThinkingHasFiles(hasFiles);
    setThinkingFileCount(files.length);

    try {
      // Step 1: Create user message first
      // For file-only messages, use a default message
      const messageContent = trimmedContent || '[File attachment]';
      
      console.log('Creating user message...', { personId, content: messageContent, hasFiles });
      const requestBody = { 
        person_id: personId,
        content: messageContent,
        is_user: true 
      };
      console.log('Request body:', requestBody);
      
      const userMessageResponse = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!userMessageResponse.ok) {
        const errorData = await userMessageResponse.text();
        console.error('User message creation failed:', errorData);
        throw new Error('Failed to create user message');
      }

      const { message: userMessage } = await userMessageResponse.json();
      console.log('🔍 DEBUG: User message created:', {
        id: userMessage.id,
        content: userMessage.content,
        person_id: userMessage.person_id
      });

      // Step 2: Upload files if any
      if (files.length > 0) {
        console.log(`Uploading ${files.length} files...`);
        const uploadPromises = files.map(async (droppedFile) => {
          try {
            const formData = new FormData();
            formData.append('file', droppedFile.file);
            formData.append('messageId', userMessage.id);

            const uploadResponse = await fetch('/api/files/upload', {
              method: 'POST',
              body: formData
            });

            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.text();
              console.error(`Failed to upload file ${droppedFile.file.name}:`, errorData);
              return false;
            }
            
            console.log(`File uploaded successfully: ${droppedFile.file.name}`);
            return true;
          } catch (error) {
            console.error(`Error uploading file ${droppedFile.file.name}:`, error);
            return false;
          }
        });

        // Wait for all uploads to complete
        const uploadResults = await Promise.all(uploadPromises);
        console.log('🔍 DEBUG: Upload results:', uploadResults);
        console.log('🔍 DEBUG: Files uploaded for message ID:', userMessage.id);
      }

      // Clear files from UI
      clearFiles();
      setStagedFiles([]);

      // Step 3: Refresh messages to show the new user message with attachments
      console.log('Refreshing messages...');
      try {
        await refreshMessages();
        console.log('Messages refreshed successfully');
      } catch (refreshError) {
        console.error('Error refreshing messages:', refreshError);
        // Continue anyway, the streaming response will still work
      }

      // Step 4: Start AI streaming response (thinking loader will disappear when first chunk arrives)
      console.log('🔍 DEBUG: Starting AI streaming response...', {
        personId,
        messageContent: trimmedContent || 'Please analyze the attached file(s)',
        hasFiles,
        filesCount: files.length
      });
      
      const assistantMessageId = `assistant-${Date.now()}`;
      await startStreaming(assistantMessageId, async () => {
        const requestPayload = {
          person_id: personId,
          message: trimmedContent || 'Please analyze the attached file(s)',
          hasFiles: hasFiles, // Indicate that files were uploaded
          messageId: userMessage.id // Pass the actual message ID where files are attached
        };
        
        console.log('🔍 DEBUG: Sending streaming request:', requestPayload);
        
        // Get Supabase session for authentication
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No authenticated session found');
        }

        console.log('🚀 API DEBUG: Making request to Edge Function:', {
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`,
          payload: {
            action: 'streaming_chat',
            ...requestPayload
          },
          hasAuth: !!session.access_token
        });
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          },
          body: JSON.stringify({
            action: 'streaming_chat',
            ...requestPayload
          })
        });
        
        console.log('📡 API DEBUG: Response received:', {
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('AI streaming response failed:', errorData);
        throw new Error('Failed to get AI response');
      }

      return response.body!;
    }, () => {
      // Callback: Hide thinking loader when first chunk arrives
      console.log('🎯 PERSON DEBUG: First chunk received, hiding thinking loader');
      setIsThinking(false);
    });

    } catch (error) {
      console.error('Failed to send message:', error);
      setIsThinking(false); // Make sure to clear thinking state on error
      // Ensure we refresh messages even if there was an error
      // so the user can see their message
      try {
        await refreshMessages();
      } catch (refreshError) {
        console.error('Error refreshing messages after error:', refreshError);
      }
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

  // Profile completion handlers
  const handleProfileComplete = (field: string, value: string) => {
    console.log('Profile field completed:', field, value);
    setProfilePrompt(null);
    // The profile update is already handled by the ProfileCompletionPrompt component
  };

  const handleProfileDismiss = () => {
    console.log('Profile prompt dismissed');
    setProfilePrompt(null);
  };

  // Person suggestion handlers
  const handlePersonAdded = (newPerson: Person) => {
    console.log('New person added:', newPerson);
    setPersonSuggestion(null);
    // The person is already added through the context
  };

  const handleDismissSuggestion = () => {
    console.log('Person suggestion dismissed');
    setPersonSuggestion(null);
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
        <Link href="/conversations" className="add-person-button">
          👈 Back to Conversations
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Desktop: Direct content, sidebar handled by root layout */}
      <div className="hidden lg:block">
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
            <ConversationHeader
              title={`${personId === 'general' ? '🤲' : getRelationshipEmoji(person.relationship_type || 'peer')} ${person.name}`}
              subtitle={personId === 'general' 
                ? 'Management coaching and strategic advice' 
                : person.role || getRelationshipLabel(person.relationship_type || 'peer')
              }
              rightAction={personId !== 'general' ? (
                <button
                  onClick={handleOpenPersonEditMenu}
                  className="text-gray-400 hover:text-gray-600 p-2"
                  title="Edit profile"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              ) : null}
            />
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
                    messageId={message.id}
                    content={message.content}
                    isUser={message.is_user ?? (message.role === 'user')}
                    files={(message as any).files || []} // Pass files if they exist
                    timestamp={new Date(message.created_at)}
                    avatar={message.is_user ?? (message.role === 'user') ? undefined : undefined}
                  />
                ))}
                
                {/* Show thinking loader */}
                {isThinking && (
                  <EnhancedThinkingLoader 
                    hasFiles={thinkingHasFiles} 
                    fileCount={thinkingFileCount} 
                  />
                )}

                {/* Show streaming message */}
                {streamingMessage && (
                  <MessageBubble
                    content={streamingMessage.content}
                    isUser={false}
                    isStreaming={streamingMessage.isStreaming}
                    hasContent={streamingMessage.hasContent}
                    timestamp={new Date()}
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
          <div>
            <EnhancedChatInput
              onSend={handleSendMessage}
              disabled={sending || streamingMessage?.isStreaming || isThinking}
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
      </div>

      {/* Mobile: Use MobileLayout as simple container */}
      <MobileLayout>
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
            <ConversationHeader
              title={`${personId === 'general' ? '🤲' : getRelationshipEmoji(person.relationship_type || 'peer')} ${person.name}`}
              subtitle={personId === 'general' 
                ? 'Management coaching and strategic advice' 
                : person.role || getRelationshipLabel(person.relationship_type || 'peer')
              }
              rightAction={personId !== 'general' ? (
                <button
                  onClick={handleOpenPersonEditMenu}
                  className="text-gray-400 hover:text-gray-600 p-2"
                  title="Edit profile"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              ) : null}
            />
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
                    messageId={message.id}
                    content={message.content}
                    isUser={message.is_user ?? (message.role === 'user')}
                    files={(message as any).files || []} // Pass files if they exist
                    timestamp={new Date(message.created_at)}
                    avatar={message.is_user ?? (message.role === 'user') ? undefined : undefined}
                  />
                ))}
                
                {/* Show thinking loader */}
                {isThinking && (
                  <EnhancedThinkingLoader 
                    hasFiles={thinkingHasFiles} 
                    fileCount={thinkingFileCount} 
                  />
                )}

                {/* Show streaming message */}
                {streamingMessage && (
                  <MessageBubble
                    content={streamingMessage.content}
                    isUser={false}
                    isStreaming={streamingMessage.isStreaming}
                    hasContent={streamingMessage.hasContent}
                    timestamp={new Date()}
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
          <div>
            <EnhancedChatInput
              onSend={handleSendMessage}
              disabled={sending || streamingMessage?.isStreaming || isThinking}
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
      </MobileLayout>
    </>
  );
}