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
      streamIntervalRef.current = null;
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
      
      // State for the streaming process
      let fullBuffer = '';
      let displayedLength = 0;
      let isStreamComplete = false;
      let typingStarted = false;

      // Single continuous typing effect
      const startTyping = () => {
        if (typingStarted) return;
        typingStarted = true;
        
        const typingSpeed = 5; // milliseconds per character (very fast typing)
        
        streamIntervalRef.current = setInterval(() => {
          if (displayedLength < fullBuffer.length) {
            // More content to display
            displayedLength++;
            const displayedContent = fullBuffer.slice(0, displayedLength);
            
            setStreamingMessage(prev => 
              prev?.id === messageId ? {
                ...prev,
                content: displayedContent
              } : prev
            );
          } else if (isStreamComplete) {
            // We've displayed everything and stream is done
            if (streamIntervalRef.current) {
              clearInterval(streamIntervalRef.current);
              streamIntervalRef.current = null;
            }
            console.log('🏁 CLIENT DEBUG: Setting streaming complete. Final content length:', fullBuffer.length);
            setStreamingMessage(prev => prev ? {
              ...prev,
              isComplete: true,
              isStreaming: false
            } : null);
          }
          // If displayedLength >= fullBuffer.length but !isStreamComplete,
          // keep the interval running and wait for more content
        }, typingSpeed);
      };

      // Read from stream and accumulate content
      const readChunk = async (): Promise<void> => {
        try {
          const { done, value } = await reader.read();
          
          if (done) {
            isStreamComplete = true;
            return;
          }

          // Decode chunk and process Server-Sent Events
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // Remove 'data: ' prefix
              
              try {
                const parsed = JSON.parse(data);
                
                // DEBUG: Log all parsed messages
                console.log('🔍 CLIENT DEBUG: Received message:', parsed);
                
                if ((parsed.type === 'delta' && parsed.text) || (parsed.type === 'content' && parsed.content)) {
                  // Add new text to buffer (support both old and new formats)
                  const newText = parsed.text || parsed.content;
                  fullBuffer += newText;
                  console.log('📝 CLIENT DEBUG: Added to buffer:', newText.length, 'chars. Total buffer:', fullBuffer.length);
                  
                  // Start typing if not already started
                  if (!typingStarted) {
                    console.log('⌨️ CLIENT DEBUG: Starting typing effect');
                    startTyping();
                  }
                } else if (parsed.type === 'complete') {
                  console.log('✅ CLIENT DEBUG: Stream complete received');
                } else if (parsed.type === 'start_playback') {
                  console.log('🎬 CLIENT DEBUG: Playback starting');
                } else if (parsed.type === 'start') {
                  console.log('🚀 CLIENT DEBUG: Stream starting');
                } else if (parsed.type === 'complete') {
                  isStreamComplete = true;
                  return;
                } else if (parsed.type === 'error') {
                  // Handle error from API
                  fullBuffer = parsed.error || 'An error occurred';
                  isStreamComplete = true;
                  if (!typingStarted) {
                    startTyping();
                  }
                  return;
                }
              } catch (parseError) {
                // If not valid JSON, might be plain text - add to buffer
                if (data && data !== '[DONE]') {
                  fullBuffer += data;
                  if (!typingStarted) {
                    startTyping();
                  }
                }
              }
            }
          }

          // Continue reading
          await readChunk();
        } catch (error) {
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('Stream reading error:', error);
            isStreamComplete = true;
            if (streamIntervalRef.current) {
              clearInterval(streamIntervalRef.current);
              streamIntervalRef.current = null;
            }
            setStreamingMessage(prev => prev ? {
              ...prev,
              content: fullBuffer || 'Sorry, there was an error processing your message.',
              isComplete: true,
              isStreaming: false
            } : null);
          }
        }
      };

      // Start reading the stream
      await readChunk();
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
      streamIntervalRef.current = null;
    }
    setStreamingMessage(prev => prev ? {
      ...prev,
      isComplete: true,
      isStreaming: false
    } : null);
  }, []);

  const clearStreamingMessage = useCallback(() => {
    console.log('🗑️ CLIENT DEBUG: Clearing streaming message');
    setStreamingMessage(null);
  }, []);

  return {
    streamingMessage,
    startStreaming,
    stopStreaming,
    clearStreamingMessage
  };
} 