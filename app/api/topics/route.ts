import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

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

    // Generate AI-powered welcome message using Supabase Edge Function (server-side)
    try {
      console.log('🟢 Calling Supabase Edge Function for topic welcome message generation');
      
      const { data: welcomeData, error: welcomeError } = await supabase.functions.invoke('chat', {
        body: {
          action: 'generate_topic_welcome',
          title: title.trim(),
          participants
        }
      });

      if (welcomeError) {
        console.error('🔴 Supabase function returned error:', welcomeError);
        console.error('🔴 Error details:', {
          message: welcomeError.message,
          context: welcomeError.context,
          status: welcomeError.status
        });
        throw welcomeError;
      }

      console.log('🟢 Welcome data received:', welcomeData);
      const initialMessage = welcomeData?.welcomeMessage;
      
      if (initialMessage) {
        console.log('🟢 AI-generated topic welcome message:', initialMessage.substring(0, 100) + '...');
        console.log('🟢 Creating initial message for topic:', topic.id);
        
        // Insert the welcome message from Mano
        const { data: messageData, error: messageError } = await supabase
          .from('messages')
          .insert({
            topic_id: topic.id,
            content: initialMessage,
            is_user: false, // This is from Mano
            user_id: user.id
          })
          .select()
          .single();
          
        if (messageError) {
          console.error('🔴 Error creating initial topic message:', messageError);
          console.error('🔴 Message insert details:', {
            topic_id: topic.id,
            content_length: initialMessage.length,
            user_id: user.id
          });
        } else {
          console.log('✅ Initial topic message created successfully:', messageData.id);
        }
      } else {
        console.warn('⚠️ No welcome message in response data:', welcomeData);
      }
    } catch (welcomeError) {
      console.error('Failed to generate AI topic welcome message:', welcomeError);
      // Graceful degradation: Topic creation succeeds, but without welcome message
      // User will see an empty conversation initially - AI will generate contextual responses when they start chatting
      console.log('🔄 Topic created successfully, but without AI welcome message. Conversation will be AI-generated when user starts chatting.');
    }

    return Response.json({ topic });
  } catch (error) {
    console.error('Failed to create topic:', error);
    return Response.json({ error: 'Failed to create topic' }, { status: 500 });
  }
} 