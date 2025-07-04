import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { gatherManagementContext } from './management-context';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface PersonWelcomeParams {
  name: string;
  role: string | null;
  relationship_type: string;
  user_id: string;
}

interface TopicWelcomeParams {
  title: string;
  participants: string[];
  user_id: string;
}

/**
 * Generates an AI-powered welcome message for a new person
 * Uses full management context to create contextual, relevant guidance
 */
export async function generatePersonWelcomeMessage(
  params: PersonWelcomeParams,
  supabase: SupabaseClient
): Promise<string> {
  try {
    // Gather full management context for intelligent message generation
    const managementContext = await gatherManagementContext(
      params.user_id,
      'temp', // temporary since person isn't created yet
      supabase,
      undefined,
      false
    );

    const roleDescription = params.role ? `${params.role}` : 'team member';
    const teamSize = managementContext.teamContext.totalPeople;
    const existingRoles = Object.keys(managementContext.teamContext.peopleByRole);
    const teamOverview = managementContext.teamContext.teamOverview;

    const prompt = `You are Mano, an intelligent management assistant. A manager has just added a new person to their team and you need to create a personalized welcome message.

**New Person Details:**
- Name: ${params.name}
- Role: ${roleDescription}
- Relationship: ${params.relationship_type}

**Manager's Current Context:**
- Team size: ${teamSize} people
- Existing roles: ${existingRoles.join(', ')}
- Team overview: ${teamOverview}
- Recent management challenges: ${managementContext.teamContext.managementChallenges.join(', ')}

**Instructions:**
Create a warm, helpful welcome message (100-150 words) that:

1. **Acknowledges their specific role and relationship** in a natural way
2. **Asks ONE highly relevant question** about their current situation that would help the manager immediately
3. **Provides a specific insight** based on their relationship type and role
4. **References their team context** if relevant (similar roles, team dynamics, etc.)

**Relationship-specific guidance:**
- direct_report: Focus on development, performance, career growth
- manager: Focus on communication, expectations, stakeholder relationships  
- peer: Focus on collaboration, shared challenges, mutual support
- stakeholder: Focus on alignment, communication, project success

Keep the tone conversational, supportive, and immediately actionable. Use the hand emoji 🤲 once to reinforce the "helping hand" theme.

Generate only the message content, no additional formatting or labels.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: `Create the welcome message for ${params.name}.`
        }
      ]
    });

    const textContent = response.content.find(block => block.type === 'text');
    return textContent?.text || `Welcome ${params.name} to your team! Let's start building a great working relationship. What's the most important thing happening with ${params.name} right now?`;

  } catch (error) {
    console.error('Error generating person welcome message:', error);
    // Fallback to a basic but still contextual message
    return `Welcome ${params.name} to your team! I'm here to help you build a great working relationship with your ${params.relationship_type}. What's the most important thing happening with ${params.name} right now?`;
  }
}

/**
 * Generates an AI-powered welcome message for a new topic
 * Uses management context to create strategic, framework-driven guidance
 */
export async function generateTopicWelcomeMessage(
  params: TopicWelcomeParams,
  supabase: SupabaseClient
): Promise<string> {
  try {
    // Gather management context for intelligent message generation
    const managementContext = await gatherManagementContext(
      params.user_id,
      'general', // Use general as default for topic creation
      supabase,
      undefined,
      true
    );

    // Get participant names if any
    const participantNames: string[] = [];
    if (params.participants.length > 0) {
      const { data: people } = await supabase
        .from('people')
        .select('name')
        .in('id', params.participants)
        .eq('user_id', params.user_id);
      
      if (people) {
        participantNames.push(...people.map(p => p.name));
      }
    }

    const teamSize = managementContext.teamContext.totalPeople;
    const recentChallenges = managementContext.teamContext.managementChallenges;
    const teamOverview = managementContext.teamContext.teamOverview;

    const prompt = `You are Mano, an intelligent management assistant. A manager has just created a new topic for strategic discussion and you need to create a helpful welcome message.

**Topic Details:**
- Title: "${params.title}"
- Participants: ${participantNames.length > 0 ? participantNames.join(', ') : 'No specific participants yet'}

**Manager's Current Context:**
- Team size: ${teamSize} people
- Team overview: ${teamOverview}
- Recent management challenges: ${recentChallenges.join(', ')}
- Cross-conversation insights: ${managementContext.crossConversationInsights.slice(0, 3).join(', ')}

**Instructions:**
Create a strategic, helpful welcome message (120-180 words) that:

1. **Acknowledges the topic** and its strategic importance
2. **Suggests 2-3 specific discussion points or frameworks** relevant to this topic
3. **References participant dynamics** if participants are specified
4. **Connects to broader team context** if relevant
5. **Asks ONE strategic question** to get the conversation started

**Topic-type specific guidance:**
- If topic sounds like a project: Focus on deliverables, stakeholders, timeline
- If topic sounds like team-related: Focus on dynamics, communication, development
- If topic sounds like strategy: Focus on frameworks, decision-making, outcomes
- If topic sounds like performance: Focus on goals, feedback, measurement

Keep the tone strategic, structured, and immediately actionable. Use the hand emoji 🤲 once. End with a specific question that would help them dive into productive discussion.

Generate only the message content, no additional formatting or labels.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 350,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: `Create the welcome message for the topic "${params.title}".`
        }
      ]
    });

    const textContent = response.content.find(block => block.type === 'text');
    return textContent?.text || `Let's dive into "${params.title}". This looks like an important topic for your team. What's the key challenge or opportunity you want to explore here?`;

  } catch (error) {
    console.error('Error generating topic welcome message:', error);
    // Fallback to a basic but still contextual message
    return `Let's explore "${params.title}". This sounds like an important topic for your team's success. What's the key challenge or opportunity you want to discuss here?`;
  }
}