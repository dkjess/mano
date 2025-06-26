'use client'

import { PeopleProvider } from '@/lib/contexts/people-context'
import { ResponsiveLayout } from '@/components/ResponsiveLayout'

interface ClientLayoutWrapperProps {
  children: React.ReactNode
}

export function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  return (
    <PeopleProvider>
      <ResponsiveLayout>
        {children}
      </ResponsiveLayout>
    </PeopleProvider>
  )
}