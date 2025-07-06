'use client'

interface MobileLayoutProps {
  children: React.ReactNode
  className?: string
}

export function MobileLayout({ 
  children,
  className = ""
}: MobileLayoutProps) {
  return (
    <div className={`mobile-layout lg:hidden flex flex-col h-screen bg-white ${className}`}>
      {/* Mobile Content - No header, let children handle their own headers */}
      <main className="mobile-content flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}

// Note: ConversationMobileLayout removed - conversations now use ConversationHeader directly

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