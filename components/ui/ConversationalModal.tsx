'use client'

import { ReactNode } from 'react'

interface ConversationalModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

export function ConversationalModal({ isOpen, onClose, children }: ConversationalModalProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 bg-white"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif' }}
    >
      <div className="flex justify-center pt-20 px-4">
        <div className="w-full max-w-sm">
          {children}
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}