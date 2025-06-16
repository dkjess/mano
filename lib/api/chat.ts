import { createClient } from '@/lib/supabase/client'

export interface ChatResponse {
  userMessage: any;
  assistantMessage: any;
  shouldRetry?: boolean;
}

export async function sendChatMessage(
  personId: string,
  message: string
): Promise<ChatResponse> {
  const supabase = createClient()

  // Get current session for auth
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  // Call edge function
  const { data, error } = await supabase.functions.invoke('chat', {
    body: {
      person_id: personId,
      message: message
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  })

  if (error) {
    console.error('Chat API error:', error)
    throw new Error(error.message || 'Failed to send message')
  }

  return data
} 