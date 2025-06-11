# Mano - Architecture & How It Works

**Your helping hand in management** 🤲

## Overview

Mano is an AI-powered Progressive Web App (PWA) designed to help managers build better relationships with their team members and stakeholders. It combines people management with intelligent conversation assistance, providing actionable insights and suggestions for effective leadership.

## 🎯 Core Purpose

Mano serves as a digital assistant for managers who want to:
- **Track relationships** with team members, stakeholders, and peers
- **Get AI-powered advice** on management situations and conversations
- **Prepare for 1-on-1 meetings** with suggested topics and insights
- **Access their management toolkit** anywhere, even offline (PWA capabilities)

## 🏗️ Architecture Overview

### Tech Stack

**Frontend:**
- **Next.js 15** with App Router for modern React development
- **TypeScript** for type safety and better developer experience
- **Tailwind CSS** for utility-first styling
- **Shadcn/UI** for consistent, accessible UI components

**Backend & Database:**
- **Supabase** for authentication, database, and real-time features
- **PostgreSQL** (via Supabase) for data persistence
- **Row Level Security (RLS)** for data protection

**AI Integration:**
- **Anthropic Claude (Sonnet 4)** for intelligent management advice and conversation assistance

**PWA Features:**
- **Service Worker** for offline functionality
- **Web App Manifest** for app-like installation experience
- **iOS-optimized** with proper icons, splash screens, and meta tags

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                   │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Pages & UI    │   Components    │    PWA Features         │
│                 │                 │                         │
│ • Landing       │ • People List   │ • Service Worker       │
│ • Authentication│ • Person Detail │ • Install Prompt       │
│ • People Mgmt   │ • Chat Interface│ • Offline Support      │
│ • AI Chat       │ • Forms         │ • iOS Optimization     │
└─────────────────┴─────────────────┴─────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js API Routes)           │
├─────────────────┬─────────────────┬─────────────────────────┤
│   People API    │   Messages API  │    Chat API             │
│                 │                 │                         │
│ • CRUD ops      │ • Conversation  │ • Claude Integration    │
│ • User filtering│   history       │ • Context management    │
│ • Validation    │ • Real-time     │ • Error handling        │
└─────────────────┴─────────────────┴─────────────────────────┘
                           │
    ┌─────────────────────────────┐    ┌─────────────────────┐
    │     Supabase Backend        │    │   Anthropic Claude  │
    │                             │    │                     │
    │ • PostgreSQL Database       │    │ • Management Advice │
    │ • Row Level Security        │    │ • Conversation AI   │
    │ • Real-time subscriptions   │    │ • Context-aware     │
    │ • Authentication            │    │ • Retry logic       │
    └─────────────────────────────┘    └─────────────────────┘
```

## 📊 Data Model

### Core Entities

#### People Table
```typescript
interface Person {
  id: string;                    // UUID primary key
  user_id: string;              // Foreign key to auth.users
  name: string;                 // Person's full name
  role: string | null;          // Job title/role
  relationship_type: string;    // 'direct_report' | 'manager' | 'stakeholder' | 'peer'
  created_at: string;          // Timestamp
  updated_at: string;          // Timestamp
}
```

#### Messages Table
```typescript
interface Message {
  id: string;           // UUID primary key
  person_id: string;    // Foreign key to people.id
  content: string;      // Message content
  is_user: boolean;     // true for user messages, false for AI responses
  created_at: string;   // Timestamp
}
```

### Database Relationships

```
Users (Supabase Auth)
├── People (1:many)
    └── Messages (1:many)
