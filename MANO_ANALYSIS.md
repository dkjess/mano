# Mano Project Architecture Analysis

**Generated:** 2025-06-25  
**Version:** Current as of commit dc3d05f

## Project Overview

**Mano** is an AI-powered management assistant built with Next.js and Supabase, designed to help managers build better relationships with their teams through contextual coaching and conversation intelligence.

## Project Structure

### File Tree Overview

```
mano/
├── app/                           # Next.js App Router
│   ├── api/                       # API Routes
│   │   ├── auth/logout/           # Authentication endpoints
│   │   ├── chat/                  # Chat streaming & processing
│   │   ├── dev/reset-user/        # Development utilities
│   │   ├── messages/              # Message CRUD operations
│   │   ├── people/                # People management endpoints
│   │   └── topics/                # Topics management endpoints
│   ├── auth/                      # Authentication pages
│   │   ├── callback/, confirm/    # OAuth callbacks
│   │   ├── login/, sign-up/       # User onboarding
│   │   ├── forgot-password/       # Password recovery
│   │   └── error/                 # Error handling
│   ├── debug/                     # Debug utilities
│   ├── people/                    # People management pages
│   │   ├── [id]/                  # Dynamic person chat pages
│   │   ├── new/                   # Add new person
│   │   └── layout.tsx             # People section layout
│   ├── topics/                    # Topics management pages
│   │   ├── [topicId]/            # Dynamic topic pages
│   │   ├── new/                   # Create new topic
│   │   └── layout.tsx             # Topics section layout
│   ├── protected/                 # Protected pages wrapper
│   ├── globals.css                # Global styles
│   └── layout.tsx                 # Root application layout
├── components/                    # React components
│   ├── auth-button.tsx           # Authentication components
│   ├── Sidebar.tsx               # Main navigation sidebar
│   ├── chat/                     # Chat-related components
│   │   ├── ChatLayout.tsx        # Chat interface layout
│   │   ├── EnhancedChatInput.tsx # Rich text input with files
│   │   ├── MessageBubble.tsx     # Message display component
│   │   ├── StreamingChatPage.tsx # Streaming chat interface
│   │   └── FilePreview.tsx       # File attachment handling
│   ├── debug/                    # Debug components
│   ├── tutorial/                 # Onboarding tutorials
│   └── ui/                       # Reusable UI components
├── lib/                          # Core utilities & logic
│   ├── api/                      # API client utilities
│   ├── contexts/                 # React contexts
│   ├── hooks/                    # Custom React hooks
│   ├── supabase/                 # Supabase configuration
│   ├── claude.ts                 # Claude AI integration
│   ├── person-detection.ts       # AI person recognition
│   └── management-context.ts     # Context building for AI
├── supabase/                     # Database & backend
│   ├── config.toml              # Supabase configuration
│   ├── functions/               # Edge functions
│   │   ├── _shared/             # Shared utilities
│   │   └── chat/                # Chat processing
│   └── migrations/              # Database schema migrations
├── types/                       # TypeScript definitions
├── docs/                        # Documentation
├── scripts/                     # Utility scripts
└── public/                      # Static assets including PWA icons
```

## Next.js Architecture

### Router Type: **App Router**

The project uses Next.js 15 with the modern App Router architecture, confirmed by:
- Presence of `app/` directory with `layout.tsx` and `page.tsx` files
- API routes in `app/api/` directories with `route.ts` files
- Dynamic routes using `[id]` and `[topicId]` folder structure
- Layout files at multiple levels (`app/layout.tsx`, `app/people/layout.tsx`, etc.)

### Key App Router Features Used:
- **Dynamic Routes**: `/people/[id]`, `/topics/[topicId]`
- **Route Groups**: Authentication routes grouped under `/auth`
- **Nested Layouts**: Separate layouts for people and topics sections
- **API Routes**: RESTful endpoints for chat, messages, people, and topics
- **Streaming Responses**: Real-time chat streaming via `/api/chat/stream`

## Main Layout Architecture

### Root Layout (`app/layout.tsx`)

**Type**: Progressive Web App (PWA) enabled layout

**Key Features**:
- **PWA Configuration**: Complete manifest, service worker, and app icons
- **Responsive Design**: Mobile-first with viewport optimizations
- **iOS Safari Optimizations**: Specific meta tags for iOS web app experience
- **Global Components**: ServiceWorkerRegistration, InstallPrompt, DebugPanel

