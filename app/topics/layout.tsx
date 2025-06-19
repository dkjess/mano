"use client";

import React from 'react';
import { PeopleProvider } from '@/lib/contexts/people-context';

interface TopicsLayoutProps {
  children: React.ReactNode;
}

export default function TopicsLayout({ children }: TopicsLayoutProps) {
  return (
    <PeopleProvider>
      {children}
    </PeopleProvider>
  );
} 