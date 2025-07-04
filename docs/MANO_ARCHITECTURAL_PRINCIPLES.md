# Mano Architectural Principles

## Core Philosophy

Mano is fundamentally an AI system that happens to have a user interface, not a traditional application with AI features bolted on. Every technical decision should advance this vision.

## Server-Side Intelligence Principles

### 1. **All Intelligence Server-Side**
- **Rule**: No AI reasoning, LLM calls, or intelligent processing on the client
- **Implementation**: All Anthropic/OpenAI API calls must be server-side
- **Validation**: Search codebase for `anthropic` or `openai` - should only appear in server files
- **Example**: ✅ `supabase/functions/chat/index.ts` ❌ Client components making LLM calls

### 2. **AI-Generated Content Only**
- **Rule**: Any system-generated message must use LLM intelligence, not hardcoded templates
- **Implementation**: Welcome messages, suggestions, insights must be dynamically generated
- **Validation**: Search for hardcoded message templates in API routes
- **Example**: ✅ `generatePersonWelcomeMessage()` ❌ Static template in `people/route.ts`

### 3. **Context-Aware Intelligence**
- **Rule**: Every AI interaction must leverage full user context (history, relationships, preferences)
- **Implementation**: Use ManagementContextBuilder and semantic search
- **Validation**: Check if AI calls include user's full context
- **Example**: ✅ Enhanced prompts with conversation history ❌ Isolated AI calls

### 4. **Progressive Intelligence**
- **Rule**: System learns and improves responses based on user interactions
- **Implementation**: Store embeddings, analyze patterns, adapt responses
- **Validation**: Check for feedback loops and learning mechanisms
- **Example**: ✅ Vector storage and retrieval ❌ Static responses

## Client-Side Restrictions

### 5. **Thin Client Architecture**
- **Rule**: Clients handle only UI rendering and user input collection
- **Implementation**: No business logic, complex processing, or external API calls
- **Validation**: Client components should only call internal Next.js API routes
- **Example**: ✅ `fetch('/api/people')` ❌ Direct external API calls

### 6. **No Client-Side Secrets**
- **Rule**: Zero API keys, tokens, or sensitive data in client code
- **Implementation**: All secrets in server environment variables
- **Validation**: Search client files for API keys or credentials
- **Example**: ✅ `process.env.ANTHROPIC_API_KEY` in server ❌ API keys in client

### 7. **Minimal Client State**
- **Rule**: Client stores only UI state and cached display data
- **Implementation**: Complex state management happens server-side
- **Validation**: Check for complex business logic in client state
- **Example**: ✅ UI loading states ❌ Complex business calculations

## Knowledge-Centric Principles

### 8. **Everything is Context**
- **Rule**: All user inputs, interactions, and data become part of the knowledge graph
- **Implementation**: Store embeddings, build relationships, enable semantic search
- **Validation**: Check if new data creates embeddings and relationships
- **Example**: ✅ Message embedding storage ❌ Isolated data storage

### 9. **Cross-Conversation Intelligence**
- **Rule**: Insights from one conversation inform all others
- **Implementation**: Semantic search across all user data
- **Validation**: Check if AI responses reference relevant cross-conversation context
- **Example**: ✅ "Based on your conversation with Sarah about X..." ❌ Isolated conversations

### 10. **Proactive Intelligence**
- **Rule**: System anticipates needs and provides unprompted value
- **Implementation**: Background analysis, predictive suggestions, contextual prompts
- **Validation**: Check for proactive features beyond reactive responses
- **Example**: ✅ "It's been a while since you talked with X" ❌ Only reactive responses

## User Experience Principles

### 11. **No Blank States**
- **Rule**: Users always have clear next actions, never empty screens
- **Implementation**: Intelligent suggestions, contextual guidance, progressive onboarding
- **Validation**: Check empty state handling in all UI components
- **Example**: ✅ "Add your first team member" CTA ❌ Empty list with no guidance

### 12. **Conversational First**
- **Rule**: Primary interface is natural language conversation
- **Implementation**: CRUD operations through chat when possible
- **Validation**: Check if complex operations can be done conversationally
- **Example**: ✅ "Create a new person for Sarah" ❌ Forms-only interfaces

