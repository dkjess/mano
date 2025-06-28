"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Message } from '@/types/database';

interface MessageCache {
  data: Message[];
  timestamp: number;
}

interface UseMessagesResult {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  refresh: () => Promise<void>;
}

// Global message cache
const messagesCache = new Map<string, MessageCache>();
const pendingRequests = new Map<string, Promise<Message[]>>();

// Cache duration: 1 minute for messages (they change more frequently)
const CACHE_DURATION = 60 * 1000;

export function useMessages(personId: string | null): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);



  const fetchMessages = useCallback(async (force = false): Promise<Message[]> => {
    if (!personId) {
      return [];
    }

    const cacheKey = `messages_${personId}`;
    
    // Check cache first
    if (!force) {
      const cached = messagesCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        return cached.data;
      }
    }

    // Check if there's a pending request for this person
    const pendingRequest = pendingRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Cancel previous request for this hook instance
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    // Create new request
    const requestPromise = (async (): Promise<Message[]> => {
      try {
        const response = await fetch(`/api/messages?person_id=${personId}`, {
          signal: abortControllerRef.current?.signal
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch messages: ${response.status}`);
        }
        
        const data = await response.json();
        const messageData = data.messages || [];
        
        // Update cache
        messagesCache.set(cacheKey, {
          data: messageData,
          timestamp: Date.now()
        });
        
        return messageData;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error; // Re-throw abort errors
        }
        
        console.error('Failed to fetch messages:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to fetch messages');
      } finally {
        // Clean up pending request
        pendingRequests.delete(cacheKey);
      }
    })();

    // Store pending request
    pendingRequests.set(cacheKey, requestPromise);
    
    return requestPromise;
  }, [personId]);



  // Load messages when personId changes
  useEffect(() => {
    // Directly load messages for the current personId
    const loadForPersonId = async () => {
      if (!personId) {
        setMessages([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      // Check cache first
      const cacheKey = `messages_${personId}`;
      const cached = messagesCache.get(cacheKey);
      const hasValidCache = cached && (Date.now() - cached.timestamp) < CACHE_DURATION;
      
      if (hasValidCache) {
        setMessages(cached.data);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(`/api/messages?person_id=${personId}`, {
          signal: abortControllerRef.current.signal
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch messages: ${response.status}`);
        }
        
        const data = await response.json();
        const messageData = data.messages || [];
        
        // Update cache
        messagesCache.set(cacheKey, {
          data: messageData,
          timestamp: Date.now()
        });
        
        // Check if this is still the current personId (prevent race conditions)
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }
        
        setMessages(messageData);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        
        console.error('Failed to fetch messages:', error);
        setError(error instanceof Error ? error.message : 'Failed to load messages');
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadForPersonId();

    return () => {
      // Clean up on unmount or personId change
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [personId]);

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
    
    // Update cache
    if (personId) {
      const cacheKey = `messages_${personId}`;
      const cached = messagesCache.get(cacheKey);
      if (cached) {
        messagesCache.set(cacheKey, {
          data: [...cached.data, message],
          timestamp: cached.timestamp
        });
      }
    }
  }, [personId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    if (personId) {
      const cacheKey = `messages_${personId}`;
      messagesCache.delete(cacheKey);
    }
  }, [personId]);

  const refresh = useCallback(async () => {
    if (!personId) return;
    
    try {
      // Force a fresh fetch by clearing cache first
      const cacheKey = `messages_${personId}`;
      messagesCache.delete(cacheKey);
      
      // Fetch fresh messages
      setIsLoading(true);
      const freshMessages = await fetchMessages(true); // Force fresh fetch
      setMessages(freshMessages);
      setError(null);
    } catch (error) {
      console.error('Error refreshing messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to refresh messages');
    } finally {
      setIsLoading(false);
    }
  }, [personId, fetchMessages]);

  return {
    messages,
    isLoading,
    error,
    addMessage,
    clearMessages,
    refresh,
  };
}

// Utility function to invalidate message cache for a specific person
export function invalidateMessagesCache(personId: string) {
  const cacheKey = `messages_${personId}`;
  messagesCache.delete(cacheKey);
}

// Utility function to clear all message cache
export function clearAllMessagesCache() {
  messagesCache.clear();
} 