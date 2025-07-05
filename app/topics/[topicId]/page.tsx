"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { usePeople } from '@/lib/contexts/people-context';
import { useTopicConversation } from '@/lib/hooks/useTopicConversation';
import { useTopics } from '@/lib/hooks/useTopics';
import { MobileLayout } from '@/components/MobileLayout';
import { EnhancedChatInput } from '@/components/chat/EnhancedChatInput';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { useFileDropZone } from '@/lib/hooks/useFileDropZone';
import { ChatDropZone } from '@/components/chat/ChatDropZone';
import { useStreamingResponse } from '@/lib/hooks/useStreamingResponse';
import { ConversationHeader } from '@/components/ConversationHeader';
import type { Message } from '@/types/database';

export default function TopicPage() {
  const params = useParams();
  const topicId = params.topicId as string;
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

  // Scroll to bottom after messages render
  useEffect(() => {
    // Use setTimeout to ensure DOM is updated
    const timer = setTimeout(() => {
      const container = document.querySelector('.conversation-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 150);
    
    return () => clearTimeout(timer);
  }, [topicId, messages.length, streamingMessage?.content]);

  // Handle streaming completion
  useEffect(() => {
    if (streamingMessage?.isComplete && !streamingMessage.isStreaming) {
      console.log('🔄 TOPIC COMPLETION DEBUG: Streaming completed, refreshing messages...');
      console.log('🔄 TOPIC COMPLETION DEBUG: Streaming message content length:', streamingMessage.content.length);
      
      // The streaming API now handles saving messages, so we just need to refresh
      refreshMessages().then(() => {
        console.log('✅ TOPIC COMPLETION DEBUG: Messages refreshed, clearing streaming message');
        clearStreamingMessage();
      }).catch((error) => {
        console.error('❌ TOPIC COMPLETION DEBUG: Error refreshing messages:', error);
        // Still clear the streaming message even if refresh fails
        clearStreamingMessage();
      });
    }
  }, [streamingMessage?.isComplete, streamingMessage?.isStreaming, clearStreamingMessage, refreshMessages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading || streamingMessage?.isStreaming) return;
    
    try {
      // Step 1: Create user message first
      console.log('Creating user message...');
      const userMessageResponse = await fetch(`/api/topics/${topicId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: content.trim(),
          is_user: true 
        })
      });

      if (!userMessageResponse.ok) {
        const errorData = await userMessageResponse.text();
        console.error('User message creation failed:', errorData);
        throw new Error('Failed to create user message');
      }

      const { message: userMessage } = await userMessageResponse.json();
      console.log('User message created:', userMessage.id);

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
        await Promise.all(uploadPromises);
      }

      // Clear files from UI
      clearFiles();

      // Step 3: Refresh messages to show the new user message with attachments
      console.log('Refreshing messages...');
      try {
        await refreshMessages();
        console.log('Messages refreshed successfully');
      } catch (refreshError) {
        console.error('Error refreshing messages:', refreshError);
        // Continue anyway, the streaming response will still work
      }

      // Step 4: Start AI streaming response
      console.log('Starting AI streaming response...');
      const assistantMessageId = `assistant-${Date.now()}`;
      await startStreaming(assistantMessageId, async () => {
        // Get Supabase session for authentication
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No authenticated session found');
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          },
          body: JSON.stringify({
            action: 'streaming_chat',
            message: content.trim(),
            person_id: null, // No person for topic conversations
            isTopicConversation: true,
            topicTitle: topic?.title,
            topicId: topicId,
            hasFiles: files.length > 0 // Indicate that files were uploaded
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('AI streaming response failed:', errorData);
          throw new Error('Failed to get AI response');
        }

        return response.body!;
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      // Ensure we refresh messages even if there was an error
      // so the user can see their message
      try {
        await refreshMessages();
      } catch (refreshError) {
        console.error('Error refreshing messages after error:', refreshError);
      }
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
              title={`💬 ${topic.title}`}
              subtitle={getParticipantNames()}
            />

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
                      messageId={message.id}
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

            <div>
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
      </div>

      {/* Mobile: Use MobileLayout with conversation header */}
      <MobileLayout
        title={topic?.title || "Topic"}
        subtitle={getParticipantNames()}
        showBackButton={true}
        backHref="/conversations"
      >
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
              title={`💬 ${topic.title}`}
              subtitle={getParticipantNames()}
            />

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
                      messageId={message.id}
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

            <div>
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
      </MobileLayout>
    </>
  );
} 