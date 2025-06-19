"use client";

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

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

  if (isUser) {
    return (
      <div className="message-user">
        <div className="message-user-label">YOU</div>
        <div className="message-user-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        {timestamp && (
          <div className="message-timestamp">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="message-assistant">
      <div className="message-assistant-emoji">
        {avatar || '✋'}
      </div>
      <div className="message-assistant-content">
        {isLoading ? (
          <ManoThinkingLoader />
        ) : (
          <div className="message-content-wrapper">
            <div className="message-text-content">
              <ReactMarkdown>{displayedContent}</ReactMarkdown>
            </div>
            {showCursor && (
              <span className="typing-cursor">|</span>
            )}
          </div>
        )}
        {timestamp && !isLoading && !isStreaming && (
          <div className="message-timestamp">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
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
    <div className="message-loading">
      <div className="message-loading-emoji">✋</div>
      <div className="message-loading-dots">
        Mano is thinking{dots}
      </div>
    </div>
  );
} 