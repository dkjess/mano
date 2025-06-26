/**
 * General Topic Management - Server Side
 * Server-side functions for managing the General topic
 */

import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeneralTopic } from './general-topic-shared';

/**
 * Gets or creates the General topic for a user (server-side)
 * @param userId - The user's ID
 * @param supabase - Optional Supabase client (will create server client if not provided)
 * @returns The General topic for the user
 */
export async function getOrCreateGeneralTopic(
  userId: string, 
  supabase?: SupabaseClient
): Promise<GeneralTopic> {
  const client = supabase || await createClient();
  
  // First, try to find existing General topic
  const { data: existingTopic, error: findError } = await client
    .from('topics')
    .select('*')
    .eq('created_by', userId)
    .eq('title', 'General')
    .single();

  if (existingTopic && !findError) {
    return existingTopic;
  }

  // If no existing topic found, create a new one
  const { data: newTopic, error: createError } = await client
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

/**
 * Gets the General topic ID for a user (throws if not found)
 * @param userId - The user's ID
 * @param supabase - Optional Supabase client
 * @returns The General topic ID
 */
export async function getGeneralTopicId(
  userId: string, 
  supabase?: SupabaseClient
): Promise<string> {
  const topic = await getOrCreateGeneralTopic(userId, supabase);
  return topic.id;
}

/**
 * Checks if a topic is the General topic for a user
 * @param topicId - The topic ID to check
 * @param userId - The user's ID
 * @param supabase - Optional Supabase client
 * @returns True if this is the user's General topic
 */
export async function isGeneralTopic(
  topicId: string, 
  userId: string, 
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase || await createClient();
  
  const { data: topic } = await client
    .from('topics')
    .select('title, created_by')
    .eq('id', topicId)
    .single();

  return topic?.title === 'General' && topic?.created_by === userId;
}