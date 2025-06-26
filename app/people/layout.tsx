'use client'

import React from 'react';
import { usePathname } from 'next/navigation';
import { MobileLayout } from '@/components/MobileLayout';
import { PlusIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface PeopleLayoutProps {
  children: React.ReactNode;
}

export default function PeopleLayout({ children }: PeopleLayoutProps) {
  const pathname = usePathname();
  
  // Determine if this is a form page that needs mobile layout
  const isNewPersonPage = pathname === '/people/new';
  const isPeopleListPage = pathname === '/people';
  const isPersonDetailPage = pathname.startsWith('/people/') && pathname !== '/people/new';

  // For individual person pages, don't wrap - they handle their own mobile layout
  if (isPersonDetailPage) {
    return <>{children}</>;
  }

  // For people list page, provide mobile-optimized layout
  if (isPeopleListPage) {
    return (
      <>
        {/* Desktop: Direct content, sidebar handled by root layout */}
        <div className="hidden lg:block">
          {children}
        </div>

        {/* Mobile: Use MobileLayout with people-specific header */}
        <div className="lg:hidden">
          <MobileLayout
            title="Your People"
            subtitle="Manage relationships with your team"
            showBackButton={true}
            backHref="/conversations"
            rightAction={
              <Link
                href="/people/new"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                aria-label="Add person"
              >
                <PlusIcon className="w-5 h-5" />
              </Link>
            }
          >
            {children}
          </MobileLayout>
        </div>
      </>
    );
  }

  // For new person form page, provide form-optimized mobile layout
  if (isNewPersonPage) {
    return (
      <>
        {/* Desktop: Direct content, sidebar handled by root layout */}
        <div className="hidden lg:block">
          {children}
        </div>

        {/* Mobile: Use MobileLayout with form-specific header */}
        <div className="lg:hidden">
          <MobileLayout
            title="Add Person"
            subtitle="Add a team member or stakeholder"
            showBackButton={true}
            backHref="/people"
          >
            {children}
          </MobileLayout>
        </div>
      </>
    );
  }

  // Default fallback
  return <>{children}</>;
} 