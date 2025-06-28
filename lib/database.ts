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
  
  // Fetch files for each message
  const messagesWithFiles = await Promise.all((data || []).map(async (message) => {
    const { data: files } = await supabase
      .from('message_files')
      .select('original_name, file_type, file_size, storage_path, content_type')
      .eq('message_id', message.id);
    
    // Add file info to message content if files exist
    if (files && files.length > 0) {
      let fileInfo = '\n\n[Attached files:]';
      
      for (const file of files) {
        fileInfo += `\n- ${file.original_name}`;
        
        // For historical context, just include file names and types
        // Don't download content to keep message history lightweight
        if (file.file_type === 'transcript' || file.content_type.startsWith('text/')) {
          fileInfo += ' (text file)';
        } else if (file.file_type === 'image') {
          fileInfo += ' (image)';
        } else if (file.file_type === 'document') {
          fileInfo += ' (document)';
        }
      }
      
      return {
        ...message,
        content: message.content + fileInfo
      };
    }
    
    return message;
  }));
  
  return messagesWithFiles;
}

export async function createMessage(
  messageData: {
    person_id: string;
    content: string;
    is_user: boolean;
    user_id?: string;
  },
  supabase: SupabaseClient
): Promise<Message> {
  // Ensure user_id is provided for all messages
  if (!messageData.user_id) {
    throw new Error('user_id is required for all messages');
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      person_id: messageData.person_id,
      content: messageData.content,
      is_user: messageData.is_user,
      user_id: messageData.user_id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}