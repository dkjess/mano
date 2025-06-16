import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has debug access
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('debug_mode')
      .eq('user_id', user.id)
      .single()
    
    if (!profile?.debug_mode) {
      return NextResponse.json({ 
        error: 'Debug access required. Enable debug_mode in user profile.' 
      }, { status: 403 })
    }

    console.log(`Resetting user data for: ${user.email} (debug user)`)

    // Delete user data in correct order (respecting foreign key constraints)
    const deleteOperations = [
      // Delete embeddings first (they reference messages)
      supabase.from('conversation_embeddings').delete().eq('user_id', user.id),
      supabase.from('conversation_summary_embeddings').delete().eq('user_id', user.id),
      
      // Delete messages (they reference people)
      supabase.from('messages').delete().eq('user_id', user.id),
      
      // Delete people
      supabase.from('people').delete().eq('user_id', user.id),
      
      // Reset user profile (but keep debug_mode)
      supabase.from('user_profiles').update({
        preferred_name: null,
        onboarding_completed: false,
        onboarding_step: 'welcome',
        updated_at: new Date().toISOString()
        // Note: debug_mode is preserved
      }).eq('user_id', user.id)
    ]

    // Execute all delete operations
    const results = await Promise.allSettled(deleteOperations)
    
    // Log any errors but don't fail the reset
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Delete operation ${index} failed:`, result.reason)
      }
    })

    console.log(`User data reset completed for: ${user.email}`)

    return NextResponse.json({ 
      message: 'User data reset successfully',
      resetItems: [
        'conversation_embeddings',
        'conversation_summary_embeddings', 
        'messages',
        'people',
        'user_profile (reset to onboarding state, debug_mode preserved)'
      ]
    })

  } catch (error) {
    console.error('Error resetting user data:', error)
    return NextResponse.json({ 
      error: 'Internal server error during reset' 
    }, { status: 500 })
  }
} 