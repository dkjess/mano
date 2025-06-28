"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface Topic {
  id: string;
  title: string;
  status: 'active' | 'archived';
  participants: string[];
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface TopicsContextType {
  topics: Topic[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createTopic: (title: string, participants?: string[]) => Promise<Topic | null>;
}

const TopicsContext = createContext<TopicsContextType | undefined>(undefined);

export function TopicsProvider({ children }: { children: ReactNode }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTopics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/topics');
      const data = await response.json();
      
      if (response.ok) {
        setTopics(data.topics || []);
      } else {
        throw new Error(data.error || 'Failed to fetch topics');
      }
    } catch (error) {
      console.error('Failed to fetch topics:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch topics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTopic = useCallback(async (title: string, participants: string[] = []): Promise<Topic | null> => {
    try {
      const response = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, participants })
      });

      const data = await response.json();
      
      if (response.ok) {
        const newTopic = data.topic;
        setTopics(prev => [newTopic, ...prev]);
        return newTopic;
      } else {
        throw new Error(data.error || 'Failed to create topic');
      }
    } catch (error) {
      console.error('Failed to create topic:', error);
      setError(error instanceof Error ? error.message : 'Failed to create topic');
      return null;
    }
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const value: TopicsContextType = {
    topics,
    isLoading,
    error,
    refetch: fetchTopics,
    createTopic
  };

  return (
    <TopicsContext.Provider value={value}>
      {children}
    </TopicsContext.Provider>
  );
}

export function useTopics(): TopicsContextType {
  const context = useContext(TopicsContext);
  if (context === undefined) {
    throw new Error('useTopics must be used within a TopicsProvider');
  }
  return context;
}