#!/usr/bin/env node
/**
 * Test script for General topic migration
 * Tests RLS policies, new user creation, and existing user access
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Use local Supabase for testing
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Create clients
const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

async function testMigration() {
  console.log('🧪 Testing General topic migration...\n');

  try {
    // 1. Create test users
    console.log('1️⃣ Creating test users...');
    
    // User with existing general messages
    const { data: existingUser, error: user1Error } = await serviceClient.auth.admin.createUser({
      email: 'existing@test.com',
      password: 'test123456',
      email_confirm: true
    });
    
    if (user1Error) throw user1Error;
    console.log('✅ Created existing user:', existingUser.user.email);

    // New user (no general messages)
    const { data: newUser, error: user2Error } = await serviceClient.auth.admin.createUser({
      email: 'newuser@test.com',
      password: 'test123456',
      email_confirm: true
    });
    
    if (user2Error) throw user2Error;
    console.log('✅ Created new user:', newUser.user.email);

    // 2. Add some general messages for existing user (before migration)
    console.log('\n2️⃣ Adding test messages with person_id="general"...');
    
    const messages = [
      { person_id: 'general', content: 'Hello, I need help with my team', is_user: true, user_id: existingUser.user.id },
      { person_id: 'general', content: 'I can help you with management strategies', is_user: false, user_id: existingUser.user.id },
      { person_id: 'general', content: 'What should I focus on?', is_user: true, user_id: existingUser.user.id }
    ];

    for (const msg of messages) {
      const { error } = await serviceClient.from('messages').insert(msg);
      if (error) console.log('⚠️  Error inserting message:', error.message);
    }
    console.log('✅ Added 3 test messages');

    // 3. Test RLS policies - existing user should see their messages
    console.log('\n3️⃣ Testing RLS policies...');
    
    // Sign in as existing user
    const { data: session1, error: signInError1 } = await anonClient.auth.signInWithPassword({
      email: 'existing@test.com',
      password: 'test123456'
    });
    
    if (signInError1) throw signInError1;
    
    // Check if user can see their General topic
    const { data: userTopics, error: topicsError } = await anonClient
      .from('topics')
      .select('*')
      .eq('title', 'General');
    
    if (topicsError) {
      console.log('❌ RLS Error accessing topics:', topicsError.message);
    } else {
      console.log(`✅ User can see ${userTopics.length} General topic(s)`);
      if (userTopics.length > 0) {
        console.log('   Topic ID:', userTopics[0].id);
        
        // Check if messages were migrated
        const { data: topicMessages, error: msgError } = await anonClient
          .from('messages')
          .select('*')
          .eq('topic_id', userTopics[0].id);
        
        if (!msgError && topicMessages) {
          console.log(`   ✅ Found ${topicMessages.length} messages in General topic`);
        }
      }
    }

    // 4. Test new user General topic creation
    console.log('\n4️⃣ Testing new user General topic creation...');
    
    // Sign in as new user
    await anonClient.auth.signOut();
    const { data: session2, error: signInError2 } = await anonClient.auth.signInWithPassword({
      email: 'newuser@test.com',
      password: 'test123456'
    });
    
    if (signInError2) throw signInError2;
    
    // Check if new user has a General topic (should be created on first access)
    const { data: newUserTopics } = await anonClient
      .from('topics')
      .select('*')
      .eq('title', 'General');
    
    console.log(`✅ New user has ${newUserTopics?.length || 0} General topic(s)`);
    
    if (!newUserTopics || newUserTopics.length === 0) {
      console.log('   ℹ️  General topic will be created on first access via app');
    }

    // 5. Test message creation in General topic
    console.log('\n5️⃣ Testing message creation in General topic...');
    
    if (userTopics && userTopics.length > 0) {
      // Sign back in as existing user
      await anonClient.auth.signOut();
      await anonClient.auth.signInWithPassword({
        email: 'existing@test.com',
        password: 'test123456'
      });
      
      const { error: msgCreateError } = await anonClient
        .from('messages')
        .insert({
          topic_id: userTopics[0].id,
          content: 'Test message in migrated General topic',
          is_user: true,
          user_id: existingUser.user.id
        });
      
      if (msgCreateError) {
        console.log('❌ Error creating message in topic:', msgCreateError.message);
      } else {
        console.log('✅ Successfully created message in General topic');
      }
    }

    // 6. Verify constraints
    console.log('\n6️⃣ Testing constraints...');
    
    // Try to create a message with person_id='general' (should fail)
    const { error: constraintError } = await serviceClient
      .from('messages')
      .insert({
        person_id: 'general',
        content: 'This should fail',
        is_user: true,
        user_id: existingUser.user.id
      });
    
    if (constraintError) {
      console.log('✅ Constraint working: Cannot create messages with person_id="general"');
      console.log('   Error:', constraintError.message);
    } else {
      console.log('❌ Constraint NOT working: Message with person_id="general" was created');
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await serviceClient.auth.admin.deleteUser(existingUser.user.id);
    await serviceClient.auth.admin.deleteUser(newUser.user.id);
    console.log('✅ Test users deleted');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
testMigration();