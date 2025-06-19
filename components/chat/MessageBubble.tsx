"use client";

import { useState, useEffect } from 'react';

interface MessageBubbleProps {
  content: string;
  isUser: boolean;
  isLoading?: boolean;
  isStreaming?: boolean;
  timestamp?: Date;
  avatar?: string;
  onComplete?: () => void;
}

export function MessageBubble({ 
  content, 
  isUser, 
  isLoading = false,
  isStreaming = false,
  timestamp,
  avatar,
  onComplete
}: MessageBubbleProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [showCursor, setShowCursor] = useState(false);

  // Handle streaming content
  useEffect(() => {
    if (isStreaming) {
      setDisplayedContent(content);
      setShowCursor(true);
    } else if (!isLoading) {
      setDisplayedContent(content);
      setShowCursor(false);
      onComplete?.();
    }
  }, [content, isStreaming, isLoading, onComplete]);

  return (
    <div className={`message-bubble ${isUser ? 'user-message' : 'assistant-message'}`}>
      <div className="message-content">
        {!isUser && (
          <div className="message-avatar">
            {avatar || '✋'}
          </div>
        )}
        
        <div className="message-body">
          <div className="message-text">
            {isLoading ? (
              <ManoThinkingLoader />
            ) : (
              <div className="message-content-wrapper">
                <span className="message-text-content">
                  {displayedContent}
                </span>
                {showCursor && (
                  <span className="typing-cursor">|</span>
                )}
              </div>
            )}
          </div>
          
          {timestamp && !isLoading && !isStreaming && (
            <div className="message-timestamp">
              {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ManoThinkingLoader() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mano-thinking">
      <div className="thinking-content">
        <span className="thinking-emoji">✋</span>
        <span className="thinking-text">Mano is thinking{dots}</span>
      </div>
      <div className="thinking-animation">
        <div className="thinking-pulse"></div>
      </div>
    </div>
  );
} 