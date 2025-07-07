"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Message, Person } from '@/types/database';
import { DroppedFile } from '@/lib/hooks/useFileDropZone';

export interface Topic {
  id: string;
  title: string;
  status: 'active' | 'archived';
  participants: string[];
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface UseUnifiedConversationResult {
  // Data
  conversation: Person | Topic | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  sendMessage: (content: string, files?: DroppedFile[]) => Promise<void>;
  refreshMessages: () => Promise<void>;
  refreshConversation: () => Promise<void>;
}

export function useUnifiedConversation(
  conversationId: string, 
  conversationType: 'person' | 'topic'
): UseUnifiedConversationResult {
  const [conversation, setConversation] = useState<Person | Topic | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Unified message fetching
  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    
    console.log('🔄 UNIFIED FETCH: Fetching messages for', conversationType, conversationId);
    
    try {
      setError(null);
      
      const endpoint = conversationType === 'person'
        ? `/api/messages?person_id=${conversationId}`
        : `/api/topics/${conversationId}/messages`;
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }
      
      const data = await response.json();
      const messageData = data.messages || [];
      
      console.log('✅ UNIFIED FETCH: Messages fetched successfully:', {
        conversationType,
        conversationId,
        messageCount: messageData.length
      });
      
      setMessages(messageData);
    } catch (error) {
      console.error('❌ UNIFIED FETCH: Failed to fetch messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to load messages');
      setMessages([]);
    }
  }, [conversationId, conversationType]);

  // Unified conversation data fetching
  const fetchConversation = useCallback(async () => {
    if (!conversationId) return;
    
    console.log('🔄 UNIFIED FETCH: Fetching conversation data for', conversationType, conversationId);
    
    try {
      setError(null);
      
      const endpoint = conversationType === 'person'
        ? `/api/people/${conversationId}`
        : `/api/topics/${conversationId}`;
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${conversationType}: ${response.status}`);
      }
      
      const data = await response.json();
      const conversationData = conversationType === 'person' ? data.person : data.topic;
      
      console.log('✅ UNIFIED FETCH: Conversation data fetched successfully:', {
        conversationType,
        conversationId,
        title: conversationData?.name || conversationData?.title
      });
      
      setConversation(conversationData);
    } catch (error) {
      console.error(`❌ UNIFIED FETCH: Failed to fetch ${conversationType}:`, error);
      setError(error instanceof Error ? error.message : `Failed to load ${conversationType}`);
      setConversation(null);
    }
  }, [conversationId, conversationType]);

  // Load data when conversationId or type changes
  useEffect(() => {
    async function loadData() {
      if (!conversationId) return;
      
      setIsLoading(true);
      
      try {
        // Fetch conversation data and messages in parallel
        await Promise.all([
          fetchConversation(),
          fetchMessages()
        ]);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [conversationId, conversationType, fetchConversation, fetchMessages]);

  // Unified send message
  const sendMessage = useCallback(async (content: string, files?: DroppedFile[]) => {
    if (!content.trim() && (!files || files.length === 0)) return;
    if (!conversationId) throw new Error('No conversation ID');
    
    console.log('🚀 UNIFIED SEND: Starting message send...', {
      conversationType,
      conversationId,
      content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      hasFiles: !!files?.length,
      fileCount: files?.length || 0
    });

    try {
      setError(null);
      
      // Step 1: Create user message
      const messageEndpoint = conversationType === 'person'
        ? `/api/messages`
        : `/api/topics/${conversationId}/messages`;
      
      const messagePayload = conversationType === 'person'
        ? { content: content.trim(), person_id: conversationId, is_user: true }
        : { content: content.trim(), is_user: true };
      
      const userMessageResponse = await fetch(messageEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messagePayload)
      });

      if (!userMessageResponse.ok) {
        const errorData = await userMessageResponse.text();
        console.error('User message creation failed:', errorData);
        throw new Error('Failed to create user message');
      }

      const { message: userMessage } = await userMessageResponse.json();
      console.log('✅ UNIFIED SEND: User message created:', userMessage.id);

      // Step 2: Upload files if any
      if (files && files.length > 0) {
        console.log(`🔄 UNIFIED SEND: Uploading ${files.length} files...`);
        
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
            
            console.log(`✅ UNIFIED SEND: File uploaded successfully: ${droppedFile.file.name}`);
            return true;
          } catch (error) {
            console.error(`Error uploading file ${droppedFile.file.name}:`, error);
            return false;
          }
        });

        // Wait for all uploads to complete
        const uploadResults = await Promise.all(uploadPromises);
        console.log('✅ UNIFIED SEND: All file uploads completed:', uploadResults);
      }

      // Step 3: Optimistically add the user message to UI
      const optimisticUserMessage: Message = {
        id: userMessage.id,
        content: content.trim(),
        is_user: true,
        [conversationType === 'person' ? 'person_id' : 'topic_id']: conversationId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, optimisticUserMessage]);
      
      console.log('✅ UNIFIED SEND: Message send completed successfully');
      
    } catch (error) {
      console.error('❌ UNIFIED SEND: Failed to send message:', error);
      throw error; // Re-throw so ConversationContainer can handle it
    }
  }, [conversationId, conversationType]);

  // Refresh functions
  const refreshMessages = useCallback(async () => {
    await fetchMessages();
  }, [fetchMessages]);

  const refreshConversation = useCallback(async () => {
    await fetchConversation();
  }, [fetchConversation]);

  // Add new message (for streaming completion)
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  return {
    conversation,
    messages,
    isLoading,
    error,
    sendMessage,
    refreshMessages,
    refreshConversation
  };
}