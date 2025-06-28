'use client'

import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface ConversationHeaderProps {
  title: string
  subtitle?: string
  rightAction?: React.ReactNode
}

export function ConversationHeader({ title, subtitle, rightAction }: ConversationHeaderProps) {
  return (
    <>
      {/* Mobile Header - Only visible on mobile */}
      <header className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center flex-1">
            <Link
              href="/conversations"
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors mr-3"
              aria-label="Back to conversations"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </Link>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-gray-500 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {rightAction && (
            <div className="ml-3 flex-shrink-0">
              {rightAction}
            </div>
          )}
        </div>
      </header>

      {/* Desktop Header - Only visible on desktop */}
      <header className="hidden lg:block bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-gray-600 mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            
            {rightAction && (
              <div>
                {rightAction}
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  )
}