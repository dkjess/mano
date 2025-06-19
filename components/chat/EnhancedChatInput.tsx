"use client";

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { StreamingChatPage } from '@/components/chat/StreamingChatPage';
import { useStreamingResponse } from '@/lib/hooks/useStreamingResponse';
import { useMessageState } from '@/lib/hooks/useMessageState';

interface EnhancedChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function EnhancedChatInput({ 
  onSend, 
  disabled = false, 
  placeholder = "Message Mano..." 
}: EnhancedChatInputProps) {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    streamingMessage,
    startStreaming,
    clearStreamingMessage
  } = useStreamingResponse();

  const {
    messages,
    addUserMessage,
    addLoadingMessage,
    startStreamingMessage
  } = useMessageState();

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
    if (!trimmedMessage || disabled) return;
    
    onSend(trimmedMessage);
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

  const isMessageEmpty = !message.trim();

  return (
    <div className="enhanced-chat-input">
      <div className="input-container">
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
          disabled={disabled || isMessageEmpty}
          className={`send-button ${isMessageEmpty ? 'disabled' : 'enabled'}`}
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

// Real streaming
<StreamingChatPage personId="123" personName="John" />

// Mock streaming for testing  
import { MockStreamingChatPage } from '@/components/chat/StreamingChatPage';
<MockStreamingChatPage personId="test" personName="Demo" /> 