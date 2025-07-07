"use client";

import { useParams } from 'next/navigation';
import { useTopics } from '@/lib/hooks/useTopics';
import { useUnifiedConversation } from '@/lib/hooks/useUnifiedConversation';
import { ConversationContainer } from '@/components/conversation/ConversationContainer';
import { TopicMenu } from '@/components/TopicMenu';

export default function TopicPage() {
  const params = useParams();
  const topicId = params.topicId as string;
  
  const { topics, refetch: refetchTopics } = useTopics();
  const {
    conversation: topic,
    messages,
    isLoading,
    error,
    sendMessage,
    refreshMessages,
    refreshConversation: refreshTopic
  } = useUnifiedConversation(topicId, 'topic');

  // Server-side intelligence handlers for topics
  const handleServerPersonSuggestions = (suggestions: any[]) => {
    console.log('🧠 SERVER TOPIC: Person suggestions received:', suggestions);
    // For topics, we could show person suggestions but don't have UI for it yet
    // This is where the intelligence benefits extend to topics automatically
  };

  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="loading-emoji">💬</div>
        <div className="loading-text">Loading topic...</div>
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="empty-state">
        <div className="empty-state-emoji">❌</div>
        <h3 className="empty-state-title">Topic not found</h3>
        <p className="empty-state-subtitle">
          {error || 'This topic may have been deleted or you may not have access to it.'}
        </p>
      </div>
    );
  }

  return (
    <ConversationContainer
      conversationId={topicId}
      conversationType="topic"
      header={{
        title: `💬 ${(topic as any).title}`,
        subtitle: '', // Could add participant names here in the future
        rightAction: (
          <TopicMenu 
            topic={topic as any} 
            onUpdate={refreshTopic}
            onRefetch={refetchTopics}
          />
        )
      }}
      features={{
        fileAttachments: true,
        topicManagement: true
      }}
      messages={messages}
      isLoading={isLoading}
      onSendMessage={sendMessage}
      onRefreshMessages={refreshMessages}
      onPersonSuggestions={handleServerPersonSuggestions}
    />
  );
}