### 13. **Progressive Disclosure**
- **Rule**: Start simple, gather context through conversation
- **Implementation**: Minimal initial setup, intelligent follow-up questions
- **Validation**: Check if complex forms can be broken into conversational steps
- **Example**: ✅ Multi-step person creation ❌ Complex upfront forms

## Data Architecture Principles

### 14. **Semantic Relationships**
- **Rule**: All data connections are semantically meaningful
- **Implementation**: Vector embeddings, relationship graphs, context mapping
- **Validation**: Check if data relationships enable intelligent insights
- **Example**: ✅ Person-topic-conversation relationships ❌ Isolated data tables

### 15. **Real-Time Context**
- **Rule**: AI has access to most current user state and external data
- **Implementation**: WebSocket updates, real-time embeddings, fresh context
- **Validation**: Check if AI responses reflect latest user activity
- **Example**: ✅ Recent conversation context ❌ Stale or cached context

### 16. **Privacy-Preserving Intelligence**
- **Rule**: Advanced AI capabilities without compromising user privacy
- **Implementation**: Local processing where possible, secure external calls
- **Validation**: Check data handling and external API usage
- **Example**: ✅ Encrypted data transmission ❌ Unnecessary data exposure

## Integration Principles

### 17. **Webhook-First External Integration**
- **Rule**: External systems push data to Mano, not pulled
- **Implementation**: Webhook endpoints, real-time updates, event-driven architecture
- **Validation**: Check if integrations use webhooks vs polling
- **Example**: ✅ Slack webhook integration ❌ Polling external APIs

### 18. **MCP for AI Tools**
- **Rule**: AI tool integrations use Model Context Protocol
- **Implementation**: MCP-compliant tool definitions and interactions
- **Validation**: Check if AI tools follow MCP standards
- **Example**: ✅ MCP tool integration ❌ Custom AI tool protocols

## Quality Assurance Principles

### 19. **Intelligence Validation**
- **Rule**: All AI outputs must be contextually relevant and helpful
- **Implementation**: Response quality metrics, user feedback loops
- **Validation**: Check for AI response quality measurement
- **Example**: ✅ Relevance scoring ❌ Unvalidated AI outputs

### 20. **Graceful AI Degradation**
- **Rule**: System remains functional when AI services are unavailable
- **Implementation**: Fallback responses, retry logic, error handling
- **Validation**: Test AI service failures and system response
- **Example**: ✅ Fallback to basic responses ❌ System failure when AI unavailable

## Validation Checklist

Use this checklist when reviewing code changes:

- [ ] Does this enhance AI capability or intelligence?
- [ ] Is all AI processing server-side?
- [ ] Are we using LLM generation instead of templates?
- [ ] Does this leverage user context effectively?
- [ ] Are we maintaining thin client architecture?
- [ ] Does this contribute to the knowledge graph?
- [ ] Are we avoiding blank states?
- [ ] Is the interaction conversational when possible?
- [ ] Are we building semantic relationships?
- [ ] Does this align with our AI-first philosophy?

## Anti-Patterns to Avoid

### ❌ **Template-Based Intelligence**
```typescript
// Bad: Static template
const message = `Hello ${name}, welcome to the team!`;

// Good: AI-generated content
const message = await generateWelcomeMessage({ name, context, userProfile });
```

### ❌ **Client-Side AI Calls**
```typescript
// Bad: Client-side LLM call
const response = await anthropic.messages.create({...});

// Good: Server-side AI through API
const response = await fetch('/api/ai-endpoint', { body: { prompt } });
```

### ❌ **Isolated Intelligence**
```typescript
// Bad: Context-free AI call
const advice = await getAdvice(currentMessage);

// Good: Context-aware AI call
const advice = await getAdvice(currentMessage, userContext, conversationHistory);
```

### ❌ **Blank State Surrender**
```typescript
// Bad: Empty state without guidance
{people.length === 0 && <div>No people found</div>}

// Good: Actionable empty state
{people.length === 0 && <AddFirstPersonPrompt />}
```

## Implementation Notes

- **Every PR** should be validated against these principles
- **Technical debt** that violates these principles should be prioritized for refactoring
- **New features** must demonstrate clear advancement of AI capabilities
- **Performance optimizations** should not compromise intelligent behavior

---

*These principles are living guidelines. They should evolve as we learn more about building effective AI-first management tools.*