**Architecture**:
```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* PWA & iOS optimizations */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />
      </head>
      <body>
        <ServiceWorkerRegistration />
        <InstallPrompt />
        {children}
        <DebugPanel />
      </body>
    </html>
  );
}
```

## Supabase Database Schema

### Core Tables

#### **people** Table
```sql
CREATE TABLE people (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  relationship_type TEXT NOT NULL, -- 'direct_report', 'manager', 'stakeholder', 'peer'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Extended profile fields
  notes TEXT,
  emoji TEXT,
  team TEXT,
  location TEXT,
  start_date TEXT,
  communication_style TEXT,
  goals TEXT,
  strengths TEXT,
  challenges TEXT,
  last_profile_prompt TEXT,
  profile_completion_score INTEGER
);
```

#### **messages** Table
```sql
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id TEXT NOT NULL, -- 'general' or UUID from people table
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE NULL,
  content TEXT NOT NULL,
  is_user BOOLEAN NOT NULL,
  role TEXT, -- 'user' | 'assistant' for compatibility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **topics** Table (Recent Addition)
```sql
CREATE TABLE topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  participants TEXT[], -- Array of person names/IDs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security (RLS)

**Comprehensive user isolation** implemented across all tables:
- Users can only access their own people, messages, and topics
- Special handling for `person_id = 'general'` in RLS policies
- Secure API endpoints with user authentication checks

## Current Sidebar Implementation

### Location: `components/Sidebar.tsx`

### Architecture: **Responsive Collapsible Navigation**

**Key Features**:
- **Responsive Design**: Fixed overlay on mobile (≤768px), always-visible on desktop
- **Mobile Optimizations**: Touch-friendly interactions, overlay backdrop, smooth animations
- **Navigation Sections**: Coach (General), Your Team (People), Topics
- **State Management**: Uses React hooks with imperative handle for external control

### Current Structure:
```tsx
export const Sidebar = forwardRef<SidebarRef, SidebarProps>(function Sidebar({ currentPersonId, currentTopicId }, ref) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { people } = usePeople()
  const { topics } = useTopics()

  // Responsive behavior logic
  // Desktop: always visible, mobile: collapsible overlay
  
  return (
    <>
      <button className="sidebar-toggle" onClick={toggleSidebar}>☰</button>
      <div className="sidebar-overlay" onClick={closeSidebar} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Navigation sections */}
      </aside>
    </>
  )
})
```

### Navigation Sections:

1. **Coach Section**:
   - Contains "General" management coaching chat
   - Special styling with 🤲 emoji and distinctive appearance
   - Always accessible via `/people/general`

2. **Your Team Section**:
   - Dynamic list of added people/team members
   - Shows relationship emoji and role/relationship type
   - Add button (+) for creating new people
   - Empty state when no people added

3. **Topics Section**:
   - List of conversation topics
   - Shows participant count
   - Add button (+) for creating new topics
   - Empty state when no topics created

### Mobile Behavior:
- **Breakpoint**: 768px
- **Mobile**: Overlay sidebar with toggle button and backdrop
- **Desktop**: Always-visible sidebar, ignore toggle actions
- **Auto-close**: Sidebar closes automatically on navigation (mobile only)

## Current 'General' Implementation

### Overview
The "General" chat is a **special reserved conversation** that serves as the management coaching entry point for every user. It's implemented as a virtual person with `person_id = 'general'`.

### Architecture Pattern: **Virtual Person Approach**

**Key Design Decision**: 
- Uses `person_id = 'general'` as a special reserved value
- Does **not** correspond to any row in the `people` table
- Treated as a virtual assistant/coach persona

### Database Implementation:
```sql
-- RLS Policy Example
CREATE POLICY "Users can view messages for their people" ON messages
  FOR SELECT USING (
    person_id = 'general' OR  -- Allow access to general chat
    EXISTS (
      SELECT 1 FROM people 
      WHERE people.id::text = messages.person_id 
      AND people.user_id = auth.uid()
    )
  );
```

### Frontend Implementation:

#### **Routing** (`/people/general`):
```tsx
// app/people/[id]/page.tsx
if (personId === 'general') {
  setPerson({
    id: 'general',
    user_id: '', 
    name: 'General',
    role: 'Your Management Coach',
    relationship_type: 'assistant',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}
```

