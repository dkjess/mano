import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updatePerson, deletePerson } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { id } = await params;
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: person, error } = await supabase
      .from('people')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    if (!person) {
      return Response.json({ error: 'Person not found' }, { status: 404 });
    }

    return Response.json({ person });
  } catch (error) {
    console.error('Failed to fetch person:', error);
    return Response.json({ error: 'Failed to fetch person' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { id } = await params;
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();
    const person = await updatePerson(id, updates, supabase);
    
    return Response.json({ person });
  } catch (error) {
    console.error('Failed to update person:', error);
    return Response.json({ error: 'Failed to update person' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { id } = await params;
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deletePerson(id, supabase);
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to delete person:', error);
    return Response.json({ error: 'Failed to delete person' }, { status: 500 });
  }
}