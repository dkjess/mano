import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { topicId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: topic, error } = await supabase
      .from('topics')
      .select('*')
      .eq('id', params.topicId)
      .eq('created_by', user.id)
      .single();

    if (error) throw error;
    if (!topic) {
      return Response.json({ error: 'Topic not found' }, { status: 404 });
    }

    return Response.json({ topic });
  } catch (error) {
    console.error('Failed to fetch topic:', error);
    return Response.json({ error: 'Failed to fetch topic' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { topicId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();
    
    const { data: topic, error } = await supabase
      .from('topics')
      .update(updates)
      .eq('id', params.topicId)
      .eq('created_by', user.id)
      .select()
      .single();

    if (error) throw error;

    return Response.json({ topic });
  } catch (error) {
    console.error('Failed to update topic:', error);
    return Response.json({ error: 'Failed to update topic' }, { status: 500 });
  }
} 