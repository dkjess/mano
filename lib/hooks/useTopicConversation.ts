"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Message } from '@/types/database';

interface Topic {
  id: string;
  title: string;
  status: 'active' | 'archived';
  participants: string[];
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface UseTopicConversationResult {
  topic: Topic | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  addMessage: (message: Message) => void;
  refreshMessages: () => Promise<void>;
}

export function useTopicConversation(topicId: string): UseTopicConversationResult {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch topic and messages when topicId changes
  useEffect(() => {
    async function fetchTopicData() {
      if (!topicId) return;
      
      try {
        setError(null);
        
        const [topicResponse, messagesResponse] = await Promise.all([
          fetch(`/api/topics/${topicId}`),
          fetch(`/api/topics/${topicId}/messages`)
        ]);

        const topicData = await topicResponse.json();
        const messagesData = await messagesResponse.json();

        if (topicResponse.ok) {
          setTopic(topicData.topic);
        } else {
          throw new Error(topicData.error || 'Failed to fetch topic');
        }

        if (messagesResponse.ok) {
          setMessages(messagesData.messages || []);
        } else {
          throw new Error(messagesData.error || 'Failed to fetch messages');
        }
      } catch (error) {
        console.error('Failed to fetch topic data:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch topic data');
      }
    }

    fetchTopicData();
  }, [topicId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !topicId) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/topics/${topicId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() })
      });

      const data = await response.json();
      
      if (response.ok) {
        const newMessage = data.message;
        setMessages(prev => [...prev, newMessage]);
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [topicId]);

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!topicId) return;
    
    try {
      const response = await fetch(`/api/topics/${topicId}/messages`);
      const data = await response.json();
      
      if (response.ok) {
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to refresh messages:', error);
    }
  }, [topicId]);

  return {
    topic,
    messages,
    isLoading,
    error,
    sendMessage,
    addMessage,
    refreshMessages
  };
} 