"use client";

import { useState, useEffect, useRef, ReactNode } from 'react';
import { useParams } from 'next/navigation';
import type { Message, Person } from '@/types/database';
import { useStreamingResponse } from '@/lib/hooks/useStreamingResponse';
import { useFileDropZone, DroppedFile } from '@/lib/hooks/useFileDropZone';
import { ChatDropZone } from '@/components/chat/ChatDropZone';
import { ConversationHeader } from '@/components/ConversationHeader';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { EnhancedChatInput } from '@/components/chat/EnhancedChatInput';
import { EnhancedThinkingLoader } from '@/components/chat/EnhancedThinkingLoader';
import { MobileLayout } from '@/components/MobileLayout';
import { createClient } from '@/lib/supabase/client';

export interface ConversationHeader {
  title: string;
  subtitle?: string;
  rightAction?: ReactNode;
}

export interface ConversationFeatures {
  profileManagement?: boolean;
  topicManagement?: boolean;
  personSuggestions?: boolean;
  fileAttachments?: boolean;
}

export interface ConversationContainerProps {
  conversationId: string;
  conversationType: 'person' | 'topic';
  header: ConversationHeader;
  features?: ConversationFeatures;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (content: string, files?: DroppedFile[]) => Promise<void>;
  onRefreshMessages: () => Promise<void>;
  specialComponents?: ReactNode; // For person suggestions, profile prompts, etc.
  onPersonSuggestions?: (suggestions: any[]) => void;
  onProfileCompletion?: (prompt: any) => void;
}

