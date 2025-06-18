import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Call the edge function directly with proper auth headers
    const { data, error } = await supabase.functions.invoke('chat', {
      body: {
        person_id: person_id,
        message: userMessage
      }
    });

    if (error) {
      console.error('Chat function error:', error);
      throw new Error(error.message || 'Failed to send message');
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}