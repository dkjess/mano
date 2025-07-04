import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { generateTopicWelcomeMessage } from '@/lib/welcome-message-generation';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: topics, error } = await supabase
      .from('topics')
      .select(`
        id,
        title,
        status,
        participants,
        created_at,
        updated_at,
        created_by
      `)
      .eq('created_by', user.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return Response.json({ topics });
  } catch (error) {
    console.error('Failed to fetch topics:', error);
    return Response.json({ error: 'Failed to fetch topics' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, participants = [] } = await request.json();

    if (!title?.trim()) {
      return Response.json({ error: 'Title is required' }, { status: 400 });
    }

    const { data: topic, error } = await supabase
      .from('topics')
      .insert({
        title: title.trim(),
        participants,
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;

    // Generate AI-powered welcome message for the new topic
    try {
      const welcomeMessage = await generateTopicWelcomeMessage({
        title: title.trim(),
        participants,
        user_id: user.id
      }, supabase);

      console.log('AI-generated topic welcome message:', welcomeMessage);
      console.log('Creating initial message for topic:', topic.id);
      
      // Insert the welcome message from Mano
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          topic_id: topic.id,
          content: welcomeMessage,
          is_user: false, // This is from Mano
          user_id: user.id
        })
        .select()
        .single();
        
      if (messageError) {
        console.error('Error creating initial topic message:', messageError);
      } else {
        console.log('Initial topic message created successfully:', messageData);
      }
    } catch (welcomeError) {
      console.error('Failed to generate AI topic welcome message:', welcomeError);
      
      // Fallback to a simple welcome message so topic creation still succeeds
      const fallbackMessage = `Welcome to your discussion about "${title.trim()}"! I'm here to help you navigate this topic effectively. What would you like to explore or discuss?`;
      
      try {
        const { data: messageData, error: messageError } = await supabase
          .from('messages')
          .insert({
            topic_id: topic.id,
            content: fallbackMessage,
            is_user: false,
            user_id: user.id
          })
          .select()
          .single();
          
        if (messageError) {
          console.error('Error creating fallback topic message:', messageError);
        } else {
          console.log('Fallback topic message created:', messageData);
        }
      } catch (fallbackError) {
        console.error('Failed to create fallback topic message:', fallbackError);
        // Continue anyway - topic creation should still succeed
      }
    }

    return Response.json({ topic });
  } catch (error) {
    console.error('Failed to create topic:', error);
    return Response.json({ error: 'Failed to create topic' }, { status: 500 });
  }
} 