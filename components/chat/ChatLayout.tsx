"use client";

import { ReactNode } from 'react';

interface ChatLayoutProps {
  children: ReactNode;
  header?: ReactNode;
  input: ReactNode;
  className?: string;
}

export function ChatLayout({ children, header, input, className = '' }: ChatLayoutProps) {
  return (
    <div className={`chat-layout ${className}`}>
      {header && (
        <div className="chat-header">
          {header}
        </div>
      )}
      
      <div className="chat-messages-container">
        <div className="chat-messages">
          {children}
        </div>
      </div>
      
      <div className="chat-input-area">
        {input}
      </div>
    </div>
  );
} 