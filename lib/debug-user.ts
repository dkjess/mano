import { createClient } from '@/lib/supabase/client'

export interface DebugUserState {
  hasDebugAccess: boolean;
  userEmail: string;
  userId: string;
}

export async function checkDebugAccess(): Promise<DebugUserState> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return {
      hasDebugAccess: false,
      userEmail: '',
      userId: ''
    }
  }

  // Check if user has debug_mode enabled in their profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('debug_mode')
    .eq('user_id', user.id)
    .single()
  
  return {
    hasDebugAccess: profile?.debug_mode === true,
    userEmail: user.email || '',
    userId: user.id
  }
}

export async function createTestUser(): Promise<{ success: boolean; message: string }> {
  const supabase = createClient()
  
  const testEmail = 'test@mano.dev'
  const testPassword = 'testuser123'
  
  try {
    // Create the test user
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    })
    
    if (error) {
      if (error.message.includes('already registered')) {
        return { success: true, message: 'Test user already exists' }
      }
      throw error
    }
    
    return { 
      success: true, 
      message: 'Test user created. Enable debug_mode in Supabase admin panel.' 
    }
    
  } catch (error: any) {
    console.error('Error creating test user:', error)
    return { 
      success: false, 
      message: `Failed to create test user: ${error.message}` 
    }
  }
}

// Helper function for development setup
export async function ensureTestUserExists() {
  if (process.env.NODE_ENV === 'development') {
    const result = await createTestUser()
    console.log('Test user setup:', result.message)
    return result
  }
  return { success: false, message: 'Only available in development' }
} 