export function ConversationContainer({
  conversationId,
  conversationType,
  header,
  features = {},
  messages,
  isLoading,
  onSendMessage,
  onRefreshMessages,
  specialComponents,
  onPersonSuggestions,
  onProfileCompletion
}: ConversationContainerProps) {
  // Unified streaming support
  const {
    streamingMessage,
    intelligenceEvents,
    startStreaming,
    clearStreamingMessage,
    clearIntelligenceEvents
  } = useStreamingResponse();

  // Unified file drop support
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

  // Unified UI state
  const [isThinking, setIsThinking] = useState(false);
  const [sending, setSending] = useState(false);
  const [thinkingHasFiles, setThinkingHasFiles] = useState(false);
  const [thinkingFileCount, setThinkingFileCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle intelligence events from server
  useEffect(() => {
    if (intelligenceEvents.personSuggestions && onPersonSuggestions) {
      console.log('🧠 UNIFIED: Handling person suggestions from server:', intelligenceEvents.personSuggestions);
      onPersonSuggestions(intelligenceEvents.personSuggestions);
      clearIntelligenceEvents();
    }
    
    if (intelligenceEvents.profileCompletion && onProfileCompletion) {
      console.log('🧠 UNIFIED: Handling profile completion from server:', intelligenceEvents.profileCompletion);
      onProfileCompletion(intelligenceEvents.profileCompletion);
      clearIntelligenceEvents();
    }
  }, [intelligenceEvents, onPersonSuggestions, onProfileCompletion, clearIntelligenceEvents]);

  // Auto-scroll during streaming and when sending
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = document.querySelector('.conversation-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 150);
    
    return () => clearTimeout(timer);
  }, [conversationId, messages.length, streamingMessage?.content, isThinking]);

  // Handle streaming completion - convert to permanent message
  useEffect(() => {
    if (streamingMessage?.isComplete && !streamingMessage.isStreaming) {
      console.log('🔄 UNIFIED COMPLETION DEBUG: Streaming completed, converting to permanent message...');
      console.log('🔄 UNIFIED COMPLETION DEBUG: Streaming message content length:', streamingMessage.content.length);
      
      // Convert streaming message to permanent message
      const permanentMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: streamingMessage.content,
        is_user: false,
        [conversationType === 'person' ? 'person_id' : 'topic_id']: conversationId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // This would need to be handled by the parent component
      // For now, we'll just clear the streaming message
      clearStreamingMessage();
      
      console.log('✅ UNIFIED COMPLETION DEBUG: Converted to permanent message:', permanentMessage.id);
      
      // Refresh messages to get the server-saved version
      onRefreshMessages();
    }
  }, [streamingMessage?.isComplete, streamingMessage?.isStreaming, clearStreamingMessage, conversationId, conversationType, onRefreshMessages]);

  // Unified send message handler
  const handleSendMessage = async (content: string, dropzoneFiles?: DroppedFile[]) => {
    if (!content.trim() && !files.length && !dropzoneFiles?.length) return;
    
    const finalFiles = dropzoneFiles || files;
    const hasFiles = finalFiles.length > 0;
    
    console.log('🚀 UNIFIED SEND DEBUG: Starting message send...', {
      conversationType,
      conversationId,
      content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      hasFiles,
      fileCount: finalFiles.length
    });

    setSending(true);
    setIsThinking(true);
    
    // Set thinking loader state for files
    if (hasFiles) {
      setThinkingHasFiles(true);
      setThinkingFileCount(finalFiles.length);
    }

    try {
      // Call the parent's send message handler
      await onSendMessage(content, finalFiles);
      
      // Clear files from UI
      clearFiles();
      
      // Start AI streaming response
      console.log('🔍 UNIFIED SEND DEBUG: Starting AI streaming response...');
      const assistantMessageId = `assistant-${Date.now()}`;
      
      await startStreaming(assistantMessageId, async () => {
        // Get Supabase session for authentication
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No authenticated session found');
        }

        // Get the messageId from the most recent user message for file processing
        let messageId: string | undefined;
        try {
          // The parent's sendMessage should have added the user message to the array
          // Find the most recent user message
          const userMessages = messages.filter(m => m.is_user);
          const latestUserMessage = userMessages[userMessages.length - 1];
          messageId = latestUserMessage?.id;
          console.log('🔍 UNIFIED SEND DEBUG: Using messageId for file processing:', messageId);
        } catch (error) {
          console.warn('Could not determine messageId for file processing:', error);
        }

        // Create unified request payload
        const basePayload = {
          action: 'streaming_chat',
          message: content.trim(),
          hasFiles: hasFiles,
          isTopicConversation: conversationType === 'topic',
          messageId: messageId, // Pass messageId for file processing
        };

        const payload = conversationType === 'person' 
          ? { ...basePayload, person_id: conversationId }
          : { ...basePayload, person_id: null, topicId: conversationId };

        console.log('🔍 UNIFIED SEND DEBUG: Sending streaming request:', payload);
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('AI streaming response failed:', errorData);
          throw new Error('Failed to get AI response');
        }

        return response.body!;
      }, () => {
        // Callback: Hide thinking loader when first chunk arrives
        console.log('🎯 UNIFIED DEBUG: First chunk received, hiding thinking loader');
        setIsThinking(false);
      });

    } catch (error) {
      console.error('Failed to send message:', error);
      setIsThinking(false);
      
      // Refresh messages even if there was an error
      try {
        await onRefreshMessages();
      } catch (refreshError) {
        console.error('Error refreshing messages after error:', refreshError);
      }
    } finally {
      setSending(false);
      setThinkingHasFiles(false);
      setThinkingFileCount(0);
    }
  };

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
          disabled={isLoading}
        >
          <div className="conversation-container">
            <ConversationHeader
              title={header.title}
              subtitle={header.subtitle}
              rightAction={header.rightAction}
            />

            <div className="conversation-messages">
              {/* Empty state */}
              {messages.length === 0 && !sending && !streamingMessage && !isLoading ? (
                <div className="empty-state">
                  <div className="empty-state-emoji">💬</div>
                  <h3 className="empty-state-title">Start the conversation</h3>
                  <p className="empty-state-subtitle">
                    {conversationType === 'person' 
                      ? 'Begin your conversation'
                      : 'Ask for management advice, discuss strategy, or work through challenges'
                    }
                  </p>
                </div>
              ) : (
                <div className="message-group">
                  {/* Render existing messages */}
                  {messages.map((message, index) => (
                    <MessageBubble
                      key={message.id || index}
                      messageId={message.id}
                      content={message.content}
                      isUser={message.is_user ?? (message.role === 'user')}
                      files={(message as any).files || []}
                      timestamp={new Date(message.created_at)}
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

                  {/* Special components (person suggestions, profile prompts, etc.) */}
                  {specialComponents}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Enhanced Chat Input */}
            <div>
              <EnhancedChatInput
                onSend={handleSendMessage}
                disabled={sending || streamingMessage?.isStreaming || isThinking}
                placeholder={conversationType === 'person' 
                  ? `Message ${header.title}...`
                  : 'Ask for management guidance...'
                }
                files={files}
                onRemoveFile={removeDroppedFile}
                onOpenFileDialog={openFileDialog}
              />
            </div>
          </div>
        </ChatDropZone>
      </div>

      {/* Mobile: Use MobileLayout */}
      <div className="block lg:hidden">
        <MobileLayout>
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
              <ConversationHeader
                title={header.title}
                subtitle={header.subtitle}
                rightAction={header.rightAction}
              />

              <div className="conversation-messages">
                {/* Same content as desktop */}
                {messages.length === 0 && !sending && !streamingMessage && !isLoading ? (
                  <div className="empty-state">
                    <div className="empty-state-emoji">💬</div>
                    <h3 className="empty-state-title">Start the conversation</h3>
                    <p className="empty-state-subtitle">
                      {conversationType === 'person' 
                        ? 'Begin your conversation'
                        : 'Ask for management advice, discuss strategy, or work through challenges'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="message-group">
                    {messages.map((message, index) => (
                      <MessageBubble
                        key={message.id || index}
                        messageId={message.id}
                        content={message.content}
                        isUser={message.is_user ?? (message.role === 'user')}
                        files={(message as any).files || []}
                        timestamp={new Date(message.created_at)}
                      />
                    ))}
                    
                    {isThinking && (
                      <EnhancedThinkingLoader 
                        hasFiles={thinkingHasFiles} 
                        fileCount={thinkingFileCount} 
                      />
                    )}

                    {streamingMessage && (
                      <MessageBubble
                        content={streamingMessage.content}
                        isUser={false}
                        isStreaming={streamingMessage.isStreaming}
                        hasContent={streamingMessage.hasContent}
                        timestamp={new Date()}
                      />
                    )}

                    {specialComponents}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div>
                <EnhancedChatInput
                  onSend={handleSendMessage}
                  disabled={sending || streamingMessage?.isStreaming || isThinking}
                  placeholder={conversationType === 'person' 
                    ? `Message ${header.title}...`
                    : 'Ask for management guidance...'
                  }
                  files={files}
                  onRemoveFile={removeDroppedFile}
                  onOpenFileDialog={openFileDialog}
                />
              </div>
            </div>
          </ChatDropZone>
        </MobileLayout>
      </div>
    </>
  );
}