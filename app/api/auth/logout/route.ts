import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Sign out the user
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Error signing out:', error)
      // Still redirect even if there's an error
    }

    // Redirect to login page
    return NextResponse.redirect(new URL('/auth/login', request.url))
    
  } catch (error) {
    console.error('Unexpected error during logout:', error)
    // Always redirect to login on any error
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
}

export async function POST(request: NextRequest) {
  // Support both GET and POST methods for logout
  return GET(request)
} 