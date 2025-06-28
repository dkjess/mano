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
  contextName?: string; // For dynamic placeholder
}

export function EnhancedChatInput({ 
  onSend, 
  disabled = false, 
  placeholder,
  files = [],
  onRemoveFile,
  onOpenFileDialog,
  contextName
}: EnhancedChatInputProps) {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const dynamicPlaceholder = placeholder || `Message Mano about ${contextName || 'this'}...`;

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
    
    // Calculate new height with max 120px
    const maxHeight = 120;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [message]);

  const handleSubmit = useCallback(() => {
    const trimmedMessage = message.trim();
    if ((!trimmedMessage && files.length === 0) || disabled || isSending) return;
    
    setIsSending(true);
    try {
      onSend(trimmedMessage, files);
      setMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      // Reset sending state after a brief delay to show visual feedback
      setTimeout(() => setIsSending(false), 100);
    }
  }, [message, files, disabled, isSending, onSend]);

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
    <div className="sticky bottom-0 bg-white border-t border-gray-200">
      {/* File previews above input */}
      {files.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 py-2">
          <FilePreviewList
            files={files}
            onRemove={onRemoveFile || (() => {})}
            isCompact={true}
          />
        </div>
      )}
      
      <div className="max-w-4xl mx-auto p-4">
        <div 
          className={`relative bg-gray-50 border border-gray-300 rounded-xl p-1 transition-all duration-150 ease-in-out ${
            isFocused ? 'border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.1)]' : ''
          }`}
          onTouchStart={handleTouchStart}
        >
          {/* Attachment button */}
          <button
            onClick={onOpenFileDialog}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-150 z-10"
            disabled={disabled || isSending}
            aria-label="Attach file"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
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
            placeholder={dynamicPlaceholder}
            disabled={disabled || isSending}
            className={`w-full bg-transparent border-none resize-none outline-none text-base leading-6 pl-12 pr-12 py-3 placeholder-gray-400 min-h-[44px] md:min-h-[48px] max-h-[120px] overflow-y-auto`}
            style={{ minHeight: window?.innerWidth >= 768 ? '48px' : '44px' }}
            rows={1}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Type your message"
          />
          
          <button
            onClick={handleSubmit}
            disabled={disabled || !hasContent || isSending}
            className={`absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 ease-in-out ${
              hasContent && !disabled && !isSending
                ? 'bg-blue-500 text-white hover:bg-blue-600 opacity-100'
                : 'bg-blue-500 text-white opacity-50 cursor-not-allowed'
            }`}
            aria-label="Send message"
            type="button"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


 