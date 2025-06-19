import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function createTestUser() {
  console.log('🔧 Creating test user...\n')
  
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!)
  
  try {
    // Try with a standard email format
    console.log('1️⃣ Creating test user account with standard email...')
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'testuser@example.com',
      password: 'testuser123'
    })
    
    if (signUpError) {
      console.error('Sign up failed:', signUpError.message)
      
      // Try alternative email
      console.log('2️⃣ Trying alternative email format...')
      const { data: altData, error: altError } = await supabase.auth.signUp({
        email: 'test@test.com',
        password: 'testuser123'
      })
      
      if (altError) {
        throw altError
      }
      
      console.log('   ✅ Test user created with email: test@test.com')
      console.log('\n📋 Test User Credentials:')
      console.log('   Email: test@test.com')
      console.log('   Password: testuser123')
    } else {
      console.log('   ✅ Test user created with email: testuser@example.com')
      console.log('\n📋 Test User Credentials:')
      console.log('   Email: testuser@example.com')
      console.log('   Password: testuser123')
    }
    
    console.log('\n🎉 Success! You can now sign in at: http://localhost:3001/auth/login')
    
  } catch (error: any) {
    console.error('❌ Failed to create test user:', error.message)
    process.exit(1)
  }
}

createTestUser() 