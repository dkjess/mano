'use client'

import React from 'react';
import { usePathname } from 'next/navigation';
import { MobileLayout } from '@/components/MobileLayout';
import Link from 'next/link';

interface TopicsLayoutProps {
  children: React.ReactNode;
}

export default function TopicsLayout({ children }: TopicsLayoutProps) {
  const pathname = usePathname();
  
  // Determine the page type for appropriate mobile layout
  const isNewTopicPage = pathname === '/topics/new';
  const isTopicDetailPage = pathname.startsWith('/topics/') && pathname !== '/topics/new';

  // For individual topic pages, don't wrap - they handle their own mobile layout
  if (isTopicDetailPage) {
    return <>{children}</>;
  }

  // For new topic form page, provide form-optimized mobile layout
  if (isNewTopicPage) {
    return (
      <>
        {/* Desktop: Direct content, sidebar handled by root layout */}
        <div className="hidden lg:block">
          {children}
        </div>

        {/* Mobile: Use MobileLayout with form-specific header */}
        <div className="lg:hidden">
          <MobileLayout
            title="Create Topic"
            subtitle="Start a focused discussion"
            showBackButton={true}
            backHref="/conversations"
          >
            {children}
          </MobileLayout>
        </div>
      </>
    );
  }

  // Default fallback for any other topics routes
  return <>{children}</>;
} 