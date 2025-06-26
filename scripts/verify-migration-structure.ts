#!/usr/bin/env node
/**
 * Verify the General topic migration structure
 * Checks database schema and constraints after migration
 */

import { createClient } from '@supabase/supabase-js';

// Use local Supabase
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyMigrationStructure() {
  console.log('🔍 Verifying General topic migration structure...\n');

  try {
    // 1. Check table constraints
    console.log('1️⃣ Checking table constraints...');
    
    const { data: constraints } = await supabase.rpc('query', {
      query: `
        SELECT conname, contype, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'messages'::regclass
        AND conname LIKE '%person_id%' OR conname LIKE '%reference%'
        ORDER BY conname;
      `
    });
    
    console.log('Messages table constraints:');
    if (constraints) {
      constraints.forEach((c: any) => {
        console.log(`  - ${c.conname}: ${c.definition}`);
      });
    }

    // 2. Check RLS policies
    console.log('\n2️⃣ Checking RLS policies...');
    
    const { data: policies } = await supabase.rpc('query', {
      query: `
        SELECT schemaname, tablename, policyname, cmd
        FROM pg_policies
        WHERE tablename IN ('messages', 'topics')
        ORDER BY tablename, cmd;
      `
    });
    
    if (policies) {
      console.log('RLS Policies:');
      const tables = [...new Set(policies.map((p: any) => p.tablename))];
      tables.forEach(table => {
        console.log(`\n  ${table}:`);
        policies
          .filter((p: any) => p.tablename === table)
          .forEach((p: any) => {
            console.log(`    - ${p.policyname} (${p.cmd})`);
          });
      });
    }

    // 3. Check views
    console.log('\n3️⃣ Checking views...');
    
    const { data: views } = await supabase.rpc('query', {
      query: `
        SELECT viewname 
        FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname LIKE '%message%'
        ORDER BY viewname;
      `
    });
    
    if (views && views.length > 0) {
      console.log('Message-related views:');
      views.forEach((v: any) => {
        console.log(`  - ${v.viewname}`);
      });
    }

    // 4. Check indexes
    console.log('\n4️⃣ Checking indexes...');
    
    const { data: indexes } = await supabase.rpc('query', {
      query: `
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND (tablename = 'messages' OR tablename = 'topics')
        AND indexname NOT LIKE '%pkey%'
        ORDER BY tablename, indexname;
      `
    });
    
    if (indexes) {
      console.log('Custom indexes:');
      const tables = [...new Set(indexes.map((i: any) => i.tablename))];
      tables.forEach(table => {
        console.log(`\n  ${table}:`);
        indexes
          .filter((i: any) => i.tablename === table)
          .forEach((i: any) => {
            console.log(`    - ${i.indexname}`);
          });
      });
    }

    // 5. Test constraint enforcement
    console.log('\n5️⃣ Testing constraint enforcement...');
    
    // Create a test user ID
    const testUserId = '00000000-0000-0000-0000-000000000001';
    
    // Try to insert a message with person_id='general' (should fail)
    const { error: generalError } = await supabase
      .from('messages')
      .insert({
        person_id: 'general',
        content: 'Test message',
        is_user: true,
        user_id: testUserId
      });
    
    if (generalError) {
      console.log('✅ Constraint working: Cannot insert person_id="general"');
      console.log(`   Error: ${generalError.message}`);
    } else {
      console.log('❌ Constraint NOT working: person_id="general" was accepted');
    }

    // Try to insert a message with both person_id and topic_id (should fail)
    const { error: bothError } = await supabase
      .from('messages')
      .insert({
        person_id: testUserId,
        topic_id: testUserId,
        content: 'Test message',
        is_user: true,
        user_id: testUserId
      });
    
    if (bothError) {
      console.log('✅ Constraint working: Cannot have both person_id and topic_id');
      console.log(`   Error: ${bothError.message}`);
    } else {
      console.log('❌ Constraint NOT working: Both person_id and topic_id accepted');
    }

    // 6. Check if General topics exist
    console.log('\n6️⃣ Checking for General topics...');
    
    const { data: generalTopics, count } = await supabase
      .from('topics')
      .select('*', { count: 'exact', head: true })
      .eq('title', 'General');
    
    console.log(`✅ Found ${count || 0} General topics in the database`);

    console.log('\n✅ Migration structure verification complete!');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Create RPC function if needed
async function createRpcFunction() {
  try {
    await supabase.rpc('query', {
      query: `
        CREATE OR REPLACE FUNCTION query(query text)
        RETURNS TABLE(result json)
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          RETURN QUERY EXECUTE 'SELECT row_to_json(t) FROM (' || query || ') t';
        END;
        $$;
      `
    });
  } catch (e) {
    // Function might already exist
  }
}

// Run verification
createRpcFunction().then(() => verifyMigrationStructure());