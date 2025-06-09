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

    console.log('User ID from auth:', user.id);
    console.log('Creating person with data:', { user_id: user.id, name, role, relationship_type });

    const person = await createPerson({
      user_id: user.id,
      name,
      role: role || null,
      relationship_type
    }, supabase);

    return NextResponse.json({ person }, { status: 201 });
  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}