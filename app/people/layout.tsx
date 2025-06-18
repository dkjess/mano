"use client";

import React from 'react';
import { PeopleProvider } from '@/lib/contexts/people-context';

interface PeopleLayoutProps {
  children: React.ReactNode;
}

export default function PeopleLayout({ children }: PeopleLayoutProps) {
  return (
    <PeopleProvider>
      {children}
    </PeopleProvider>
  );
} 