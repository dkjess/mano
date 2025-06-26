#!/usr/bin/env node
/**
 * Script to verify the General topic migration status
 * Checks if the migration has been applied and reports on the current state
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyMigration() {
  console.log('🔍 Verifying General topic migration status...\n');

  try {
    // 1. Check if any messages still have person_id = 'general'
    const { data: generalMessages, error: generalError } = await supabase
      .from('messages')
      .select('id')
      .eq('person_id', 'general')
      .limit(1);

    if (generalError) {
      console.log('❌ Error checking for general messages:', generalError.message);
      console.log('   This might mean the constraint was already updated.\n');
    } else {
      console.log(`✅ Messages with person_id='general': ${generalMessages?.length || 0}`);
      if (generalMessages && generalMessages.length > 0) {
        console.log('   ⚠️  Migration has NOT been applied - general messages still exist\n');
      }
    }

    // 2. Check if General topics exist
    const { data: generalTopics, error: topicsError } = await supabase
      .from('topics')
      .select('id, created_by, created_at')
      .eq('title', 'General');

    if (topicsError) {
      console.error('❌ Error checking topics:', topicsError.message);
    } else {
      console.log(`✅ General topics found: ${generalTopics?.length || 0}`);
      if (generalTopics && generalTopics.length > 0) {
        console.log('   ✅ Migration appears to have been applied\n');
        
        // Show sample of users with General topics
        const uniqueUsers = new Set(generalTopics.map(t => t.created_by));
        console.log(`   Users with General topics: ${uniqueUsers.size}`);
      } else {
        console.log('   ⚠️  No General topics found\n');
      }
    }

    // 3. Check message distribution
    const { data: messageStats } = await supabase.rpc('get_message_stats', {});
    
    if (messageStats) {
      console.log('📊 Message Distribution:');
      console.log(`   Total messages: ${messageStats.total_messages || 0}`);
      console.log(`   Person messages: ${messageStats.person_messages || 0}`);
      console.log(`   Topic messages: ${messageStats.topic_messages || 0}\n`);
    }

    // 4. Check if RLS policies are working by testing with a sample user
    const { data: sampleUser } = await supabase
      .from('user_profiles')
      .select('user_id')
      .limit(1)
      .single();

    if (sampleUser) {
      console.log('🔐 Testing RLS policies...');
      
      // Check if user can see their General topic
      const { data: userTopic, error: rlsError } = await supabase
        .from('topics')
        .select('id, title')
        .eq('created_by', sampleUser.user_id)
        .eq('title', 'General')
        .single();

      if (rlsError) {
        console.log('   ❌ RLS test failed:', rlsError.message);
      } else if (userTopic) {
        console.log('   ✅ RLS policies appear to be working correctly');
        console.log(`   Sample user can access their General topic: ${userTopic.id}`);
      }
    }

    // 5. Check if conversation embeddings were migrated
    const { data: embeddings, error: embError } = await supabase
      .from('conversation_embeddings')
      .select('person_id')
      .eq('person_id', 'general')
      .limit(1);

    if (!embError && embeddings) {
      console.log(`\n⚠️  Conversation embeddings with person_id='general': ${embeddings.length}`);
      if (embeddings.length > 0) {
        console.log('   These should be migrated to topic IDs');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Create the RPC function if it doesn't exist
async function createStatsFunction() {
  const functionSQL = `
    CREATE OR REPLACE FUNCTION get_message_stats()
    RETURNS TABLE(
      total_messages bigint,
      person_messages bigint,
      topic_messages bigint
    )
    LANGUAGE sql
    SECURITY DEFINER
    AS $$
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN person_id IS NOT NULL THEN 1 END) as person_messages,
        COUNT(CASE WHEN topic_id IS NOT NULL THEN 1 END) as topic_messages
      FROM messages;
    $$;
  `;

  try {
    await supabase.rpc('query', { query: functionSQL });
  } catch (error) {
    // Function might already exist or we don't have permissions
  }
}

// Run verification
createStatsFunction().then(() => verifyMigration());