#### **Sidebar Navigation**:
```tsx
// components/Sidebar.tsx - Coach Section
<Link 
  href="/people/general" 
  className={`nav-item nav-item--special ${currentPersonId === 'general' ? 'active' : ''}`}
>
  <span className="nav-item-emoji">🤲</span>
  <div className="nav-item-content">
    <span className="nav-item-name">General</span>
    <span className="nav-item-subtitle">Management coaching</span>
  </div>
</Link>
```

#### **API Handling**:
```tsx
// Unified message handling for both general and person-specific chats
if (personId === 'general') {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('person_id', 'general')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
}
```

### User Experience:
- **Onboarding**: New users are redirected to `/people/general` to start
- **Visual Distinction**: Special styling with 🤲 emoji and blue gradient background
- **Context**: Serves as strategic thinking space and coaching entry point
- **Intelligence**: Includes cross-conversation insights from team conversations

### Benefits of Current Implementation:
- ✅ **Simple Data Model**: No separate tables needed
- ✅ **Unified API**: Same endpoints handle both general and person-specific chats
- ✅ **Cross-Conversation Intelligence**: Vector search includes general conversations
- ✅ **User Isolation**: Each user has their own general conversation
- ✅ **Scalable**: Handles multiple users efficiently

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: CSS with CSS Variables, Responsive Design
- **State Management**: React Context + Custom Hooks
- **PWA**: Full Progressive Web App support
- **UI Components**: Custom components + Radix UI primitives

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: WebSocket subscriptions (Supabase Realtime)
- **File Storage**: Supabase Storage (implied by file handling code)
- **Edge Functions**: Supabase Edge Functions for serverless processing

### AI Integration
- **Primary AI**: Anthropic Claude (via @anthropic-ai/sdk)
- **Features**: 
  - Streaming chat responses
  - Person detection in conversations
  - Profile completion suggestions
  - Management context building
  - Vector search for conversation intelligence

### Development & Deployment
- **Package Manager**: pnpm
- **Linting**: ESLint with Next.js config
- **Database Migrations**: Supabase CLI
- **Deployment**: Netlify (based on netlify.toml)

## Key Features

### 1. **AI-Powered Conversations**
- Real-time streaming chat responses
- Context-aware responses using conversation history
- Cross-person insights and relationship intelligence

### 2. **Person Management**
- Add team members with relationship types (manager, direct report, peer, stakeholder)
- Rich profile system with role, team, goals, strengths, challenges
- AI-powered profile completion suggestions

### 3. **Topic-Based Conversations**
- Create conversation topics with multiple participants
- Separate message threads for focused discussions
- Cross-reference insights between people and topics

### 4. **Mobile-First PWA**
- Installable web app with offline capabilities
- Responsive design optimized for mobile management use cases
- iOS Safari optimizations for native app-like experience

### 5. **Enhanced File Handling**
- Drag-and-drop file upload
- Support for images, transcripts, and documents
- File content integration into AI context

## Recent Developments

Based on recent commits and migration files:

### 1. **Topics MVP** (June 2025)
- Added topics table and topic-based messaging
- Implemented multi-participant conversation support
- Integrated topics into sidebar navigation

### 2. **Mobile Optimizations** (June 2025)
- Fixed responsive sidebar behavior
- Improved mobile touch interactions
- Resolved sidebar toggle issues on various screen sizes

### 3. **Enhanced Person Detection** (June 2025)
- AI-powered detection of people mentioned in conversations
- Automatic suggestions to add detected people to team
- Improved person relationship intelligence

### 4. **Profile Completion System** (June 2025)
- Added profile completion scoring
- AI-generated prompts for completing team member profiles
- Enhanced context building from complete profiles

## Architecture Strengths

### 1. **Scalable Data Model**
- Clean separation between users, people, messages, and topics
- Efficient RLS policies for multi-tenant isolation
- Special handling for general chat without additional complexity

### 2. **Modern React Patterns**
- Context API for global state management
- Custom hooks for reusable logic
- Component composition with proper separation of concerns

### 3. **Progressive Enhancement**
- Works as traditional web app
- Enhanced with PWA capabilities
- Mobile-optimized without sacrificing desktop experience

### 4. **AI Integration Architecture**
- Streaming responses for real-time feedback
- Vector search for intelligent context building
- Modular AI services for different use cases

## Areas for Future Enhancement

### 1. **Real-time Collaboration**
- Multi-user topic conversations
- Live typing indicators
- Presence awareness

### 2. **Advanced Analytics**
- Team interaction patterns
- Communication insights
- Performance tracking integration

### 3. **Integration Ecosystem**
- Calendar integration for meeting context
- Slack/Teams integration for communication context
- Performance review system integration

