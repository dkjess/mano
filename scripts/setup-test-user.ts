import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function setupTestUser() {
  console.log('🔧 Setting up test user for Mano development...\n')
  
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!)
  
  try {
    // Step 1: Create test user account
    console.log('1️⃣ Creating test user account...')
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'test@mano.dev',
      password: 'testuser123'
    })
    
    if (signUpError && !signUpError.message.includes('already registered')) {
      throw signUpError
    }
    
    if (signUpError?.message.includes('already registered')) {
      console.log('   ✅ Test user already exists')
    } else {
      console.log('   ✅ Test user created successfully')
    }
    
    // Step 2: Sign in as test user
    console.log('2️⃣ Signing in as test user...')
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'test@mano.dev',
      password: 'testuser123'
    })
    
    if (signInError) {
      throw signInError
    }
    
    console.log('   ✅ Successfully signed in')
    
    // Step 3: Check/create user profile
    console.log('3️⃣ Setting up user profile...')
    const userId = signInData.user.id
    
    // Check if profile exists
    let { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (profileError && profileError.code === 'PGRST116') {
      // Profile doesn't exist, create it
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          debug_mode: true,
          onboarding_completed: false,
          onboarding_step: 'welcome'
        })
        .select()
        .single()
        
      if (createError) {
        throw createError
      }
      
      profile = newProfile
      console.log('   ✅ User profile created with debug access')
    } else if (profileError) {
      throw profileError
    } else {
      // Profile exists, update debug mode
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ debug_mode: true })
        .eq('user_id', userId)
        
      if (updateError) {
        throw updateError
      }
      
      console.log('   ✅ User profile updated with debug access')
    }
    
    // Step 4: Sign out to clean up
    console.log('4️⃣ Cleaning up session...')
    await supabase.auth.signOut()
    console.log('   ✅ Signed out successfully')
    
    // Success message
    console.log('\n🎉 Test user setup completed successfully!')
    console.log('\n📋 Test User Credentials:')
    console.log('   Email: test@mano.dev')
    console.log('   Password: testuser123')
    console.log('\n🔧 Next Steps:')
    console.log('   1. Start your development server: npm run dev')
    console.log('   2. Go to: http://localhost:3000/auth/login')
    console.log('   3. Sign in with the test credentials')
    console.log('   4. Look for the debug panel in the bottom-right corner')
    console.log('   5. Test logout: http://localhost:3000/api/auth/logout')
    
  } catch (error: any) {
    console.error('❌ Setup failed:', error.message)
    
    if (error.message.includes('Email not confirmed')) {
      console.log('\n💡 Note: If using email confirmation, you may need to:')
      console.log('   1. Check your email confirmation settings in Supabase Auth')
      console.log('   2. Or manually confirm the user in Supabase Dashboard')
    }
    
    process.exit(1)
  }
}

async function manualSetupInstructions() {
  console.log('🔧 Manual Test User Setup Instructions\n')
  console.log('Since environment variables are not available, please set up the test user manually:\n')
  
  console.log('📋 Test User Credentials:')
  console.log('   Email: test@mano.dev')
  console.log('   Password: testuser123\n')
  
  console.log('🔧 Manual Setup Steps:')
  console.log('   1. Start your development server: npm run dev')
  console.log('   2. Go to: http://localhost:3000/auth/sign-up')
  console.log('   3. Create account with the test credentials above')
  console.log('   4. Go to your Supabase Dashboard → Table Editor → user_profiles')
  console.log('   5. Find the test user and set debug_mode = true')
  console.log('   6. Sign in at: http://localhost:3000/auth/login')
  console.log('   7. Look for the debug panel in the bottom-right corner\n')
  
  console.log('🔗 Useful URLs:')
  console.log('   • Login: http://localhost:3000/auth/login')
  console.log('   • Logout: http://localhost:3000/api/auth/logout')
  console.log('   • Sign up: http://localhost:3000/auth/sign-up')
}

// Check environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌')
  console.log('\n💡 Make sure your .env.local file is properly configured\n')
  
  await manualSetupInstructions()
  process.exit(0)
}

// Run the setup
setupTestUser() 