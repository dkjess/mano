import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      user: user.email,
      migration_status: {
        general_messages_remaining: 0,
        general_topic_exists: false,
        user_message_counts: {
          total: 0,
          person_messages: 0,
          topic_messages: 0
        }
      }
    };

    // 1. Check if user has any messages with person_id = 'general'
    const { data: generalMessages, error: generalError } = await supabase
      .from('messages')
      .select('id')
      .eq('person_id', 'general')
      .eq('user_id', user.id)
      .limit(10);

    if (!generalError) {
      results.migration_status.general_messages_remaining = generalMessages?.length || 0;
    } else {
      // Error might mean constraint was updated
      results.migration_status.general_messages_remaining = -1; // Unknown
    }

    // 2. Check if user has a General topic
    const { data: generalTopic, error: topicError } = await supabase
      .from('topics')
      .select('id, title, created_at')
      .eq('created_by', user.id)
      .eq('title', 'General')
      .single();

    if (!topicError && generalTopic) {
      results.migration_status.general_topic_exists = true;
      results.migration_status.general_topic_id = generalTopic.id;
    }

    // 3. Get user's message counts
    const { data: allMessages } = await supabase
      .from('messages')
      .select('person_id, topic_id')
      .eq('user_id', user.id);

    if (allMessages) {
      results.migration_status.user_message_counts.total = allMessages.length;
      results.migration_status.user_message_counts.person_messages = 
        allMessages.filter(m => m.person_id !== null).length;
      results.migration_status.user_message_counts.topic_messages = 
        allMessages.filter(m => m.topic_id !== null).length;
    }

    // 4. If General topic exists, check if messages are there
    if (generalTopic) {
      const { data: topicMessages, count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('topic_id', generalTopic.id)
        .eq('user_id', user.id);

      results.migration_status.general_topic_message_count = count || 0;
    }

    // Determine migration status
    if (results.migration_status.general_messages_remaining === 0 && 
        results.migration_status.general_topic_exists) {
      results.migration_status.status = '✅ Migration complete';
    } else if (results.migration_status.general_messages_remaining > 0) {
      results.migration_status.status = '⚠️ Migration pending - general messages still exist';
    } else if (!results.migration_status.general_topic_exists) {
      results.migration_status.status = '⚠️ No General topic found for user';
    } else {
      results.migration_status.status = '❓ Unknown status';
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('Error verifying migration:', error);
    return NextResponse.json({ 
      error: 'Failed to verify migration status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}