## Supabase Database Architecture Deep Dive

### Complete Migration History

The database schema has evolved through 10+ migrations, showing careful progression:

#### **20250609094442_create_initial_schema.sql** - Foundation
- Created core `people` and `messages` tables
- Established RLS policies for multi-tenant isolation
- Initial support for `person_id = 'general'` in message policies

#### **20250609130000_add_vector_embeddings.sql** - AI Intelligence
- Added pgvector extension for semantic search
- Created `conversation_embeddings` table for message vectorization
- Added `conversation_summary_embeddings` for long-term context
- Implemented vector similarity search functions
- **Key Innovation**: Enables cross-conversation intelligence and semantic context

#### **20250618000000_consolidate_setup.sql** - User Management
- Added `user_profiles` table with onboarding tracking
- Created automatic user profile creation trigger
- Added `debug_mode` for development testing
- Ensured `user_id` column exists in messages table

#### **20250619000000_general_chat_architecture.sql** - General Chat System
- **Formalized General Chat Architecture**
- Added comprehensive RLS policies for `person_id = 'general'`
- Created validation functions and constraints
- Added `messages_with_person_info` view for easy querying
- **Critical**: This migration establishes the architectural foundation for General chat

#### **20250620000000_profile_completion_schema.sql** - Enhanced Profiles
- Extended `people` table with rich profile fields
- Added automatic profile completion scoring (0-100)
- Created trigger for automatic score calculation
- Added analytics view for profile completeness tracking

#### **20250621000000+** - Topics MVP
- Added `topics` table for multi-participant conversations
- Extended messages table with `topic_id` support
- Created constraints ensuring proper message referencing
- Evolved to allow NULL `person_id` for topic-only messages

### Advanced Database Features

#### **Vector Search Intelligence**
```sql
-- Semantic similarity search across all conversations
CREATE OR REPLACE FUNCTION match_conversation_embeddings(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  person_filter text DEFAULT NULL
) RETURNS TABLE (...)
```

**Capabilities**:
- Cross-conversation context building
- Person-specific conversation filtering
- Similarity threshold tuning
- Support for both general and person-specific insights

#### **Profile Completion System**
```sql
CREATE OR REPLACE FUNCTION calculate_profile_completion_score(person_record people)
RETURNS INTEGER
```

**Scoring Algorithm**:
- Role: 20 points
- Notes: 15 points  
- Team/Communication Style/Goals/Strengths/Challenges: 10 points each
- Emoji/Location/Start Date: 5 points each
- **Total**: 100 points maximum

#### **Automated Triggers**
- **User Creation**: Auto-creates user profile on signup
- **Profile Updates**: Recalculates completion scores
- **Timestamp Management**: Updates `updated_at` automatically

## User Authentication & Onboarding Flow

### Complete Signup Flow

#### **1. Initial Access (`app/page.tsx`)**
```tsx
// Authentication Gate
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  router.push('/auth/login') // Redirect to login
  return
}

// Onboarding Check
const { data: profile } = await supabase
  .from('user_profiles')
  .select('onboarding_completed')
  .eq('user_id', user.id)
  .single()

if (!profile?.onboarding_completed) {
  router.push('/people/general') // NEW USER → General Chat
} else {
  router.push('/people/general') // EXISTING USER → General Chat
}
```

#### **2. Signup Options (`components/sign-up-form.tsx`)**

**Google OAuth** (Primary):
```tsx
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    scopes: 'openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly',
    redirectTo: `${window.location.origin}/auth/callback?redirect_to=/people/general`
  }
});
```

**Email/Password** (Secondary):
```tsx
await supabase.auth.signUp({ email, password });
router.push("/people/general"); // Direct redirect to General chat
```

#### **3. OAuth Callback (`app/auth/callback/route.ts`)**
```tsx
// Exchange OAuth code for session
const { error } = await supabase.auth.exchangeCodeForSession(code);

// Redirect to General chat for onboarding
return NextResponse.redirect(`${origin}${redirectTo ?? "/people/general"}`);
```

#### **4. Automatic Profile Creation**
**Database Trigger** (from `consolidate_setup.sql`):
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Key Authentication Features

#### **Supabase Configuration** (`supabase/config.toml`):
- **Email Confirmations**: Disabled (`enable_confirmations = false`)
- **Google OAuth**: Enabled with calendar/gmail scopes
- **Development**: Email testing via Inbucket
- **Security**: JWT expiry 1 hour, refresh token rotation enabled

