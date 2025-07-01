'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'

interface ResponsiveLayoutProps {
  children: React.ReactNode
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const pathname = usePathname()
  
  // Determine if we should show the sidebar based on the current route
  const shouldShowSidebar = () => {
    // Don't show sidebar on auth pages, landing pages, onboarding, or conversations page
    if (pathname.startsWith('/auth/') || 
        pathname.startsWith('/protected/') ||
        pathname.startsWith('/onboarding') ||
        pathname === '/sign-up' ||
        pathname === '/' ||
        pathname === '/conversations') {
      return false
    }
    
    // Show sidebar on all other app pages on desktop
    return true
  }

  // Get current conversation context for sidebar highlighting
  const getCurrentContext = () => {
    const segments = pathname.split('/')
    
    if (segments[1] === 'people' && segments[2]) {
      return { currentPersonId: segments[2] }
    }
    
    if (segments[1] === 'topics' && segments[2]) {
      return { currentTopicId: segments[2] }
    }
    
    return {}
  }

  const context = getCurrentContext()
  const showSidebar = shouldShowSidebar()

  if (!showSidebar) {
    // Pages that don't need sidebar (auth, landing, etc.)
    return <>{children}</>
  }

  return (
    <>
      {/* Desktop Layout: Always show sidebar on lg+ screens */}
      <div className="hidden lg:flex min-h-screen bg-gray-50">
        <Sidebar 
          currentPersonId={context.currentPersonId}
          currentTopicId={context.currentTopicId}
        />
        <main className="flex-1 overflow-hidden bg-white">
          {children}
        </main>
      </div>

      {/* Mobile Layout: Never show sidebar, full-width content */}
      <div className="lg:hidden min-h-screen">
        {children}
      </div>
    </>
  )
}