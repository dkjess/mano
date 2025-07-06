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

    const { data: topic, error } = await supabase
      .from('topics')
      .select('*')
      .eq('id', topicId)
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
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { topicId } = await params;
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();
    
    const { data: topic, error } = await supabase
      .from('topics')
      .update(updates)
      .eq('id', topicId)
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

export async function PATCH(
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

    const updates = await request.json();
    
    // Validate that we only allow specific updates
    const allowedFields = ['title', 'status', 'participants'];
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as any);

    if (Object.keys(filteredUpdates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    console.log('🔄 Updating topic:', topicId, 'with:', filteredUpdates);
    
    const { data: topic, error } = await supabase
      .from('topics')
      .update(filteredUpdates)
      .eq('id', topicId)
      .eq('created_by', user.id)
      .select()
      .single();

    if (error) {
      console.error('Database error updating topic:', error);
      throw error;
    }

    console.log('✅ Topic updated successfully:', topic.title);
    return Response.json({ topic });
  } catch (error) {
    console.error('Failed to update topic:', error);
    return Response.json({ error: 'Failed to update topic' }, { status: 500 });
  }
} 