#### **Progressive Enhancement**:
- Works without JavaScript (server-side auth)
- OAuth fallback to email/password
- Automatic session management
- Secure redirect handling

## General Chat Implementation Analysis

### Database Implementation

#### **Special Person ID Pattern**
```sql
-- Messages table constraint allowing 'general' as special case
ALTER TABLE messages ADD CONSTRAINT messages_person_id_format_check 
  CHECK (
    person_id = 'general' OR 
    (person_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  );
```

#### **RLS Policies** (from `general_chat_architecture.sql`):
```sql
CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (
    user_id = auth.uid() AND (
      person_id = 'general' OR  -- Allow general chat access
      EXISTS (
        SELECT 1 FROM people 
        WHERE people.id::text = messages.person_id 
        AND people.user_id = auth.uid()
      )
    )
  );
```

#### **Helper View**:
```sql
CREATE OR REPLACE VIEW messages_with_person_info AS
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
LEFT JOIN people p ON (m.person_id != 'general' AND p.id::text = m.person_id);
```

### Frontend Implementation

#### **Route Handling** (`app/people/[id]/page.tsx`):
```tsx
if (personId === 'general') {
  setPerson({
    id: 'general',
    user_id: '', 
    name: 'General',
    role: 'Your Management Coach',
    relationship_type: 'assistant',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}
```

#### **API Handling** (`app/api/messages/route.ts`):
```tsx
// Special case handling for general chat
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

#### **Streaming Chat** (`app/api/chat/stream/route.ts`):
```tsx
// Virtual person creation for 'general'
if (person_id === 'general') {
  person = {
    id: 'general',
    user_id: '',
    name: 'General',
    role: 'Management Assistant',
    relationship_type: 'assistant',
    // ... timestamps
  };
}
```

### Vector Search Integration

#### **Cross-Conversation Intelligence**:
```tsx
// Enhanced context building includes general conversations
const [similarConversations, allConversations] = await Promise.all([
  this.searchSimilarConversations(userId, currentQuery, {
    personFilter: currentPersonId !== 'general' ? currentPersonId : undefined,
    limit: 5
  }),
  currentPersonId !== 'general' 
    ? this.searchSimilarConversations(userId, currentQuery, { limit: 8 })
    : []
]);
```

**Key Innovation**: General chat conversations are included in vector search, enabling the system to reference insights from team conversations when providing management coaching.

## Conversation Creation & Management

### Message Creation Flow

#### **1. User Input Processing**
```tsx
// Enhanced chat input with file support
const handleSendMessage = async (content: string, dropzoneFiles?: DroppedFile[]) => {
  // Combine text content with file attachments
  let combinedMessage = content;
  
  // Process files for AI context
  if (dropzoneFiles && dropzoneFiles.length > 0) {
    const fileContents = await processFiles(dropzoneFiles);
    aiContextFiles = '\n\n' + fileContents.join('\n\n---\n\n');
  }
  
  // Create user message record
  const userMessage: Message = {
    id: `user-${Date.now()}`,
    person_id: personId,
    content: content, // Clean text only
    is_user: true,
    files: convertDroppedFilesToMessageFiles(dropzoneFiles) // Separate file metadata
  };
  
  addMessage(userMessage);
}
```

#### **2. API Streaming Process** (`/api/chat/stream`)
```tsx
// Enhanced context building
const contextBuilder = new ManagementContextBuilder(supabase, user.id);
const { context } = await contextBuilder.buildFullContext(person_id, userMessage);

// Vector-enhanced management context
const crossConversationInsights = buildSemanticContext(
  context.people, 
  context.semantic_context, 
  userMessage
);

// Claude streaming with full context
const stream = await getChatCompletionStreaming(
  userMessage,
  person.name,
  person.role,
  person.relationship_type,
  conversationHistory,
  managementContext // Includes vector insights
);
```

#### **3. Real-time Streaming Response**
```tsx
// Server-Sent Events stream
const readableStream = new ReadableStream({
  async start(controller) {
    let fullResponse = '';
    
    // Stream text deltas to client
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        const text = chunk.delta.text;
        fullResponse += text;
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'delta', 
          text 
        })}\n\n`));
      }
    }
    
    // Save complete response
    const assistantMessage = await createMessage({
      person_id,
      content: fullResponse,
      is_user: false,
      user_id: user.id
    }, supabase);
    
    // Store vector embeddings (background)
    vectorService.storeMessageEmbedding(
      user.id, person_id, assistantMessage.id, 
      fullResponse, 'assistant'
    ).catch(console.error);
  }
});
```

