export interface Person {
    id: string;
    user_id: string;
    name: string;
    role: string | null;
    relationship_type: 'direct_report' | 'manager' | 'stakeholder' | 'peer' | string;
    created_at: string;
    updated_at: string;
    notes?: string | null;
    emoji?: string | null;
    team?: string | null;
    location?: string | null;
    start_date?: string | null;
    communication_style?: string | null;
    goals?: string | null;
    strengths?: string | null;
    challenges?: string | null;
    last_profile_prompt?: string | null;
    profile_completion_score?: number;
  }
  
  export interface Message {
    id: string;
    person_id: string | null;
    topic_id?: string | null;
    content: string;
    is_user: boolean;
    file_count?: number; // Number of attached files
    created_at: string;
    updated_at?: string;
    role?: 'user' | 'assistant'; // Legacy field for compatibility
  }
  
  export interface MessageFile {
    id: string;
    user_id: string;
    message_id: string;
    filename: string; // Unique filename in storage
    original_name: string; // Original filename from user
    file_type: 'image' | 'document' | 'transcript' | 'unknown';
    content_type: string; // MIME type
    file_size: number; // Size in bytes
    storage_path: string; // Path in Supabase Storage
    metadata?: Record<string, any>; // Additional metadata
    created_at: string;
    updated_at: string;
    url?: string; // Computed field for access URL
    icon?: string; // Computed field for display icon
  }
  
  // Legacy interface for backward compatibility
  export interface LegacyMessageFile {
    id: string;
    name: string;
    type: 'image' | 'transcript' | 'document';
    size: number;
    url?: string; // For preview/download
    icon: string; // Emoji icon for file type
  }
  
  export interface Database {
    public: {
      Tables: {
        people: {
          Row: Person;
          Insert: Omit<Person, 'id' | 'created_at' | 'updated_at'>;
          Update: Partial<Omit<Person, 'id' | 'user_id' | 'created_at'>>;
        };
        messages: {
          Row: Message;
          Insert: Omit<Message, 'id' | 'created_at' | 'updated_at'>;
          Update: Partial<Omit<Message, 'id' | 'created_at' | 'updated_at'>>;
        };
        message_files: {
          Row: MessageFile;
          Insert: Omit<MessageFile, 'id' | 'created_at' | 'updated_at' | 'url' | 'icon'>;
          Update: Partial<Omit<MessageFile, 'id' | 'user_id' | 'message_id' | 'created_at' | 'updated_at'>>;
        };
      };
    };
  }