```

## 🔐 Security Model

### Authentication
- **Supabase Auth** handles user registration, login, and session management
- **Email/password** authentication with secure password reset flows
- **JWT tokens** for stateless authentication

### Authorization
- **Row Level Security (RLS)** ensures users can only access their own data
- **Server-side verification** in API routes
- **Client-side protection** for UI components

### Data Protection
- **Environment variables** for sensitive API keys
- **Server-side API calls** to external services (Claude API)
- **Input validation** and sanitization

## 🚀 Core Features Deep Dive

### 1. People Management

**Purpose**: Central hub for tracking relationships with team members, stakeholders, and peers.

**Key Components**:
- **People List** (`/people`) - Overview of all contacts with search and filtering
- **Add Person** (`/people/new`) - Form to add new team members
- **Person Detail** (`/people/[id]`) - Individual profile with conversation history

**User Flow**:
1. User adds people with name, role, and relationship type
2. System categorizes relationships (direct reports, manager, stakeholders, peers)
3. Each person gets a dedicated space for notes and AI conversations

### 2. AI-Powered Conversations

**Purpose**: Intelligent management coaching and advice tailored to specific relationships.

**AI System Prompt**:
```typescript
"You are Mano, an intelligent management assistant and helping hand for managers.
Your role is to:
- Provide thoughtful management advice based on conversation history
- Suggest conversation starters and topics for 1-1s
- Help managers track important information about their people
- Offer insights about team dynamics and individual needs
- Be supportive but practical in your guidance"
```

**Context Awareness**:
- **Person-specific context**: Name, role, relationship type
- **Conversation history**: Last 10 messages for continuity
- **Relationship dynamics**: Different advice for direct reports vs. stakeholders

**Technical Implementation**:
- **Streaming responses** for real-time conversation feel
- **Error handling** with retry logic for API failures
- **Rate limiting** protection
- **Context management** to maintain conversation flow

### 3. Progressive Web App (PWA)

**Purpose**: Provide a native app-like experience, especially on iOS devices.

**Key PWA Features**:
- **Installable**: Users can add to home screen
- **Offline capable**: Service worker caches key resources
- **App-like UI**: Standalone mode without browser chrome
- **iOS optimized**: Proper icons, splash screens, and touch interactions

**Technical Implementation**:
- **Web App Manifest** defines app metadata and behavior
- **Service Worker** handles caching and offline functionality
- **Install Prompt** provides custom installation experience
- **iOS-specific meta tags** for optimal Safari integration

## 🔄 User Journey

### First-Time User
1. **Landing page** introduces Mano's value proposition
2. **Sign up/Sign in** using email and password
3. **Add first person** to their management network
4. **Start conversation** with AI for management advice

### Returning User
1. **Quick access** via PWA icon on home screen
2. **People overview** shows all contacts at a glance
3. **Continue conversations** from where they left off
4. **Add new people** or update existing relationships

### Typical Session
1. **Review people list** to see who needs attention
2. **Open specific person** to review history
3. **Chat with AI** about upcoming 1-1 or management challenge
4. **Take action** based on AI recommendations

## 📱 PWA Implementation Details

### Service Worker Strategy
- **Cache-first** for static assets (icons, CSS, JS)
- **Network-first** for dynamic content (API calls)
- **Fallback support** for offline scenarios

### iOS Optimization
- **Status bar integration** with proper styling
- **Safe area support** for modern iOS devices
- **Touch interaction** optimization
- **Launch experience** with custom splash screens

### Installation Experience
- **Custom install prompt** instead of browser default
- **Installation tracking** to avoid repeated prompts
- **Update notifications** when new versions are available

## 🔧 Development Patterns

### Component Architecture
- **Page components** for routing and layout
- **Feature components** for specific functionality
- **UI components** from shadcn/ui for consistency
- **Client/Server separation** with proper hydration

### API Design
- **RESTful endpoints** for CRUD operations
- **Consistent error handling** across all endpoints
- **Type-safe responses** using TypeScript interfaces
- **Authentication middleware** for protected routes

### State Management
- **React hooks** for local component state
- **Supabase client** for data fetching and real-time updates
- **URL state** for shareable application states
- **Local storage** for PWA preferences

## 🚀 Deployment & Infrastructure

### Hosting
- **Netlify** for frontend deployment and hosting
- **Automatic deployments** from Git repository
- **Environment variable management** for configuration
- **CDN distribution** for global performance

### Database & Backend
- **Supabase cloud** for managed PostgreSQL
- **Automatic backups** and point-in-time recovery
- **Global edge functions** for low-latency API responses
- **Real-time capabilities** for future collaborative features

### External Services
- **Anthropic Claude API** for AI capabilities
- **Retry logic** and error handling for reliability
- **Rate limiting** to manage costs and usage

## 🎯 Key Design Decisions

### Why PWA?
- **Cross-platform compatibility** without app store complexity
- **Instant updates** without user intervention
- **Lower development overhead** than native apps
- **iOS support** has significantly improved for PWAs

### Why Supabase?
- **Full-stack solution** with auth, database, and real-time features
- **PostgreSQL** for robust relational data modeling
- **Row Level Security** for secure multi-tenant architecture
- **TypeScript support** for end-to-end type safety

### Why Claude?
- **Advanced reasoning** for complex management scenarios
- **Context awareness** for personalized advice
- **Reliable API** with good rate limits
- **Quality responses** suitable for professional use

### Why Next.js?
- **App Router** for modern React development patterns
- **Server-side rendering** for better performance and SEO
- **API routes** for backend functionality
- **TypeScript integration** for development productivity

## 🔄 Future Enhancements

### Planned Features
- **Team insights** across multiple people
- **Meeting preparation** with AI-generated agendas
- **Progress tracking** for management goals
- **Integration** with calendar and email systems

### Technical Improvements
- **Real-time collaboration** using Supabase subscriptions
- **Push notifications** for important reminders
- **Advanced offline support** with data synchronization
- **Analytics** for usage insights and optimization

---

**Mano** represents a modern approach to management assistance, combining the accessibility of web technologies with the intelligence of AI to create a truly helpful tool for managers at any level. 