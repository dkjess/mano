import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMessages, createMessage } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');

    if (!personId) {
      return NextResponse.json({ error: 'person_id is required' }, { status: 400 });
    }

    // Handle special case for '1-1' assistant
    if (personId === '1-1') {
      // Get messages directly for 1-1 conversation
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('person_id', '1-1')
        .order('created_at', { ascending: true });

      if (error) throw error;
      const messages = data || [];
      
      return NextResponse.json({ messages });
    }

    const messages = await getMessages(personId, supabase);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { person_id, content, is_user } = body;

    if (!person_id || !content || typeof is_user !== 'boolean') {
      return NextResponse.json({ error: 'person_id, content, and is_user are required' }, { status: 400 });
    }

    // Handle special case for '1-1' assistant
    if (person_id === '1-1') {
      // Create message directly for 1-1 conversation
      const { data, error } = await supabase
        .from('messages')
        .insert({
          person_id: '1-1',
          content,
          is_user
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ message: data }, { status: 201 });
    }

    const message = await createMessage({
      person_id,
      content,
      is_user
    }, supabase);

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}