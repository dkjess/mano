import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function confirmTestUser() {
  console.log('🔧 Confirming test user email...\n')
  
  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment variables')
    console.log('💡 You can find this key in your Supabase Dashboard → Project Settings → API')
    console.log('💡 Add it to your .env.local file as: SUPABASE_SERVICE_ROLE_KEY=your_service_key')
    process.exit(1)
  }
  
  // Use service role client for admin operations
  const supabase = createClient(supabaseUrl!, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  try {
    // Get the user by email
    console.log('1️⃣ Finding test user...')
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      throw listError
    }
    
    const testUser = users.users.find(user => 
      user.email === 'testuser@example.com' || user.email === 'test@test.com'
    )
    
    if (!testUser) {
      console.error('❌ Test user not found. Please create the user first.')
      process.exit(1)
    }
    
    console.log(`   ✅ Found user: ${testUser.email}`)
    
    // Confirm the user's email
    console.log('2️⃣ Confirming email...')
    const { data, error } = await supabase.auth.admin.updateUserById(testUser.id, {
      email_confirm: true
    })
    
    if (error) {
      throw error
    }
    
    console.log('   ✅ Email confirmed successfully')
    
    console.log('\n🎉 Success! You can now sign in with:')
    console.log(`   Email: ${testUser.email}`)
    console.log('   Password: testuser123')
    console.log('\n🔗 Sign in at: http://localhost:3001/auth/login')
    
  } catch (error: any) {
    console.error('❌ Failed to confirm user:', error.message)
    process.exit(1)
  }
}

confirmTestUser() 