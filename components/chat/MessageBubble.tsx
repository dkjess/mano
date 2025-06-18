"use client";

interface MessageBubbleProps {
  content: string;
  isUser: boolean;
  isLoading?: boolean;
  timestamp?: Date;
  avatar?: string;
}

export function MessageBubble({ 
  content, 
  isUser, 
  isLoading = false, 
  timestamp,
  avatar 
}: MessageBubbleProps) {
  return (
    <div className={`message-bubble ${isUser ? 'user-message' : 'assistant-message'}`}>
      <div className="message-content">
        {!isUser && (
          <div className="message-avatar">
            {avatar || '✋'}
          </div>
        )}
        
        <div className="message-body">
          <div className="message-text">
            {isLoading ? (
              <div className="message-loading">
                <LoadingDots />
              </div>
            ) : (
              content
            )}
          </div>
          
          {timestamp && (
            <div className="message-timestamp">
              {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="loading-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  );
} 