import { createClient } from '@/lib/supabase/client'

export async function streamChatResponse(
  message: string, 
  personId: string,
  signal?: AbortSignal,
  options?: {
    topicId?: string;
    hasFiles?: boolean;
    isTopicConversation?: boolean;
    topicTitle?: string;
  }
): Promise<ReadableStream<Uint8Array>> {
  const supabase = createClient()
  
  // Get the current session for authentication
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.access_token) {
    throw new Error('No authenticated session found')
  }

  // Make direct fetch call to Supabase Edge Function for streaming
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    },
    body: JSON.stringify({
      action: 'streaming_chat',
      person_id: personId,
      message,
      topicId: options?.topicId,
      hasFiles: options?.hasFiles,
      isTopicConversation: options?.isTopicConversation,
      topicTitle: options?.topicTitle
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  return response.body
}

// Helper function to parse Server-Sent Events
export function parseSSEStream(stream: ReadableStream<Uint8Array>): ReadableStream<string> {
  const decoder = new TextDecoder();
  
  return new ReadableStream({
    start(controller) {
      const reader = stream.getReader();
      let buffer = '';

      function pump(): Promise<void> {
        return reader.read().then(({ done, value }) => {
          if (done) {
            // Process any remaining buffer
            if (buffer.trim()) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data !== '[DONE]') {
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.type === 'delta' && parsed.text) {
                        controller.enqueue(parsed.text);
                      }
                    } catch (e) {
                      // If not JSON, treat as plain text
                      controller.enqueue(data);
                    }
                  }
                }
              }
            }
            controller.close();
            return;
          }

          // Decode the chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data !== '[DONE]') {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === 'delta' && parsed.text) {
                    controller.enqueue(parsed.text);
                  }
                } catch (e) {
                  // If not JSON, treat as plain text
                  controller.enqueue(data);
                }
              }
            }
          }

          return pump();
        });
      }

      return pump();
    }
  });
}

// Mock streaming removed - now using real API responses 