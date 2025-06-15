import type { SupabaseClient } from '@supabase/supabase-js';
import type { Person, Message } from '@/types/database';
import { getPeople, getMessages } from './database';

export interface TeamContext {
  totalPeople: number;
  peopleByRole: { [key: string]: number };
  peopleByRelationship: { [key: string]: number };
  recentActivity: string[];
  managementChallenges: string[];
  teamOverview: string;
}

export interface PersonContext {
  name: string;
  role: string | null;
  relationshipType: string;
  recentTopics: string[];
  conversationSummary: string;
}

export interface ManagementContextData {
  teamContext: TeamContext;
  allPeople: PersonContext[];
  crossConversationInsights: string[];
  contextSummary: string;
}

/**
 * Gathers comprehensive management context about the user's entire team network
 */
export async function gatherManagementContext(
  userId: string,
  currentPersonId: string,
  supabase: SupabaseClient
): Promise<ManagementContextData> {
  try {
    // Get all people in the user's network
    const allPeople = await getPeople(userId, supabase);
    
    // Build team context overview
    const teamContext = buildTeamContext(allPeople);
    
    // Get context for each person including recent conversation topics
    const peopleContexts = await Promise.all(
      allPeople.map(async (person) => {
        const messages = await getMessages(person.id, supabase);
        return buildPersonContext(person, messages);
      })
    );
    
    // Include 1-1 assistant conversations in context gathering
    let oneOnOneMessages: Message[] = [];
    try {
      oneOnOneMessages = await getMessages('1-1', supabase);
    } catch (error) {
      // 1-1 messages might not exist, that's okay
      console.log('No 1-1 messages found or error retrieving them');
    }
    
    // Generate cross-conversation insights
    const crossConversationInsights = generateCrossConversationInsights(
      peopleContexts, 
      oneOnOneMessages,
      currentPersonId
    );
    
    // Create overall context summary
    const contextSummary = generateContextSummary(teamContext, crossConversationInsights);
    
    return {
      teamContext,
      allPeople: peopleContexts,
      crossConversationInsights,
      contextSummary
    };
  } catch (error) {
    console.error('Error gathering management context:', error);
    // Return minimal context on error - graceful degradation
    return {
      teamContext: {
        totalPeople: 0,
        peopleByRole: {},
        peopleByRelationship: {},
        recentActivity: [],
        managementChallenges: [],
        teamOverview: 'Unable to gather team context at this time.'
      },
      allPeople: [],
      crossConversationInsights: [],
      contextSummary: 'Limited context available.'
    };
  }
}

/**
 * Builds team-level context and statistics
 */
function buildTeamContext(people: Person[]): TeamContext {
  const peopleByRole: { [key: string]: number } = {};
  const peopleByRelationship: { [key: string]: number } = {};
  
  people.forEach(person => {
    // Count by role
    const role = person.role || 'Unspecified';
    peopleByRole[role] = (peopleByRole[role] || 0) + 1;
    
    // Count by relationship type
    peopleByRelationship[person.relationship_type] = 
      (peopleByRelationship[person.relationship_type] || 0) + 1;
  });
  
  // Generate team overview
  const teamOverview = generateTeamOverview(people.length, peopleByRelationship);
  
  return {
    totalPeople: people.length,
    peopleByRole,
    peopleByRelationship,
    recentActivity: [], // Will be populated by analyzing recent messages
    managementChallenges: [], // Will be identified from conversation patterns
    teamOverview
  };
}

/**
 * Builds context for an individual person based on their conversation history
 */
function buildPersonContext(person: Person, messages: Message[]): PersonContext {
  const recentMessages = messages.slice(-10); // Last 10 messages
  const recentTopics = extractTopicsFromMessages(recentMessages);
  const conversationSummary = generateConversationSummary(person, recentMessages);
  
  return {
    name: person.name,
    role: person.role,
    relationshipType: person.relationship_type,
    recentTopics,
    conversationSummary
  };
}

/**
 * Extracts key topics and themes from recent messages
 */
function extractTopicsFromMessages(messages: Message[]): string[] {
  if (messages.length === 0) return [];
  
  const topics: string[] = [];
  const userMessages = messages.filter(m => m.is_user);
  
  // Look for common management topics in user messages
  const commonTopics = [
    'performance', 'feedback', '1-1', 'one-on-one', 'goals', 'development',
    'workload', 'stress', 'project', 'deadline', 'help', 'support',
    'communication', 'team', 'collaboration', 'issue', 'problem',
    'growth', 'career', 'promotion', 'skills', 'training'
  ];
  
  userMessages.forEach(message => {
    const content = message.content.toLowerCase();
    commonTopics.forEach(topic => {
      if (content.includes(topic) && !topics.includes(topic)) {
        topics.push(topic);
      }
    });
  });
  
  return topics.slice(0, 5); // Return top 5 topics
}

/**
 * Generates a brief summary of recent conversation with a person
 */
