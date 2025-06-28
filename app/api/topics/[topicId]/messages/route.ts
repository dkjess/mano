import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { topicId } = await params;
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user owns this topic
    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('id', topicId)
      .eq('created_by', user.id)
      .single();

    if (!topic) {
      return Response.json({ error: 'Topic not found' }, { status: 404 });
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return Response.json({ messages });
  } catch (error) {
    console.error('Failed to fetch topic messages:', error);
    return Response.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { topicId } = await params;
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, is_user = true } = await request.json();

    if (!content?.trim()) {
      return Response.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify user owns this topic
    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('id', topicId)
      .eq('created_by', user.id)
      .single();

    if (!topic) {
      return Response.json({ error: 'Topic not found' }, { status: 404 });
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        content: content.trim(),
        topic_id: topicId,
        person_id: null,
        is_user
      })
      .select()
      .single();

    if (error) throw error;

    return Response.json({ message });
  } catch (error) {
    console.error('Failed to create message:', error);
    return Response.json({ error: 'Failed to create message' }, { status: 500 });
  }
} 