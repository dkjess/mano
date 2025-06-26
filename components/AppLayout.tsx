'use client'

import { Sidebar } from '@/components/Sidebar'
import { MobileLayout, ConversationMobileLayout } from '@/components/MobileLayout'

interface AppLayoutProps {
  children: React.ReactNode
  currentPersonId?: string
  currentTopicId?: string
}

export function AppLayout({ children, currentPersonId, currentTopicId }: AppLayoutProps) {
  return (
    <>
      {/* Desktop Layout with Sidebar */}
      <div className="hidden lg:flex conversation-app">
        <Sidebar 
          currentPersonId={currentPersonId}
          currentTopicId={currentTopicId}
        />
        <main className="main-content flex-1">
          {children}
        </main>
      </div>

      {/* Mobile Layout - children handle their own mobile layout */}
      <div className="lg:hidden">
        {children}
      </div>
    </>
  )
}

// Specialized layout for conversation pages
interface ConversationAppLayoutProps {
  children: React.ReactNode
  currentPersonId?: string
  currentTopicId?: string
  // Mobile-specific props
  personName?: string
  personRole?: string
  topicTitle?: string
  topicDescription?: string
  mobileRightAction?: React.ReactNode
}

export function ConversationAppLayout({ 
  children, 
  currentPersonId, 
  currentTopicId,
  personName,
  personRole,
  topicTitle,
  topicDescription,
  mobileRightAction
}: ConversationAppLayoutProps) {
  return (
    <>
      {/* Desktop Layout with Sidebar */}
      <div className="hidden lg:flex conversation-app">
        <Sidebar 
          currentPersonId={currentPersonId}
          currentTopicId={currentTopicId}
        />
        <main className="main-content flex-1">
          {children}
        </main>
      </div>

      {/* Mobile Layout with Conversation Header */}
      <ConversationMobileLayout
        personName={personName}
        personRole={personRole}
        topicTitle={topicTitle}
        topicDescription={topicDescription}
        rightAction={mobileRightAction}
      >
        {children}
      </ConversationMobileLayout>
    </>
  )
}