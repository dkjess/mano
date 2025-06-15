import type { Person, Message } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

// People CRUD operations
export async function getPeople(userId: string, supabase: SupabaseClient): Promise<Person[]> {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createPerson(
  person: Omit<Person, 'id' | 'created_at' | 'updated_at'>,
  supabase: SupabaseClient
): Promise<Person> {
  const { data, error } = await supabase
    .from('people')
    .insert([person])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePerson(
  id: string, 
  updates: Partial<Omit<Person, 'id' | 'user_id' | 'created_at'>>,
  supabase: SupabaseClient
): Promise<Person> {
  const { data, error } = await supabase
    .from('people')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePerson(id: string, supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from('people')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Message operations
export async function getMessages(personId: string, supabase: SupabaseClient): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('person_id', personId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createMessage(
  messageData: {
    person_id: string;
    content: string;
    is_user: boolean;
  },
  supabase: SupabaseClient
): Promise<Message> {
  // Handle special case for '1-1' assistant
  if (messageData.person_id === '1-1') {
    const { data, error } = await supabase
      .from('messages')  
      .insert({
        person_id: '1-1',
        content: messageData.content,
        is_user: messageData.is_user
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single();

  if (error) throw error;
  return data;
}