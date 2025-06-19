"use client";

import { useStreamingResponse } from '@/lib/hooks/useStreamingResponse';
import { useMessageState, type Message } from '@/lib/hooks/useMessageState';
import { streamChatResponse } from '@/lib/api/streaming';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { EnhancedChatInput } from '@/components/chat/EnhancedChatInput';
import { MessageBubble } from '@/components/chat/MessageBubble';

interface StreamingChatPageProps {
  personId: string;
  personName?: string;
}

export function StreamingChatPage({ 
  personId, 
  personName
}: StreamingChatPageProps) {
  const {
    messages,
    addUserMessage,
    addLoadingMessage,
    startStreamingMessage,
    completeStreamingMessage
  } = useMessageState();

  const {
    streamingMessage,
    startStreaming,
    clearStreamingMessage
  } = useStreamingResponse();

  const handleSendMessage = async (content: string) => {
    // Add user message immediately
    addUserMessage(content);
    
    // Add loading message
    const loadingId = addLoadingMessage();
    
    try {
      // Start streaming after a short delay (feels more natural)
      setTimeout(async () => {
        const streamingId = startStreamingMessage(loadingId);
        
        await startStreaming(streamingId, async () => {
          // Use real API streaming
          return await streamChatResponse(content, personId);
        });
      }, 800); // Short delay for Mano to "think"
      
    } catch (error) {
      console.error('Failed to send message:', error);
      // Handle error - maybe show error message or retry option
    }
  };

  // Combine regular messages with streaming message
  const allMessages: Message[] = [...messages];
  if (streamingMessage) {
    allMessages.push({
      id: streamingMessage.id,
      content: streamingMessage.content,
      isUser: false,
      timestamp: new Date(),
      isStreaming: streamingMessage.isStreaming,
      isComplete: streamingMessage.isComplete
    });
  }

  // Find if there's currently a loading message
  const hasLoadingMessage = messages.some(msg => msg.isLoading);
  const hasStreamingMessage = !!streamingMessage?.isStreaming;
  const isProcessing = hasLoadingMessage || hasStreamingMessage;

  return (
    <ChatLayout
      header={<StreamingChatHeader personId={personId} personName={personName} />}
      input={
        <EnhancedChatInput 
          onSend={handleSendMessage}
          disabled={isProcessing}
          placeholder={`Message ${personName || 'Mano'}...`}
        />
      }
    >
      {allMessages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-emoji">💬</div>
          <h3 className="empty-state-title">Start the conversation</h3>
          <p className="empty-state-subtitle">
            Experience smooth streaming responses with character-by-character display
          </p>
        </div>
      ) : (
        allMessages.map(message => (
          <MessageBubble
            key={message.id}
            content={message.content}
            isUser={message.isUser}
            isLoading={message.isLoading}
            isStreaming={message.isStreaming}
            timestamp={message.timestamp}
            avatar={message.isUser ? undefined : '✋'}
            onComplete={() => {
              if (streamingMessage?.id === message.id) {
                completeStreamingMessage(message.id, message.content);
                clearStreamingMessage();
              }
            }}
          />
        ))
      )}
    </ChatLayout>
  );
}

// Enhanced chat header with streaming status
function StreamingChatHeader({ 
  personId, 
  personName 
}: { 
  personId: string; 
  personName?: string; 
}) {
  const displayName = personName || (personId === 'general' ? 'General' : personId);
  const emoji = personId === 'general' ? '🤲' : '✋';

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold">
          {emoji} {displayName}
        </h1>
        <p className="text-sm text-gray-600">
          Enhanced streaming chat with smooth character-by-character responses
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Connected
        </div>
      </div>
    </div>
  );
}

// Export alias for backward compatibility
export function MockStreamingChatPage({ personId, personName }: { personId: string; personName?: string }) {
  return (
    <StreamingChatPage 
      personId={personId} 
      personName={personName} 
    />
  );
} 