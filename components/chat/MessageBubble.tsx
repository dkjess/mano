"use client";

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageFile } from '@/types/database';

interface MessageBubbleProps {
  content: string;
  isUser: boolean;
  messageId?: string; // For fetching files
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
  messageId,
  files = [],
  isLoading = false,
  isStreaming = false,
  timestamp,
  avatar,
  onComplete
}: MessageBubbleProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [showCursor, setShowCursor] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [messageFiles, setMessageFiles] = useState<MessageFile[]>(files);
  const [loadingFiles, setLoadingFiles] = useState(false);

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

  // Fetch files for this message
  useEffect(() => {
    if (messageId && !isLoading && !isStreaming && messageFiles.length === 0) {
      setLoadingFiles(true);
      fetch(`/api/files/${messageId}`)
        .then(response => response.json())
        .then(data => {
          if (data.success && data.files) {
            setMessageFiles(data.files);
          }
        })
        .catch(error => {
          console.error('Failed to fetch message files:', error);
        })
        .finally(() => {
          setLoadingFiles(false);
        });
    }
  }, [messageId, isLoading, isStreaming, messageFiles.length]);

  // Copy to clipboard functionality
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 500);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  if (isUser) {
    return (
      <div 
        className="message-user relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="message-user-label">YOU</div>
        <div className="message-user-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        
        {/* Copy button for user messages */}
        {isHovered && content && (
          <div className="copy-button-container">
            <button
              onClick={handleCopy}
              className="p-1 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-gray-600 hover:text-gray-800 transition-colors"
              aria-label="Copy message"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="m5 15-4-4v-8a2 2 0 0 1 2-2h8l4 4"></path>
              </svg>
            </button>
            
            {/* Copied confirmation */}
            {showCopied && (
              <div className="absolute top-full right-0 mt-1 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap animate-fade-out">
                Copied
              </div>
            )}
          </div>
        )}
        
        {/* File attachments for user messages */}
        {messageFiles.length > 0 && (
          <div className="message-attachments">
            {messageFiles.map(file => (
              <MessageFileAttachment key={file.id} file={file} />
            ))}
          </div>
        )}
        
        {/* Loading indicator for files */}
        {loadingFiles && (
          <div className="message-files-loading">
            <span className="text-sm text-gray-500">Loading attachments...</span>
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
    <div 
      className="message-assistant relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
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
        {messageFiles.length > 0 && !isLoading && (
          <div className="message-attachments">
            {messageFiles.map(file => (
              <MessageFileAttachment key={file.id} file={file} />
            ))}
          </div>
        )}
        
        {/* Loading indicator for files */}
        {loadingFiles && !isLoading && (
          <div className="message-files-loading">
            <span className="text-sm text-gray-500">Loading attachments...</span>
          </div>
        )}
        
        {timestamp && !isLoading && !isStreaming && (
          <div className="message-timestamp">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
      
      {/* Copy button for assistant messages */}
      {isHovered && content && !isLoading && (
        <div className="copy-button-container">
          <button
            onClick={handleCopy}
            className="p-1 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-gray-600 hover:text-gray-800 transition-colors"
            aria-label="Copy message"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="m5 15-4-4v-8a2 2 0 0 1 2-2h8l4 4"></path>
            </svg>
          </button>
          
          {/* Copied confirmation */}
          {showCopied && (
            <div className="absolute top-full right-0 mt-1 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap animate-fade-out">
              Copied
            </div>
          )}
        </div>
      )}
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

  // Get file icon based on file type and content type
  const getIcon = () => {
    if (file.icon) return file.icon;
    
    switch (file.file_type) {
      case 'image':
        return '🖼️';
      case 'document':
        if (file.content_type?.includes('pdf')) return '📄';
        if (file.content_type?.includes('word')) return '📝';
        if (file.content_type?.includes('presentation')) return '📊';
        return '📄';
      case 'transcript':
        return '📝';
      default:
        return '📎';
    }
  };

  return (
    <div className="message-file-attachment">
      <div className="file-attachment-content">
        <span className="file-attachment-icon">{getIcon()}</span>
        <div className="file-attachment-details">
          <div className="file-attachment-name">{file.original_name}</div>
          <div className="file-attachment-meta">
            {file.file_type.toUpperCase()} • {formatFileSize(file.file_size)}
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