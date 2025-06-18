"use client";

import { useState } from 'react';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { EnhancedChatInput } from '@/components/chat/EnhancedChatInput';
import { MessageBubble } from '@/components/chat/MessageBubble';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  isLoading?: boolean;
  timestamp: Date;
}

// Example integration component showing how to use the enhanced chat components
export function ExampleChatIntegration({ personId }: { personId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (content: string) => {
    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    // Add loading message for Mano
    const loadingMessage: Message = {
      id: `loading-${Date.now()}`,
      content: '',
      isUser: false,
      isLoading: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, loadingMessage]);
    
    try {
      // Replace with your actual API call
      const response = await sendMessage(content, personId);
      
      // Replace loading message with actual response
      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessage.id 
            ? { ...msg, content: response.content, isLoading: false }
            : msg
        )
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      // Handle error state - remove loading message
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ChatLayout
      header={<ChatHeader personId={personId} />}
      input={
        <EnhancedChatInput 
          onSend={handleSendMessage}
          disabled={isLoading}
          placeholder="Ask Mano anything..."
        />
      }
    >
      {messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-emoji">💬</div>
          <h3 className="empty-state-title">Start the conversation</h3>
          <p className="empty-state-subtitle">
            Begin your conversation with enhanced input and smooth interactions
          </p>
        </div>
      ) : (
        messages.map(message => (
          <MessageBubble
            key={message.id}
            content={message.content}
            isUser={message.isUser}
            isLoading={message.isLoading}
            timestamp={message.timestamp}
            avatar={message.isUser ? undefined : '✋'}
          />
        ))
      )}
    </ChatLayout>
  );
}

// Example chat header component
function ChatHeader({ personId }: { personId: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold">
          {personId === 'general' ? '🤲 General' : `✋ ${personId}`}
        </h1>
        <p className="text-sm text-gray-600">
          Enhanced chat with auto-growing input
        </p>
      </div>
    </div>
  );
}

// Mock API function - replace with your actual implementation
async function sendMessage(content: string, personId: string) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  return {
    content: `This is a mock response to: "${content}"`,
    timestamp: new Date()
  };
} 