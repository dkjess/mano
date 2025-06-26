import type { SupabaseClient } from '@supabase/supabase-js';
import type { Person, Message } from '@/types/database';
import { getPeople, getMessages } from './database';
import { getOrCreateGeneralTopic } from './general-topic-server';

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

export interface TopicContext {
  title: string;
  description?: string;
  participantCount: number;
  recentTopics: string[];
  conversationSummary: string;
  isGeneral: boolean;
}

export interface ManagementContextData {
  teamContext: TeamContext;
  allPeople: PersonContext[];
  allTopics: TopicContext[];
  crossConversationInsights: string[];
  contextSummary: string;
}

/**
 * Gathers comprehensive management context about the user's entire team network
 */
export async function gatherManagementContext(
  userId: string,
  currentPersonId: string,
  supabase: SupabaseClient,
  currentTopicId?: string,
  isTopicConversation: boolean = false
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
    
    // Get topic context including General topic conversations
    let allTopics: TopicContext[] = [];
    let generalMessages: Message[] = [];
    
    try {
      // Get the General topic for this user
      const generalTopic = await getOrCreateGeneralTopic(userId, supabase);
      
      // Get General topic messages
      const { data: generalTopicMessages, error: generalError } = await supabase
        .from('messages')
        .select('*')
        .eq('topic_id', generalTopic.id)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      
      if (generalError) throw generalError;
      generalMessages = generalTopicMessages || [];
      
      // Build General topic context
      if (generalMessages.length > 0) {
        const generalContext = buildTopicContext(generalTopic, generalMessages, true);
        allTopics.push(generalContext);
      }
      
      // Get other topics if we're in topic conversation mode
      if (isTopicConversation && currentTopicId) {
        const { data: topicsData, error: topicsError } = await supabase
          .from('topics')
          .select('*')
          .eq('user_id', userId)
          .neq('id', generalTopic.id); // Exclude General topic as it's already handled
        
        if (topicsError) throw topicsError;
        
        // Build context for other topics
        const otherTopicContexts = await Promise.all(
          (topicsData || []).map(async (topic) => {
            const { data: topicMessages } = await supabase
              .from('messages')
              .select('*')
              .eq('topic_id', topic.id)
              .eq('user_id', userId)
              .order('created_at', { ascending: true });
            
            return buildTopicContext(topic, topicMessages || [], false);
          })
        );
        
        allTopics.push(...otherTopicContexts);
      }
    } catch (error) {
      console.log('No general topic found or error retrieving topic data:', error);
    }
    
    // Generate cross-conversation insights
    const crossConversationInsights = generateCrossConversationInsights(
      peopleContexts, 
      allTopics,
      generalMessages,
      currentPersonId,
      isTopicConversation
    );
    
    // Create overall context summary
    const contextSummary = generateContextSummary(teamContext, crossConversationInsights);
    
    return {
      teamContext,
      allPeople: peopleContexts,
      allTopics,
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
      allTopics: [],
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
 * Builds context for a topic based on its conversation history
 */
function buildTopicContext(topic: any, messages: Message[], isGeneral: boolean): TopicContext {
  const recentMessages = messages.slice(-10); // Last 10 messages
  const recentTopics = extractTopicsFromMessages(recentMessages);
  const conversationSummary = generateTopicConversationSummary(topic, recentMessages, isGeneral);
  
  return {
    title: topic.title,
    description: topic.description,
    participantCount: topic.participants?.length || 0,
    recentTopics,
    conversationSummary,
    isGeneral
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
    'performance', 'feedback', 'one-on-one', 'goals', 'development',
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
 * Generates a brief summary of recent conversation for a topic
 */
function generateTopicConversationSummary(topic: any, messages: Message[], isGeneral: boolean): string {
  if (messages.length === 0) {
    return isGeneral ? 'No recent general management conversations.' : `No recent conversations in ${topic.title}.`;
  }
  
  const recentUserMessages = messages
    .filter(m => m.is_user)
    .slice(-3); // Last 3 user messages
  
  if (recentUserMessages.length === 0) {
    return isGeneral ? 'Recent general management conversation activity.' : `Recent activity in ${topic.title}.`;
  }
  
  const topics = extractTopicsFromMessages(messages);
  if (topics.length > 0) {
    return isGeneral ? 
      `Recent management discussions about: ${topics.join(', ')}.` :
      `Recent discussions in ${topic.title} about: ${topics.join(', ')}.`;
  }
  
  return isGeneral ? 'Active general management conversations.' : `Active conversations in ${topic.title}.`;
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
  topicContexts: TopicContext[],
  generalMessages: Message[],
  currentPersonId: string,
  isTopicConversation: boolean = false
): string[] {
  const insights: string[] = [];
  
  // Identify common themes across people conversations
  const allPeopleTopics = peopleContexts.flatMap(p => p.recentTopics);
  
  // Include topics from topic conversations
  const allTopicThemes = topicContexts.flatMap(t => t.recentTopics);
  
  // Combine all topics for analysis
  const allTopics = [...allPeopleTopics, ...allTopicThemes];
  const topicCounts: { [key: string]: number } = {};
  
  allTopics.forEach(topic => {
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  });
  
  // Find topics mentioned across multiple conversations
  Object.entries(topicCounts).forEach(([topic, count]) => {
    if (count >= 2) {
      insights.push(`${topic} is a recurring theme across multiple conversations`);
    }
  });
  
  // Add topic-specific insights
  const generalTopic = topicContexts.find(t => t.isGeneral);
  if (generalTopic && generalTopic.recentTopics.length > 0) {
    insights.push(`Recent general management focus: ${generalTopic.recentTopics.slice(0, 3).join(', ')}`);
  }
  
  // Insights about topic participation
  const activeTopics = topicContexts.filter(t => !t.isGeneral && t.participantCount > 0);
  if (activeTopics.length > 0) {
    insights.push(`Managing ${activeTopics.length} active topic${activeTopics.length > 1 ? 's' : ''} with team participation`);
  }
  
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
  
  // Add general conversation insights if available
  if (generalMessages.length > 0) {
    insights.push('You\'ve been having strategic management conversations');
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
  
  // Add relevant topic context (summarized)
  if (context.allTopics.length > 0) {
    sections.push(`\n=== TOPIC DISCUSSIONS CONTEXT ===`);
    context.allTopics
      .filter(topic => topic.recentTopics.length > 0)
      .slice(0, 5) // Show context for up to 5 most active topic conversations
      .forEach(topic => {
        const contextType = topic.isGeneral ? 'General Management' : `Topic: ${topic.title}`;
        sections.push(`• ${contextType}: Recent themes - ${topic.recentTopics.join(', ')}`);
        if (!topic.isGeneral && topic.participantCount > 0) {
          sections.push(`  ${topic.participantCount} participant${topic.participantCount === 1 ? '' : 's'}`);
        }
      });
  }
  
  sections.push(`\n=== CONTEXT GUIDANCE ===`);
  sections.push('Consider this team context when providing advice. Reference relevant patterns and connections naturally when they add value to your response.');
  
  return sections.join('\n');
} 