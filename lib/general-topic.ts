/**
 * General Topic Management - Client Side
 * Client-side functions for managing the General topic
 */

import { createClient } from '@/lib/supabase/client';
import type { GeneralTopic } from './general-topic-shared';

/**
 * Client-side version for use in React components
 * Uses the client-side Supabase instance
 */
export async function getOrCreateGeneralTopicClient(userId: string): Promise<GeneralTopic> {
  const supabase = createClient();
  
  // First, try to find existing General topic
  const { data: existingTopic, error: findError } = await supabase
    .from('topics')
    .select('*')
    .eq('created_by', userId)
    .eq('title', 'General')
    .single();

  if (existingTopic && !findError) {
    return existingTopic;
  }

  // If no existing topic found, create a new one
  const { data: newTopic, error: createError } = await supabase
    .from('topics')
    .insert({
      title: 'General',
      description: 'Management coaching and strategic thinking space',
      participants: [],
      created_by: userId,
      status: 'active'
    })
    .select()
    .single();

  if (createError) {
    console.error('Error creating General topic:', createError);
    throw new Error(`Failed to create General topic: ${createError.message}`);
  }

  if (!newTopic) {
    throw new Error('Failed to create General topic: No data returned');
  }

  return newTopic;
}

// Re-export the shared types
export type { GeneralTopic } from './general-topic-shared';