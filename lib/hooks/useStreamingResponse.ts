"use client";

import { useState, useRef, useCallback } from 'react';

interface StreamingMessage {
  id: string;
  content: string;
  isComplete: boolean;
  isStreaming: boolean;
}

export function useStreamingResponse() {
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startStreaming = useCallback(async (
    messageId: string,
    apiCall: () => Promise<ReadableStream<Uint8Array>>
  ) => {
    // Clean up any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }

    // Initialize streaming message
    setStreamingMessage({
      id: messageId,
      content: '',
      isComplete: false,
      isStreaming: true
    });

    try {
      abortControllerRef.current = new AbortController();
      const stream = await apiCall();
      
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let displayedContent = '';

      // Read from stream and buffer content
      const readChunk = async () => {
        try {
          const { done, value } = await reader.read();
          
          if (done) {
            // Stream finished, display any remaining content
            if (buffer.length > displayedContent.length) {
              await typeOutRemaining(buffer, displayedContent, messageId);
            } else {
              setStreamingMessage(prev => prev ? {
                ...prev,
                isComplete: true,
                isStreaming: false
              } : null);
            }
            return;
          }

          // Decode and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Start typing out if we haven't already
          if (!streamIntervalRef.current && buffer.length > 0) {
            startTypingEffect(buffer, messageId);
          }

          // Continue reading
          readChunk();
        } catch (error) {
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('Stream reading error:', error);
            setStreamingMessage(prev => prev ? {
              ...prev,
              isComplete: true,
              isStreaming: false
            } : null);
          }
        }
      };

      // Start typing effect that displays characters smoothly
      const startTypingEffect = (fullContent: string, messageId: string) => {
        let charIndex = 0;
        const typingSpeed = 30; // milliseconds per character
        
        streamIntervalRef.current = setInterval(() => {
          if (charIndex < fullContent.length) {
            displayedContent = fullContent.slice(0, charIndex + 1);
            
            setStreamingMessage(prev => 
              prev?.id === messageId ? {
                ...prev,
                content: displayedContent
              } : prev
            );
            
            charIndex++;
          } else {
            // Caught up with buffer, pause typing until more content arrives
            if (streamIntervalRef.current) {
              clearInterval(streamIntervalRef.current);
              streamIntervalRef.current = null;
            }
          }
        }, typingSpeed);
      };

      // Type out any remaining content when stream ends
      const typeOutRemaining = async (fullContent: string, currentContent: string, messageId: string) => {
        return new Promise<void>((resolve) => {
          let charIndex = currentContent.length;
          const typingSpeed = 20; // Slightly faster for final content
          
          const interval = setInterval(() => {
            if (charIndex < fullContent.length) {
              const newContent = fullContent.slice(0, charIndex + 1);
              
              setStreamingMessage(prev => 
                prev?.id === messageId ? {
                  ...prev,
                  content: newContent
                } : prev
              );
              
              charIndex++;
            } else {
              clearInterval(interval);
              setStreamingMessage(prev => prev ? {
                ...prev,
                isComplete: true,
                isStreaming: false
              } : null);
              resolve();
            }
          }, typingSpeed);
        });
      };

      readChunk();
    } catch (error) {
      console.error('Streaming error:', error);
      setStreamingMessage(prev => prev ? {
        ...prev,
        content: 'Sorry, there was an error processing your message.',
        isComplete: true,
        isStreaming: false
      } : null);
    }
  }, []);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }
    setStreamingMessage(prev => prev ? {
      ...prev,
      isComplete: true,
      isStreaming: false
    } : null);
  }, []);

  const clearStreamingMessage = useCallback(() => {
    setStreamingMessage(null);
  }, []);

  return {
    streamingMessage,
    startStreaming,
    stopStreaming,
    clearStreamingMessage
  };
} 