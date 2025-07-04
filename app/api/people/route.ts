import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPeople, createPerson } from '@/lib/database';
import { generatePersonWelcomeMessage } from '@/lib/welcome-message-generation';

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

    console.log('User ID from auth:', user.id);
    console.log('Creating person with data:', { user_id: user.id, name, role, relationship_type });

    const person = await createPerson({
      user_id: user.id,
      name,
      role: role || null,
      relationship_type
    }, supabase);

    // Generate AI-powered welcome message using full context
    const initialMessage = await generatePersonWelcomeMessage({
      name,
      role,
      relationship_type,
      user_id: user.id
    }, supabase);

    console.log('Creating initial message for person:', person.id);
    
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
      console.log('Initial message created:', messageData);
    }

    return NextResponse.json({ person }, { status: 201 });
  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}