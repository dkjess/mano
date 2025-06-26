/**
 * Navigation helper functions for consistent routing
 */

import { createClient } from '@/lib/supabase/client';
import { getOrCreateGeneralTopicClient } from '@/lib/general-topic';

/**
 * Get the URL for the user's General topic
 * @param userId - Optional user ID (will fetch current user if not provided)
 * @returns The URL path to the General topic or /conversations if not found
 */
export async function getGeneralTopicUrl(userId?: string): Promise<string> {
  try {
    const supabase = createClient();
    
    // Get current user if not provided
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return '/conversations';
      userId = user.id;
    }
    
    // Get or create the General topic
    const generalTopic = await getOrCreateGeneralTopicClient(userId);
    return `/topics/${generalTopic.id}`;
    
  } catch (error) {
    console.error('Error getting General topic URL:', error);
    return '/conversations';
  }
}

/**
 * Get the appropriate home URL based on device type
 * @returns The home URL path
 */
export async function getHomeUrl(): Promise<string> {
  // On mobile, go to conversations list
  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    return '/conversations';
  }
  
  // On desktop, go to General topic
  return getGeneralTopicUrl();
}