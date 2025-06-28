import { createClient } from '@supabase/supabase-js';

// Use anon key for signup, service key for data manipulation
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

async function createTestData(userId) {
  try {
    // Create test topics
    const topics = [
      { title: 'General', participants: [], status: 'active' },
      { title: 'Product Development', participants: [], status: 'active' },
      { title: 'Team Growth', participants: [], status: 'active' }
    ];

    console.log('  📁 Creating topics...');
    for (const topic of topics) {
      const { error } = await supabaseService
        .from('topics')
        .insert({
          ...topic,
          created_by: userId
        });
      
      if (error && !error.message.includes('duplicate')) {
        console.warn(`    ⚠️  Could not create topic "${topic.title}":`, error.message);
      }
    }

    // Create test people
    const people = [
      { name: 'Sarah Chen', role: 'VP of Engineering', relationship_type: 'direct_report' },
      { name: 'Marcus Rodriguez', role: 'Product Manager', relationship_type: 'peer' },
      { name: 'Jennifer Kim', role: 'Chief Financial Officer', relationship_type: 'stakeholder' },
      { name: 'Alex Thompson', role: 'Senior Developer', relationship_type: 'direct_report' },
      { name: 'David Park', role: 'CEO', relationship_type: 'manager' }
    ];

    console.log('  👥 Creating people...');
    for (const person of people) {
      const { error } = await supabaseService
        .from('people')
        .insert({
          ...person,
          user_id: userId
        });
      
      if (error && !error.message.includes('duplicate')) {
        console.warn(`    ⚠️  Could not create person "${person.name}":`, error.message);
      }
    }

    console.log('✅ Test data created');

  } catch (error) {
    console.warn('⚠️  Error creating test data:', error);
  }
}

async function createTestUser() {
  try {
    console.log('🔧 Creating test user...');

    // First, try to sign up the user
    const { data: signUpData, error: signUpError } = await supabaseAnon.auth.signUp({
      email: 'testuser@example.com',
      password: 'testuser123',
      options: {
        data: {
          test_user: true
        }
      }
    });

    let userId;

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        console.log('⚠️  User already exists, trying to get user ID...');
        
        // Try to sign in to get the user ID
        const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
          email: 'testuser@example.com',
          password: 'testuser123'
        });

        if (signInError) {
          console.error('❌ Could not sign in existing user:', signInError.message);
          console.log('🔧 The user exists but password might be different');
          console.log('💡 Try deleting the user and running this script again');
          return;
        }

        userId = signInData.user.id;
        console.log('✅ Found existing user');
      } else {
        console.error('❌ Error during signup:', signUpError.message);
        return;
      }
    } else {
      userId = signUpData.user?.id;
      console.log('✅ Test user created successfully');
    }

    if (!userId) {
      console.error('❌ Could not get user ID');
      return;
    }

    console.log(`📝 User ID: ${userId}`);

    // Update user profile with test data using service role
    try {
      const { error: profileError } = await supabaseService
        .from('user_profiles')
        .upsert({
          user_id: userId,
          preferred_name: 'Test User',
          onboarding_completed: true,
          onboarding_step: 'completed',
          debug_mode: true
        });

      if (profileError) {
        console.warn('⚠️  Could not update user profile:', profileError.message);
      } else {
        console.log('✅ User profile updated');
      }
    } catch (profileErr) {
      console.warn('⚠️  Profile update error:', profileErr);
    }

    // Create test topics and people
    console.log('\n📊 Creating test data...');
    await createTestData(userId);

    // Verify login works
    console.log('\n🔐 Testing login...');
    const { data: testSignIn, error: testSignInError } = await supabaseAnon.auth.signInWithPassword({
      email: 'testuser@example.com',
      password: 'testuser123'
    });

    if (testSignInError) {
      console.error('❌ Login test failed:', testSignInError.message);
    } else {
      console.log('✅ Login test successful!');
      console.log('\n🎉 Test user is ready!');
      console.log('📧 Email: testuser@example.com');
      console.log('🔑 Password: testuser123');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTestUser();