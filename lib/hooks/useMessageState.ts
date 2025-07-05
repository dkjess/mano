"use client";

import { useState, useCallback } from 'react';

export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  isLoading?: boolean;
  isStreaming?: boolean;
  isComplete?: boolean;
}

export function useMessageState() {
  const [messages, setMessages] = useState<Message[]>([]);

  const addUserMessage = useCallback((content: string): string => {
    const messageId = `user-${Date.now()}`;
    const userMessage: Message = {
      id: messageId,
      content,
      isUser: true,
      timestamp: new Date(),
      isComplete: true
    };
    
    setMessages(prev => [...prev, userMessage]);
    return messageId;
  }, []);

  const addLoadingMessage = useCallback((): string => {
    const messageId = `loading-${Date.now()}`;
    const loadingMessage: Message = {
      id: messageId,
      content: '',
      isUser: false,
      timestamp: new Date(),
      isLoading: true,
      isComplete: false
    };
    
    setMessages(prev => [...prev, loadingMessage]);
    return messageId;
  }, []);

  const startStreamingMessage = useCallback((loadingMessageId: string): string => {
    const streamingMessageId = `streaming-${Date.now()}`;
    
    setMessages(prev => prev.map(msg => 
      msg.id === loadingMessageId 
        ? {
            ...msg,
            id: streamingMessageId,
            isLoading: false,
            isStreaming: true,
            content: ''
          }
        : msg
    ));
    
    return streamingMessageId;
  }, []);

  const updateStreamingMessage = useCallback((messageId: string, content: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content }
        : msg
    ));
  }, []);

  const completeStreamingMessage = useCallback((messageId: string, finalContent: string) => {
    console.log('✅ MESSAGE STATE DEBUG: Completing streaming message', messageId, 'content length:', finalContent.length);
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? {
            ...msg,
            content: finalContent,
            isStreaming: false,
            isComplete: true
          }
        : msg
    ));
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    addUserMessage,
    addLoadingMessage,
    startStreamingMessage,
    updateStreamingMessage,
    completeStreamingMessage,
    removeMessage,
    clearMessages
  };
} 