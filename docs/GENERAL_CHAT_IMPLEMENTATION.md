# General Chat Architecture - Implementation Guide

## Overview

The General Chat feature provides every user with a dedicated "General" conversation that serves as their management coaching entry point and ongoing strategic thinking space. This is implemented using `person_id = 'general'` as a special reserved value.

## Architecture Decisions

### Database Design
- **`person_id = 'general'`**: Special reserved value that doesn't correspond to any row in the `people` table
- **Clean separation**: General conversations are stored alongside person-specific conversations in the same `messages` table
- **User isolation**: Each user has their own general conversation via `user_id` column

### Key Benefits
- ✅ **Simple data model**: No separate tables or complex joins needed
- ✅ **Unified message handling**: Same API endpoints work for both general and person-specific chats  
- ✅ **Cross-conversation intelligence**: Vector search includes general conversations in context building
- ✅ **Scalable**: Handles multiple users with isolated general conversations

## Database Schema

### Messages Table Structure
```sql
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id TEXT NOT NULL, -- 'general' or UUID from people table
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_user BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security (RLS)
```sql
-- Users can only access their own messages
CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (
    (person_id = 'general' AND user_id = auth.uid()) OR
    (person_id != 'general' AND EXISTS (
      SELECT 1 FROM people 
      WHERE people.id::text = messages.person_id 
      AND people.user_id = auth.uid()
    ))
  );
```

### Data Integrity
```sql
-- Ensure person_id is either 'general' or valid UUID
ALTER TABLE messages ADD CONSTRAINT messages_person_id_format_check 
  CHECK (
    person_id = 'general' OR 
    (person_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  );
```

## API Implementation

### Unified Message Handling
All API endpoints handle 'general' as a special case:

```typescript
// GET /api/messages?person_id=general
if (personId === 'general') {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('person_id', 'general')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  
  return NextResponse.json({ messages: data || [] });
}
```

### Chat Streaming
```typescript
// POST /api/chat/stream
if (person_id === 'general') {
  person = {
    id: 'general',
    name: 'General',
    role: 'Management Assistant',
    relationship_type: 'assistant'
  };
}
```

## Frontend Implementation

### Navigation
General chat appears at the top of the people list with special styling:

```tsx
{/* Always show General chat first */}
<Link href="/people/general" className="block">
  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200">
    <div className="flex items-center space-x-4">
      <div className="text-2xl">🤲</div>
      <div>
        <div className="font-medium-bold">General</div>
        <div className="text-sm text-gray-600">Management coaching and strategic advice</div>
      </div>
    </div>
  </div>
</Link>

{/* Separator */}
<div className="border-t border-gray-200 my-2" />

{/* Regular people list */}
```

### Routing
The dynamic route `/people/[id]/page.tsx` handles both cases:

```typescript
const personId = params.id; // Can be 'general' or UUID

if (personId === 'general') {
  setPerson({
    id: 'general',
    name: 'General', 
    role: 'Your Management Coach',
    relationship_type: 'assistant'
  });
}
```

### Onboarding Flow
New users are automatically redirected to general chat:

```typescript
// app/page.tsx
if (!profile?.onboarding_completed) {
  router.push('/people/general') // Start onboarding in general chat
} else {
  router.push('/people') // Go to people overview
}
```

## Vector Search Integration

### Cross-Conversation Intelligence
The vector service properly handles general conversations:

```typescript
async findSemanticContext(userId: string, currentQuery: string, currentPersonId: string) {
  const [similarConversations, crossPersonInsights] = await Promise.all([
    // Include general conversations when relevant
    this.searchSimilarConversations(userId, currentQuery, {
      personFilter: currentPersonId !== 'general' ? currentPersonId : undefined,
      limit: 5
    }),
    
    // Cross-person insights exclude current conversation
    this.searchSimilarConversations(userId, currentQuery, { limit: 8 })
      .then(results => results.filter(r => r.person_id !== currentPersonId))
  ]);
}
```

### Context Building
Management context includes general conversations:

```typescript
// Get general messages for context
const { data: generalMessages } = await supabase
  .from('messages')
  .select('*')
  .eq('person_id', 'general')
  .eq('user_id', userId)
  .order('created_at', { ascending: true });
```

## Performance Optimizations

### Database Indexes
```sql
-- Optimized queries for general conversations
CREATE INDEX messages_general_user_id_idx ON messages (user_id) WHERE person_id = 'general';
CREATE INDEX messages_person_id_user_id_idx ON messages (person_id, user_id);
CREATE INDEX messages_created_at_idx ON messages (created_at);
```

### Helper View
```sql
-- Simplified querying with person details
CREATE VIEW messages_with_person_info AS
SELECT 
  m.*,
  CASE 
    WHEN m.person_id = 'general' THEN 'General'
    ELSE p.name
  END as person_name,
  CASE 
    WHEN m.person_id = 'general' THEN 'Management Coach'  
    ELSE p.role
  END as person_role
FROM messages m
LEFT JOIN people p ON p.id::text = m.person_id AND m.person_id != 'general';
```

## Testing & Verification

### Run Migration
```bash
# Apply the migration
supabase db push

# Or run specific migration
psql -f supabase/migrations/20250619000000_general_chat_architecture.sql
```

### Verify Implementation
```bash
# Run verification script
psql -f scripts/verify-general-chat-architecture.sql
```

### Test Scenarios
1. **New user onboarding**: Should redirect to `/people/general`
2. **Message storage**: General messages save with `person_id = 'general'` and correct `user_id`
3. **Navigation**: General chat appears at top with special styling
4. **Cross-conversation**: General chat references insights from team conversations
5. **User isolation**: Users only see their own general messages

## Success Criteria

### ✅ Architecture Success
- [x] Clean data model with `person_id = 'general'` for general chat
- [x] Proper RLS policies ensuring user isolation  
- [x] Unified API handling both general and person-specific conversations
- [x] Vector search includes general conversations in context

### ✅ User Experience Success  
- [x] Visual distinction for General chat in navigation
- [x] Seamless onboarding flow starting in general conversation
- [x] Cross-conversation intelligence referencing team insights
- [x] Consistent routing and message handling

## Troubleshooting

### Common Issues

**General messages not appearing**
- Check user_id is properly set on messages
- Verify RLS policies allow access
- Confirm API routes handle 'general' case

**Onboarding not working**
- Check user_profiles table has onboarding_completed = false
- Verify redirect logic in app/page.tsx
- Ensure /people/general route is accessible

**Vector search not including general conversations**
- Check embeddings are being generated for general messages
- Verify vector service handles 'general' person_id
- Confirm management context includes general messages

### Debugging Queries
```sql
-- Check general messages for user
SELECT * FROM messages WHERE person_id = 'general' AND user_id = auth.uid();

-- Verify RLS policies
SELECT * FROM pg_policies WHERE tablename = 'messages';

-- Check orphaned messages
SELECT m.person_id, COUNT(*) 
FROM messages m 
LEFT JOIN people p ON p.id::text = m.person_id 
WHERE m.person_id != 'general' AND p.id IS NULL 
GROUP BY m.person_id;
```

This architecture provides a robust, scalable foundation for general management coaching conversations alongside person-specific relationship management. 