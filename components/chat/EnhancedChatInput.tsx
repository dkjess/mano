"use client";

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);



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

  const handleSubmit = () => {
    const trimmedMessage = message.trim();
    if ((!trimmedMessage && files.length === 0) || disabled) return;
    
    onSend(trimmedMessage, files);
    setMessage('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (but not Shift+Enter or when composing)
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasContent = message.trim() || files.length > 0;

  return (
    <div className="enhanced-chat-input">
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
      
      <div className="input-container">
        {/* Attachment button */}
        <button
          onClick={onOpenFileDialog}
          className="attachment-button"
          disabled={disabled}
          aria-label="Attach file"
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
          placeholder={placeholder}
          disabled={disabled}
          className="message-textarea"
          rows={1}
        />
        
        <button
          onClick={handleSubmit}
          disabled={disabled || !hasContent}
          className={`send-button ${hasContent ? 'enabled' : 'disabled'}`}
          aria-label="Send message"
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

 