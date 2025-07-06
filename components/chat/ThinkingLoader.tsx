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

export function ThinkingLoader() {
  const [message] = useState(() => {
    // Pick a random message when component mounts
    return THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];
  });
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
    <div className="message-assistant">
      <div className="message-assistant-content">
        <div className="message-loading">
          <div className="message-text-content">
            {message}{dots}
          </div>
        </div>
      </div>
    </div>
  );
}