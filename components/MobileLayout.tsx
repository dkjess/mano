'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'

interface MobileLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  showBackButton?: boolean
  backHref?: string
  rightAction?: React.ReactNode
}

export function MobileLayout({ 
  children, 
  title = "Mano", 
  subtitle,
  showBackButton = true,
  backHref = "/conversations",
  rightAction 
}: MobileLayoutProps) {
  const router = useRouter()

  const handleBackClick = () => {
    if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <div className="mobile-layout lg:hidden flex flex-col h-screen bg-white">
      {/* Mobile Header */}
      <header className="mobile-header flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="flex items-center flex-1">
          {showBackButton && (
            <button
              onClick={handleBackClick}
              className="mobile-back-button flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors mr-3"
              aria-label="Go back"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
          )}
          
          <div className="flex-1 min-w-0">
            <h1 className="mobile-title text-lg font-semibold text-gray-900 truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="mobile-subtitle text-sm text-gray-500 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {rightAction && (
          <div className="mobile-header-action ml-3">
            {rightAction}
          </div>
        )}
      </header>

      {/* Mobile Content */}
      <main className="mobile-content flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}

// Specialized layouts for common use cases

interface ConversationMobileLayoutProps {
  children: React.ReactNode
  personName?: string
  personRole?: string
  topicTitle?: string
  topicDescription?: string
  rightAction?: React.ReactNode
}

export function ConversationMobileLayout({ 
  children, 
  personName, 
  personRole,
  topicTitle,
  topicDescription,
  rightAction 
}: ConversationMobileLayoutProps) {
  // Determine title and subtitle based on conversation type
  const title = personName || topicTitle || "Conversation"
  const subtitle = personName ? personRole : topicDescription

  return (
    <MobileLayout
      title={title}
      subtitle={subtitle}
      showBackButton={true}
      backHref="/conversations"
      rightAction={rightAction}
    >
      {children}
    </MobileLayout>
  )
}

// Mobile-specific conversation list item component
interface ConversationListItemProps {
  title: string
  subtitle?: string
  emoji?: string
  href: string
  isActive?: boolean
  lastMessage?: string
  timestamp?: string
}

export function ConversationListItem({
  title,
  subtitle,
  emoji = "💬",
  href,
  isActive = false,
  lastMessage,
  timestamp
}: ConversationListItemProps) {
  return (
    <Link
      href={href}
      className={`conversation-list-item block px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isActive ? 'bg-blue-50 border-blue-200' : ''
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className="conversation-emoji text-2xl flex-shrink-0">
          {emoji}
        </div>
        
        <div className="conversation-content flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="conversation-title text-base font-medium text-gray-900 truncate">
              {title}
            </h3>
            {timestamp && (
              <span className="conversation-timestamp text-xs text-gray-500 ml-2 flex-shrink-0">
                {timestamp}
              </span>
            )}
          </div>
          
          {subtitle && (
            <p className="conversation-subtitle text-sm text-gray-600 truncate mt-0.5">
              {subtitle}
            </p>
          )}
          
          {lastMessage && (
            <p className="conversation-preview text-sm text-gray-500 truncate mt-1">
              {lastMessage}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}