import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMessages, createMessage } from '@/lib/database';
import { getOrCreateGeneralTopic } from '@/lib/general-topic-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');
    const topicId = searchParams.get('topic_id');

    // Handle topic-based messages
    if (topicId) {
      // Verify user owns this topic
      const { data: topic } = await supabase
        .from('topics')
        .select('id, title')
        .eq('id', topicId)
        .eq('created_by', user.id)
        .single();

      if (!topic) {
        return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
      }

      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      return NextResponse.json({ messages: messages || [] });
    }


    if (!personId) {
      return NextResponse.json({ error: 'person_id or topic_id is required' }, { status: 400 });
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
    const { person_id, topic_id, content, is_user } = body;

    if (!content || typeof is_user !== 'boolean') {
      return NextResponse.json({ error: 'content and is_user are required' }, { status: 400 });
    }

    // Handle topic-based messages
    if (topic_id) {
      // Verify user owns this topic
      const { data: topic } = await supabase
        .from('topics')
        .select('id')
        .eq('id', topic_id)
        .eq('created_by', user.id)
        .single();

      if (!topic) {
        return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
      }

      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          content: content.trim(),
          topic_id,
          person_id: null,
          is_user,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ message }, { status: 201 });
    }


    if (!person_id) {
      return NextResponse.json({ error: 'person_id or topic_id is required' }, { status: 400 });
    }

    const message = await createMessage({
      person_id,
      content,
      is_user,
      user_id: user.id
    }, supabase);

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}