'use client'

import { useRef } from 'react'
import type { SidebarRef } from '@/components/Sidebar'

export function useSidebar() {
  const sidebarRef = useRef<SidebarRef>(null)

  const toggleSidebar = () => {
    console.log('🔄 Toggle sidebar called from page')
    sidebarRef.current?.toggleSidebar()
  }

  return {
    toggleSidebar,
    sidebarRef
  }
} 