function generateConversationSummary(person: Person, messages: Message[]): string {
  if (messages.length === 0) {
    return `No recent conversations with ${person.name}.`;
  }
  
  const recentUserMessages = messages
    .filter(m => m.is_user)
    .slice(-3); // Last 3 user messages
  
  if (recentUserMessages.length === 0) {
    return `Recent conversation with ${person.name} but no specific topics identified.`;
  }
  
  const topics = extractTopicsFromMessages(messages);
  if (topics.length > 0) {
    return `Recent discussions with ${person.name} about: ${topics.join(', ')}.`;
  }
  
  return `Active conversation thread with ${person.name}.`;
}

/**
 * Identifies patterns and insights across multiple conversations
 */
function generateCrossConversationInsights(
  peopleContexts: PersonContext[],
  oneOnOneMessages: Message[],
  currentPersonId: string
): string[] {
  const insights: string[] = [];
  
  // Identify common themes across conversations
  const allTopics = peopleContexts.flatMap(p => p.recentTopics);
  const topicCounts: { [key: string]: number } = {};
  
  allTopics.forEach(topic => {
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  });
  
  // Find topics mentioned by multiple people
  Object.entries(topicCounts).forEach(([topic, count]) => {
    if (count >= 2) {
      insights.push(`${topic} is a recurring theme across multiple team conversations`);
    }
  });
  
  // Analyze team composition for insights
  const relationships = peopleContexts.map(p => p.relationshipType);
  const directReports = relationships.filter(r => r === 'direct_report').length;
  const stakeholders = relationships.filter(r => r === 'stakeholder').length;
  
  if (directReports > 0) {
    insights.push(`You're managing ${directReports} direct report${directReports > 1 ? 's' : ''}`);
  }
  
  if (stakeholders > 0) {
    insights.push(`You're working with ${stakeholders} key stakeholder${stakeholders > 1 ? 's' : ''}`);
  }
  
  // Add 1-1 conversation insights if available
  if (oneOnOneMessages.length > 0) {
    insights.push('You\'ve been having strategic 1-1 conversations');
  }
  
  return insights.slice(0, 5); // Return top 5 insights
}

/**
 * Generates team overview description
 */
function generateTeamOverview(totalPeople: number, relationshipCounts: { [key: string]: number }): string {
  if (totalPeople === 0) {
    return 'No team members added yet.';
  }
  
  const parts: string[] = [];
  parts.push(`You have ${totalPeople} people in your network`);
  
  if (relationshipCounts.direct_report) {
    parts.push(`${relationshipCounts.direct_report} direct report${relationshipCounts.direct_report > 1 ? 's' : ''}`);
  }
  
  if (relationshipCounts.stakeholder) {
    parts.push(`${relationshipCounts.stakeholder} stakeholder${relationshipCounts.stakeholder > 1 ? 's' : ''}`);
  }
  
  if (relationshipCounts.peer) {
    parts.push(`${relationshipCounts.peer} peer${relationshipCounts.peer > 1 ? 's' : ''}`);
  }
  
  if (relationshipCounts.manager) {
    parts.push(`${relationshipCounts.manager} manager${relationshipCounts.manager > 1 ? 's' : ''}`);
  }
  
  return parts.join(', ') + '.';
}

/**
 * Creates an overall context summary for the AI assistant
 */
function generateContextSummary(
  teamContext: TeamContext,
  insights: string[]
): string {
  const parts: string[] = [];
  
  parts.push(`TEAM CONTEXT: ${teamContext.teamOverview}`);
  
  if (insights.length > 0) {
    parts.push(`CURRENT PATTERNS: ${insights.join('; ')}`);
  }
  
  parts.push('Use this context to provide more relevant and connected management advice.');
  
  return parts.join('\n\n');
}

/**
 * Formats management context for inclusion in AI prompts
 */
export function formatContextForPrompt(context: ManagementContextData): string {
  const sections: string[] = [];
  
  // Add team overview
  sections.push(`=== TEAM CONTEXT ===`);
  sections.push(context.teamContext.teamOverview);
  
  // Add cross-conversation insights
  if (context.crossConversationInsights.length > 0) {
    sections.push(`\n=== CURRENT MANAGEMENT PATTERNS ===`);
    context.crossConversationInsights.forEach(insight => {
      sections.push(`• ${insight}`);
    });
  }
  
  // Add relevant people context (summarized)
  if (context.allPeople.length > 0) {
    sections.push(`\n=== TEAM MEMBERS CONTEXT ===`);
    context.allPeople
      .filter(person => person.recentTopics.length > 0)
      .slice(0, 5) // Show context for up to 5 most active conversations
      .forEach(person => {
        sections.push(`• ${person.name} (${person.relationshipType}): Recent topics - ${person.recentTopics.join(', ')}`);
      });
  }
  
  sections.push(`\n=== CONTEXT GUIDANCE ===`);
  sections.push('Consider this team context when providing advice. Reference relevant patterns and connections naturally when they add value to your response.');
  
  return sections.join('\n');
} 