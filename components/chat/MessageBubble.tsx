"use client";

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageFile } from '@/types/database';

interface MessageBubbleProps {
  content: string;
  isUser: boolean;
  files?: MessageFile[];
  isLoading?: boolean;
  isStreaming?: boolean;
  timestamp?: Date;
  avatar?: string;
  onComplete?: () => void;
}

export function MessageBubble({ 
  content, 
  isUser, 
  files = [],
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
        
        {/* File attachments for user messages */}
        {files.length > 0 && (
          <div className="message-attachments">
            {files.map(file => (
              <MessageFileAttachment key={file.id} file={file} />
            ))}
          </div>
        )}
        
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
        
        {/* File attachments for assistant messages */}
        {files.length > 0 && !isLoading && (
          <div className="message-attachments">
            {files.map(file => (
              <MessageFileAttachment key={file.id} file={file} />
            ))}
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

function MessageFileAttachment({ file }: { file: MessageFile }) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="message-file-attachment">
      <div className="file-attachment-content">
        <span className="file-attachment-icon">{file.icon}</span>
        <div className="file-attachment-details">
          <div className="file-attachment-name">{file.name}</div>
          <div className="file-attachment-meta">
            {file.type.toUpperCase()} • {formatFileSize(file.size)}
          </div>
        </div>
      </div>
      {file.url && (
        <button 
          className="file-attachment-action"
          onClick={() => window.open(file.url, '_blank')}
          aria-label="View file"
        >
          👁️
        </button>
      )}
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