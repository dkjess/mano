import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMessages, createMessage } from '@/lib/database';
import { getChatCompletionStreaming } from '@/lib/claude';
import { gatherManagementContext } from '@/lib/management-context';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { person_id, message: userMessage } = body;

    if (!person_id || !userMessage) {
      return new Response('person_id and message are required', { status: 400 });
    }

    // Handle special case for 'general' assistant
    let person;
    if (person_id === 'general') {
      person = {
        id: 'general',
        name: 'general',
        role: 'Management Assistant',
        relationship_type: 'assistant'
      };
    } else {
      // Get person details
      const { data: personData, error: personError } = await supabase
        .from('people')
        .select('*')
        .eq('id', person_id)
        .eq('user_id', user.id)
        .single();

      if (personError || !personData) {
        return new Response('Person not found', { status: 404 });
      }
      
      person = personData;
    }

    // Get conversation history
    const conversationHistory = await getMessages(person_id, supabase);

    // Gather management context for "one brain" awareness
    let managementContext;
    try {
      managementContext = await gatherManagementContext(user.id, person_id, supabase);
    } catch (contextError) {
      console.warn('Failed to gather management context, proceeding without it:', contextError);
      managementContext = undefined;
    }

    // Save user message first
    const userMessageRecord = await createMessage({
      person_id,
      content: userMessage,
      is_user: true
    }, supabase);

    try {
      // Get Claude's streaming response with management context
      const stream = await getChatCompletionStreaming(
        userMessage,
        person.name,
        person.role,
        person.relationship_type,
        conversationHistory,
        managementContext
      );

      // Create a ReadableStream to handle the streaming response
      const readableStream = new ReadableStream({
        async start(controller) {
          let fullResponse = '';
          const encoder = new TextEncoder();
          
          // Send initial message ID
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'start', 
            userMessageId: userMessageRecord.id 
          })}\n\n`));

          try {
            for await (const chunk of stream) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                const text = chunk.delta.text;
                fullResponse += text;
                
                // Send the text chunk to the client
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'delta', 
                  text 
                })}\n\n`));
              }
            }

            // Save the complete response to database
            const assistantMessage = await createMessage({
              person_id,
              content: fullResponse,
              is_user: false
            }, supabase);

            // Send completion message
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'complete', 
              assistantMessageId: assistantMessage.id,
              fullResponse 
            })}\n\n`));

          } catch (error: any) {
            console.error('Claude streaming API error:', error);
            
            // Create error message based on error type
            let errorMessage = '';
            switch (error.message) {
              case 'RATE_LIMIT':
                errorMessage = '🤚 I\'m getting too many requests right now. Let\'s try again in a moment!';
                break;
              case 'SERVER_ERROR':
                errorMessage = '🤷 I\'m having some technical difficulties. Mind trying that again?';
                break;
              case 'AUTH_ERROR':
                errorMessage = '🔑 There\'s an authentication issue with my AI service. Please contact support.';
                break;
              default:
                errorMessage = '🤔 Something went wrong on my end. Would you like to try sending that message again?';
            }

            // Save error message
            const errorMessageRecord = await createMessage({
              person_id,
              content: errorMessage,
              is_user: false
            }, supabase);

            // Send error to client
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'error', 
              error: errorMessage,
              assistantMessageId: errorMessageRecord.id,
              shouldRetry: error.message !== 'AUTH_ERROR'
            })}\n\n`));
          }

          controller.close();
        }
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });

    } catch (error) {
      console.error('Error in streaming chat API:', error);
      return new Response('Internal server error', { status: 500 });
    }

  } catch (error) {
    console.error('Error in streaming chat API:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 