import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMessages, createMessage } from '@/lib/database';
import { getChatCompletion } from '@/lib/claude';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { person_id, message: userMessage } = body;

    if (!person_id || !userMessage) {
      return NextResponse.json({ error: 'person_id and message are required' }, { status: 400 });
    }

    // Get person details
    const { data: person, error: personError } = await supabase
      .from('people')
      .select('*')
      .eq('id', person_id)
      .eq('user_id', user.id)
      .single();

    if (personError || !person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Get conversation history
    const conversationHistory = await getMessages(person_id, supabase);

    // Save user message first
    const userMessageRecord = await createMessage({
      person_id,
      content: userMessage,
      is_user: true
    }, supabase);

    try {
      // Get Claude's response
      const claudeResponse = await getChatCompletion(
        userMessage,
        person.name,
        person.role,
        person.relationship_type,
        conversationHistory
      );

      // Save Claude's response
      const assistantMessage = await createMessage({
        person_id,
        content: claudeResponse,
        is_user: false
      }, supabase);

      return NextResponse.json({
        userMessage: userMessageRecord,
        assistantMessage
      });

    } catch (claudeError: any) {
      console.error('Claude API error:', claudeError);
      
      // Create a helpful error message based on the error type
      let errorMessage = '';
      switch (claudeError.message) {
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

      // Save error message as assistant response
      const errorMessageRecord = await createMessage({
        person_id,
        content: errorMessage,
        is_user: false
      }, supabase);

      return NextResponse.json({
        userMessage: userMessageRecord,
        assistantMessage: errorMessageRecord,
        shouldRetry: claudeError.message !== 'AUTH_ERROR' // Don't retry auth errors
      });
    }

  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}