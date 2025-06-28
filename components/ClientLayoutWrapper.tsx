'use client'

import { PeopleProvider } from '@/lib/contexts/people-context'
import { TopicsProvider } from '@/lib/contexts/topics-context'
import { ResponsiveLayout } from '@/components/ResponsiveLayout'

interface ClientLayoutWrapperProps {
  children: React.ReactNode
}

export function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  return (
    <PeopleProvider>
      <TopicsProvider>
        <ResponsiveLayout>
          {children}
        </ResponsiveLayout>
      </TopicsProvider>
    </PeopleProvider>
  )
}