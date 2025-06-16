# Chunk 2: Enhanced Context Building - Deployment Guide

## Overview

Chunk 2 implements the "one brain" experience for Mano by adding intelligent context aggregation across all conversations. Mano now has full awareness of your management network and can provide insights that span multiple team members and conversations.

## What's New

### 🧠 Enhanced Context System
- **Cross-conversation awareness**: Mano remembers themes and patterns across all your conversations
- **Team-wide insights**: Responses include context about your entire management network
- **Pattern detection**: Identifies recurring challenges and themes across different people
- **Smarter recommendations**: Advice is informed by your complete management picture

### 🏗️ Technical Implementation
- **Management Context Service**: `supabase/functions/_shared/management-context.ts`
- **Enhanced Edge Function**: Updated chat function with context building
- **Performance Monitoring**: Built-in logging and performance tracking
- **Database Updates**: Support for 'general' conversation type

## Deployment Steps

### 1. Apply Database Migrations

```bash
# Apply the new migration for 'general' conversation support
supabase db push
```

### 2. Deploy Edge Function

```bash
# Deploy the updated chat function with enhanced context
supabase functions deploy chat
```

### 3. Verify Environment Variables

Ensure your Supabase project has the required environment variables:
- `ANTHROPIC_API_KEY`: Your Claude API key
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key

## Testing the Enhanced Context

### Manual Testing

1. **Create test team members** in your Mano app:
   - Add 2-3 people with different relationship types
   - Have conversations about workload, communication, performance
   
2. **Test cross-conversation awareness**:
   - Discuss workload with Person A
   - Switch to general chat and ask: "What challenges is my team facing?"
   - Verify Mano references the workload discussion

3. **Test pattern detection**:
   - Discuss similar topics (e.g., communication) with multiple people
   - Ask general questions about team patterns
   - Verify Mano identifies the recurring theme

### Automated Testing

```bash
# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run the test script
deno run --allow-net --allow-env scripts/test-enhanced-context.ts
```

## Expected Results

### Before Enhancement (Chunk 1)
**User**: "How should I handle team communication issues?"
**Mano**: "Focus on setting clear expectations and regular check-ins..."

### After Enhancement (Chunk 2)
**User**: "How should I handle team communication issues?"
**Mano**: "I notice communication has been a theme across your recent conversations - you mentioned unclear requirements with Oliver, and Sarah raised concerns about stakeholder priorities. With 3 direct reports and 2 stakeholders in your network, consider implementing a weekly alignment meeting to address these coordination challenges systematically..."

## Performance Monitoring

Check your Edge Function logs for context building performance:

```bash
supabase functions logs chat
```

Look for log entries like:
```
Context building took 245ms for user abc123
Context includes 5 people, 3 themes
```

### Performance Targets
- **Context building**: < 500ms
- **Total response time**: < 5 seconds
- **Success rate**: > 95%

## Quality Indicators

### ✅ Enhanced Intelligence
- General chat references team size, challenges, patterns
- Person-specific chat includes broader team context
- Responses connect related discussions from different conversations
- Pattern detection identifies themes across multiple people

### ✅ User Experience  
- More relevant and contextual advice
- Proactive insights about team patterns
- Team-level strategic thinking
- No noticeable performance degradation

## Troubleshooting

### Context Building Fails
- Check database permissions for cross-table queries
- Verify all required tables exist and have data
- Check Edge Function logs for specific errors

### Performance Issues
- Monitor context building time in logs
- Consider reducing look-back windows if too slow
- Check if database queries need optimization

### Missing Context
- Verify management-context.ts is properly imported
- Check that formatContextForPrompt is working correctly
- Ensure RLS policies allow cross-conversation queries

## Next Steps: Preparation for Chunk 3

The enhanced context system creates the perfect foundation for vector search:

- **Rich context data**: Themes, patterns, and insights ready for vectorization
- **Cross-conversation analysis**: Basis for semantic similarity detection  
- **Structured summaries**: Clean data for embedding generation
- **Performance baseline**: Current response times to compare against vector-enhanced version

The context building pipeline established here will be enhanced with semantic search capabilities in Chunk 3, making the insights even more powerful and accurate.

## Success Criteria Checklist

- [ ] **Cross-conversation awareness**: General chat references specific people and their discussions
- [ ] **Team-wide context**: Responses include team size, roles, and relationship types
- [ ] **Pattern detection**: Recurring themes identified across conversations
- [ ] **Enhanced advice**: More specific, contextual recommendations
- [ ] **Performance acceptable**: Response times < 5 seconds
- [ ] **Error handling**: Graceful degradation when context building fails
- [ ] **Logging active**: Clear visibility into context building performance

## Example Test Scenarios

### Scenario 1: Workload Management
1. Talk to Person A about being overwhelmed
2. Talk to Person B about heavy workload  
3. Ask general: "What are my team's main challenges?"
4. **Expected**: Mano identifies workload as a pattern across team

### Scenario 2: Communication Issues
1. Discuss unclear stakeholder expectations with Person A
2. Discuss team alignment issues with Person B
3. Ask Person A: "How does this compare to other team challenges?"
4. **Expected**: Mano references communication as a broader team theme

### Scenario 3: Performance Context
1. Have performance discussions with multiple direct reports
2. Ask general: "How should I approach my next team meeting?"
3. **Expected**: Mano suggests addressing performance themes identified across conversations 