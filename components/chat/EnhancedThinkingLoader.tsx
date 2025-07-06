"use client";

import { useState, useEffect } from 'react';

const THINKING_MESSAGES = [
  "✍️ Thinking this through",
  "✍️ Pulling it all together",
  "✍️ Making sense of things",
  "✍️ Reviewing what matters",
  "✍️ Finding the best way forward",
  "✍️ Connecting the dots",
  "✍️ Gathering your thoughts",
  "✍️ Processing your request",
  "✍️ Getting things ready for you",
  "✍️ Organizing your insights",
  "✍️ Reflecting on what we know",
  "✍️ Piecing it together",
  "✍️ Summarizing behind the scenes",
  "✍️ Preparing your next step",
  "✍️ Bringing the big picture into focus",
  "✍️ Loading your knowledge base",
  "✍️ Deep in thought",
  "✍️ Almost ready",
  "✍️ Scanning what's relevant",
  "✍️ Looking into it"
];

const FILE_PROCESSING_MESSAGES = [
  "📎 Storing and processing files for context",
  "📄 Analyzing your documents",
  "🔍 Extracting insights from files",
  "📊 Processing attachments"
];

interface EnhancedThinkingLoaderProps {
  hasFiles?: boolean;
  fileCount?: number;
}

export function EnhancedThinkingLoader({ hasFiles = false, fileCount = 0 }: EnhancedThinkingLoaderProps) {
  const [currentMessage, setCurrentMessage] = useState('');
  const [dots, setDots] = useState('');
  const [phase, setPhase] = useState<'file' | 'thinking'>('file');

  useEffect(() => {
    // Initialize with appropriate message
    if (hasFiles) {
      // Start with file processing message
      const fileMessage = fileCount > 1 
        ? `📎 Storing and processing ${fileCount} files for context`
        : FILE_PROCESSING_MESSAGES[Math.floor(Math.random() * FILE_PROCESSING_MESSAGES.length)];
      setCurrentMessage(fileMessage);
      setPhase('file');

      // After 1300ms, switch to thinking message
      const phaseTimer = setTimeout(() => {
        const thinkingMessage = THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];
        setCurrentMessage(thinkingMessage);
        setPhase('thinking');
        setDots(''); // Reset dots for smooth transition
      }, 1300);

      return () => clearTimeout(phaseTimer);
    } else {
      // No files, go straight to thinking message
      const thinkingMessage = THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];
      setCurrentMessage(thinkingMessage);
      setPhase('thinking');
    }
  }, [hasFiles, fileCount]);

  useEffect(() => {
    // Animate dots
    const interval = setInterval(() => {
      setDots(prev => {
        // Reset after 3 dots
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="message-assistant">
      <div className="message-assistant-content">
        <div className="message-loading">
          <div className="message-text-content">
            <span className={`thinking-message ${phase === 'file' ? 'file-phase' : 'thinking-phase'}`}>
              {currentMessage}{dots}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}