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
  
  // First, try to find existing General topic(s)
  const { data: existingTopics, error: findError } = await client
    .from('topics')
    .select('*')
    .eq('created_by', userId)
    .eq('title', 'General')
    .order('created_at', { ascending: true })
    .limit(1);

  if (!findError && existingTopics && existingTopics.length > 0) {
    return existingTopics[0];
  }

  // If no existing topic found, try to create a new one
  // Use a transaction to prevent race conditions
  try {
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
      // If creation failed due to race condition, try to find the existing one again
      const { data: raceTopics } = await client
        .from('topics')
        .select('*')
        .eq('created_by', userId)
        .eq('title', 'General')
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (raceTopics && raceTopics.length > 0) {
        return raceTopics[0];
      }
      
      console.error('Error creating General topic:', createError);
      throw new Error(`Failed to create General topic: ${createError.message}`);
    }

    if (!newTopic) {
      throw new Error('Failed to create General topic: No data returned');
    }

    return newTopic;
  } catch (error) {
    // Final fallback - try to find any existing General topic
    const { data: fallbackTopics } = await client
      .from('topics')
      .select('*')
      .eq('created_by', userId)
      .eq('title', 'General')
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (fallbackTopics && fallbackTopics.length > 0) {
      return fallbackTopics[0];
    }
    
    throw error;
  }
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