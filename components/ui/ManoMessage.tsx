'use client'

import { useState, useEffect } from 'react'

interface ManoMessageProps {
  message: string
  key?: string | number // To trigger animation when message changes
}

export function ManoMessage({ message, key }: ManoMessageProps) {
  const [showMessage, setShowMessage] = useState(false)

  // Animation trigger when message changes
  useEffect(() => {
    setShowMessage(false)
    const timer = setTimeout(() => setShowMessage(true), 100)
    return () => clearTimeout(timer)
  }, [message, key])

  return (
    <div className="mb-8">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <span className="text-2xl">🤲</span>
        </div>
        <div 
          className={`flex-1 transform transition-all duration-300 ease-out ${
            showMessage ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
          }`}
        >
          <p className="text-base font-medium text-gray-800 leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}