### Context Building Architecture

#### **Management Context Builder** (from `/api/chat/stream/route.ts`):
```tsx
class ManagementContextBuilder {
  async buildFullContext(currentPersonId: string, currentQuery?: string) {
    const [people, semanticContext] = await Promise.all([
      this.getPeopleOverview(),
      currentQuery ? this.getSemanticContext(currentQuery, currentPersonId) : undefined
    ]);

    return {
      context: {
        people,
        team_size: this.calculateTeamSize(people),
        semantic_context: semanticContext // Vector-enhanced insights
      }
    };
  }
}
```

#### **Semantic Context Integration**:
```tsx
// Build insights from vector search results
function buildSemanticContext(people: any[], semanticContext: any, currentQuery: string): string[] {
  const insights: string[] = [];

  // Add relevant past discussions
  if (semanticContext?.similar_conversations?.length > 0) {
    semanticContext.similar_conversations.slice(0, 3).forEach((conv: any) => {
      const personName = conv.person_id === 'general' ? 'General discussion' : 
        people.find(p => p.id === conv.person_id)?.name || 'Unknown';
      insights.push(`Previous ${personName} discussion: "${conv.content.substring(0, 100)}..." (${Math.round(conv.similarity * 100)}% relevant)`);
    });
  }

  // Add cross-person insights
  if (semanticContext?.cross_person_insights?.length > 0) {
    semanticContext.cross_person_insights.slice(0, 2).forEach((insight: any) => {
      const personName = people.find(p => p.id === insight.person_id)?.name || 'Unknown';
      insights.push(`${personName} pattern: "${insight.content.substring(0, 100)}..."`);
    });
  }

  return insights;
}
```

## Advanced Features Analysis

### Vector Search & AI Intelligence

#### **OpenAI Integration**:
- Uses `text-embedding-ada-002` for 1536-dimensional vectors
- Cosine similarity search with configurable thresholds
- Background embedding storage for all messages

#### **Cross-Conversation Intelligence**:
- Finds similar discussions across all people/topics
- Provides cross-person pattern insights
- Supports general chat context enrichment

### File Handling System

#### **Multi-Format Support**:
- **Images**: Visual content for context
- **Transcripts**: Meeting/call transcripts 
- **Documents**: Text files, PDFs, etc.
- **JSON**: Configuration/data files

#### **Dual Processing**:
- **UI Files**: Clean metadata for display
- **AI Context**: Full content integration for Claude

### Topics & Multi-Participant Conversations

#### **Database Design**:
```sql
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  participants JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- Messages can reference either person OR topic
ALTER TABLE messages 
ADD CONSTRAINT messages_reference_check 
  CHECK (
    (person_id IS NOT NULL AND topic_id IS NULL) OR 
    (topic_id IS NOT NULL AND person_id IS NULL)
  );
```

## Summary

Mano represents a sophisticated, production-ready web application that successfully combines AI-powered management coaching with practical team relationship management. The architecture demonstrates exceptional engineering practices:

### **Key Strengths**:
- **Elegant Data Model**: Virtual person approach for General chat avoids complexity
- **Advanced AI Integration**: Vector search enables cross-conversation intelligence
- **Production-Ready Auth**: Comprehensive OAuth + email flows with proper security
- **Scalable Architecture**: Clean separation of concerns with modern React patterns
- **Progressive Enhancement**: Works across devices with PWA capabilities

### **Technical Excellence**:
- **Database Evolution**: 10+ well-planned migrations showing careful progression
- **Vector Intelligence**: pgvector integration for semantic conversation analysis
- **Real-time Streaming**: Server-sent events for live chat responses
- **Comprehensive RLS**: Multi-tenant security with user isolation
- **Rich Context Building**: Cross-conversation insights and profile completion

### **Innovation Highlights**:
- **General Chat Architecture**: Special `person_id = 'general'` pattern is both simple and powerful
- **Vector-Enhanced Context**: AI responses include insights from previous conversations
- **Dual Message Systems**: Clean UI display + rich AI context processing
- **Profile Intelligence**: Automatic completion scoring with AI-driven prompts

The project is exceptionally well-positioned for scaling both in terms of features and users, with a solid foundation in Next.js App Router, Supabase, and modern React patterns. The implementation demonstrates deep understanding of both user experience and technical architecture requirements.