"use client";

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { DroppedFile } from '@/lib/hooks/useFileDropZone';
import { FilePreviewList } from './FilePreview';

interface EnhancedChatInputProps {
  onSend: (message: string, files?: DroppedFile[]) => void;
  disabled?: boolean;
  placeholder?: string;
  files?: DroppedFile[];
  onRemoveFile?: (fileId: string) => void;
  onOpenFileDialog?: () => void;
}

export function EnhancedChatInput({ 
  onSend, 
  disabled = false, 
  placeholder = "Message Mano...",
  files = [],
  onRemoveFile,
  onOpenFileDialog
}: EnhancedChatInputProps) {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle iOS Safari viewport height changes when keyboard appears
  useEffect(() => {
    const handleResize = () => {
      // Force layout recalculation on iOS when keyboard appears/disappears
      if (window.visualViewport) {
        const viewport = window.visualViewport;
        document.documentElement.style.setProperty('--viewport-height', `${viewport.height}px`);
      }
    };

    if (typeof window !== 'undefined' && window.visualViewport) {
      const viewport = window.visualViewport;
      viewport.addEventListener('resize', handleResize);
      return () => viewport.removeEventListener('resize', handleResize);
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to calculate new height
    textarea.style.height = 'auto';
    
    // Calculate new height (max 10 lines)
    const lineHeight = 24; // Adjust based on your line height
    const maxLines = 10;
    const maxHeight = lineHeight * maxLines;
    
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [message]);

  const handleSubmit = useCallback(() => {
    const trimmedMessage = message.trim();
    if ((!trimmedMessage && files.length === 0) || disabled) return;
    
    onSend(trimmedMessage, files);
    setMessage('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [message, files, disabled, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (but not Shift+Enter or when composing)
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  }, [isComposing, handleSubmit]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Scroll to input on mobile when focused
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setTimeout(() => {
        textareaRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 300); // Wait for keyboard animation
    }
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Prevent iOS Safari from interfering with touch events
    e.stopPropagation();
  }, []);

  const hasContent = message.trim() || files.length > 0;

  return (
    <div className={`enhanced-chat-input ${isFocused ? 'focused' : ''}`}>
      {/* File previews above input */}
      {files.length > 0 && (
        <div className="input-files-area">
          <FilePreviewList
            files={files}
            onRemove={onRemoveFile || (() => {})}
            isCompact={true}
          />
        </div>
      )}
      
      <div className="input-container" onTouchStart={handleTouchStart}>
        {/* Attachment button */}
        <button
          onClick={onOpenFileDialog}
          className="attachment-button"
          disabled={disabled}
          aria-label="Attach file"
          type="button"
        >
          📎
        </button>
        
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className="message-textarea"
          rows={1}
          // Mobile-specific attributes
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          // Ensure textarea is properly labeled for accessibility
          aria-label={placeholder}
        />
        
        <button
          onClick={handleSubmit}
          disabled={disabled || !hasContent}
          className={`send-button ${hasContent ? 'enabled' : 'disabled'}`}
          aria-label="Send message"
          type="button"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

// Simple send icon component
function SendIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 2-7 20-4-9-9-4z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

 