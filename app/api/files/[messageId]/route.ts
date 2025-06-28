import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMessageFiles } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, person_id, topic_id')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // For person messages, check if user owns the person
    if (message.person_id && message.person_id !== 'general') {
      const { data: person, error: personError } = await supabase
        .from('people')
        .select('user_id')
        .eq('id', message.person_id)
        .single();

      if (personError || !person || person.user_id !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // For topic messages, check if user has access to the topic
    if (message.topic_id) {
      const { data: topic, error: topicError } = await supabase
        .from('topics')
        .select('created_by')
        .eq('id', message.topic_id)
        .single();

      if (topicError || !topic || topic.created_by !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get files for the message
    const files = await getMessageFiles(messageId);

    return NextResponse.json({
      success: true,
      files
    });

  } catch (error) {
    console.error('Get message files error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}