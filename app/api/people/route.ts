import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPeople, createPerson } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const people = await getPeople(user.id, supabase);
    return NextResponse.json({ people });
  } catch (error) {
    console.error('Error fetching people:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, role, relationship_type } = body;

    if (!name || !relationship_type) {
      return NextResponse.json({ error: 'Name and relationship_type are required' }, { status: 400 });
    }

    console.log('🟢 User ID from auth:', user.id);
    console.log('🟢 Creating person with data:', { user_id: user.id, name, role, relationship_type });

    const person = await createPerson({
      user_id: user.id,
      name,
      role: role || null,
      relationship_type
    }, supabase);

    // Generate AI-powered welcome message using Supabase Edge Function (server-side)
    try {
      console.log('🟢 Calling Supabase Edge Function for welcome message generation');
      
      const { data: welcomeData, error: welcomeError } = await supabase.functions.invoke('chat', {
        body: {
          action: 'generate_person_welcome',
          name,
          role,
          relationship_type
        }
      });

      if (welcomeError) {
        console.error('Supabase function returned error:', welcomeError);
        
        // Try to get the actual error response body
        try {
          const errorResponse = await welcomeError.context?.text();
          console.error('🔴 Error response body:', errorResponse);
        } catch (e) {
          console.error('🔴 Could not read error response body:', e);
        }
        
        throw welcomeError;
      }

      const initialMessage = welcomeData?.welcomeMessage;
      if (initialMessage) {
        console.log('🟢 AI-generated welcome message:', initialMessage);
        console.log('🟢 Creating initial message for person:', person.id);
        
        // Insert the welcome message from Mano
        const { data: messageData, error: messageError } = await supabase
          .from('messages')
          .insert({
            person_id: person.id,
            content: initialMessage,
            is_user: false, // This is from Mano
            user_id: user.id
          })
          .select()
          .single();
          
        if (messageError) {
          console.error('Error creating initial message:', messageError);
        } else {
          console.log('Initial message created successfully:', messageData);
        }
      }
    } catch (welcomeError) {
      console.error('Failed to generate AI welcome message:', welcomeError);
      // Graceful degradation: Person creation succeeds, but without welcome message
      // User will see an empty conversation initially - AI will generate contextual responses when they start chatting
      console.log('🔄 Person created successfully, but without AI welcome message. Conversation will be AI-generated when user starts chatting.');
    }

    return NextResponse.json({ person }, { status: 201 });
  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}