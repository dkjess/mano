export interface Person {
    id: string;
    user_id: string;
    name: string;
    role: string | null;
    relationship_type: 'direct_report' | 'manager' | 'stakeholder' | 'peer' | string;
    created_at: string;
    updated_at: string;
  }
  
  export interface Message {
    id: string;
    person_id: string;
    content: string;
    is_user: boolean;
    created_at: string;
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
          Insert: Omit<Message, 'id' | 'created_at'>;
          Update: Partial<Omit<Message, 'id' | 'created_at'>>;
        };
      };
    };
  }