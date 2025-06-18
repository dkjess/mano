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
    person_id: string;
    content: string;
    role: 'user' | 'assistant';
    created_at: string;
    updated_at: string;
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
      };
    };
  }