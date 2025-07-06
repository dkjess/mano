import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { VectorService, VectorSearchResult } from './vector-service.ts'
import { EmbeddingJob } from './embedding-job.ts'
import { ConversationIntelligence } from './conversation-intelligence.ts'
import { ProactiveInsightsSystem, type ProactiveInsight } from './proactive-insights.ts'
import { EnhancedSemanticSearch, type SemanticPattern } from './enhanced-semantic-search.ts'

export interface PersonSummary {
  id: string;
  name: string;
  role: string | null;
  relationship_type: string;
  last_contact?: string;
  recent_themes?: string[];
}

export interface ConversationTheme {
  theme: string;
  frequency: number;
  people_mentioned: string[];
  last_mentioned: string;
  examples: string[];
}

export interface ManagementContext {
  people: PersonSummary[];
  team_size: {
    direct_reports: number;
    stakeholders: number;
    managers: number;
    peers: number;
  };
  recent_themes: ConversationTheme[];
  current_challenges: string[];
  conversation_patterns: {
    most_discussed_people: string[];
    trending_topics: string[];
    cross_person_mentions: Array<{
      person_a: string;
      person_b: string;
      context: string;
    }>;
  };
  semantic_context?: {
    similar_conversations: VectorSearchResult[];
    cross_person_insights: VectorSearchResult[];
    related_themes: any[];
    semantic_patterns?: SemanticPattern[];
  };
  proactive_insights?: ProactiveInsight[];
}

export class ManagementContextBuilder {
  private vectorService: VectorService;
  private embeddingJob: EmbeddingJob;

  constructor(private supabase: SupabaseClient, private userId: string) {
    this.vectorService = new VectorService(supabase);
    this.embeddingJob = new EmbeddingJob(supabase, this.vectorService);
  }

  async buildFullContext(
    currentPersonId: string, 
    currentQuery?: string, 
    isTopicConversation?: boolean,
    topicId?: string,
    includeProactiveInsights: boolean = false
  ): Promise<{
    context: ManagementContext;
    enhancement?: any;
  }> {
    try {
      // Start background embedding job (don't wait for it)
      this.embeddingJob.processUnembeddedMessages(this.userId).catch(console.error);
      
      // Always use topic-aware people search when there's a meaningful query
      // This enables cross-person context in all conversations
      const peoplePromise = (currentQuery && currentQuery.trim().length > 0) 
        ? this.getTopicRelevantPeople(currentQuery, topicId)
        : this.getPeopleOverview();

      const [people, themes, challenges, patterns, semanticContext] = await Promise.all([
        peoplePromise,
        this.getRecentThemes(),
        this.getCurrentChallenges(),
        this.getConversationPatterns(),
        currentQuery ? this.getSemanticContext(currentQuery, currentPersonId) : Promise.resolve(undefined)
      ]);

      const context: ManagementContext = {
        people,
        team_size: this.calculateTeamSize(people),
        recent_themes: themes,
        current_challenges: challenges,
        conversation_patterns: patterns,
        semantic_context: semanticContext
      };

      // Generate proactive insights if requested (for general conversations or dashboard)
      if (includeProactiveInsights && Deno.env.get('ANTHROPIC_API_KEY')) {
        try {
          const proactiveInsights = new ProactiveInsightsSystem(
            this.supabase,
            this.userId,
            Deno.env.get('ANTHROPIC_API_KEY')!
          );
          
          context.proactive_insights = await proactiveInsights.generateProactiveInsights(context);
          console.log(`🚀 Generated ${context.proactive_insights.length} proactive insights`);
        } catch (insightsError) {
          console.error('Failed to generate proactive insights:', insightsError);
          // Continue without insights - not critical for core functionality
        }
      }

      // Generate conversational enhancement
      let enhancement;
      if (currentQuery) {
        const conversationIntelligence = new ConversationIntelligence(
          this.supabase,
          this.vectorService,
          this.userId
        );

        enhancement = await conversationIntelligence.analyzeConversationContext(
          currentQuery,
          currentPersonId,
          semanticContext,
          context
        );
      }

      return { context, enhancement };
    } catch (error) {
      console.error('Error building management context:', error);
      // Return minimal context on error
      return {
        context: {
          people: [],
          team_size: { direct_reports: 0, stakeholders: 0, managers: 0, peers: 0 },
          recent_themes: [],
          current_challenges: [],
          conversation_patterns: { most_discussed_people: [], trending_topics: [], cross_person_mentions: [] }
        }
      };
    }
  }

  private async getSemanticContext(query: string, currentPersonId: string) {
    try {
      // Use enhanced semantic search if API key is available
      if (Deno.env.get('ANTHROPIC_API_KEY')) {
        const enhancedSearch = new EnhancedSemanticSearch(
          this.supabase,
          this.vectorService,
          this.userId,
          Deno.env.get('ANTHROPIC_API_KEY')!
        );

        // Perform enhanced search
        const enhancedResults = await enhancedSearch.enhancedSearch({
          query,
          person_id: currentPersonId !== 'general' ? currentPersonId : undefined,
          intent: 'find_similar',
          additional_context: ['management', 'leadership', 'team dynamics']
        });

        // Detect semantic patterns
        const semanticPatterns = await enhancedSearch.detectSemanticPatterns(
          enhancedResults,
          { query, person_id: currentPersonId, intent: 'find_patterns' }
        );

        // Transform enhanced results back to expected format
        const similarConversations = enhancedResults
          .slice(0, 5)
          .map(result => ({
            ...result.original_result,
            similarity: result.relevance_score
          }));

        // Get cross-person insights - always search across all people for person conversations
        const crossPersonResults = await enhancedSearch.enhancedSearch({
          query,
          intent: 'find_related_people', 
          additional_context: ['team collaboration', 'similar challenges', 'role matching', 'people search']
        });

        // For person conversations, include insights from all people, not just other people
        const crossPersonInsights = crossPersonResults
          .slice(0, 5)
          .map(result => result.original_result);

        console.log(`🔍 Enhanced semantic search: ${similarConversations.length} similar, ${crossPersonInsights.length} cross-person, ${semanticPatterns.length} patterns`);

        return {
          similar_conversations: similarConversations,
          cross_person_insights: crossPersonInsights,
          related_themes: [], // Can be enhanced later
          semantic_patterns: semanticPatterns
        };
      }
      
      // Fallback to basic semantic context
      const context = await this.vectorService.findSemanticContext(
        this.userId,
        query,
        currentPersonId
      );
      
      return {
        similar_conversations: context.similarConversations,
        cross_person_insights: context.crossPersonInsights,
        related_themes: context.relatedThemes
      };
    } catch (error) {
      console.error('Error getting semantic context:', error);
      // Fallback to basic context
      try {
        const context = await this.vectorService.findSemanticContext(
          this.userId,
          query,
          currentPersonId
        );
        
        return {
          similar_conversations: context.similarConversations,
          cross_person_insights: context.crossPersonInsights,
          related_themes: context.relatedThemes
        };
      } catch (fallbackError) {
        console.error('Fallback semantic context also failed:', fallbackError);
        return undefined;
      }
    }
  }

  private async getTopicRelevantPeople(query: string, topicId?: string): Promise<PersonSummary[]> {
    // Get all people first
    const allPeople = await this.getPeopleOverview();
    
    if (!query || allPeople.length === 0) return allPeople;
    
    try {
      // Keywords that indicate different areas of expertise and people-related queries
      const expertiseKeywords = {
        sales: ['sales', 'revenue', 'customers', 'deals', 'accounts', 'market expansion', 'business development', 'who else', 'other sales', 'sales team'],
        marketing: ['marketing', 'brand', 'campaigns', 'content', 'social media', 'advertising', 'market expansion', 'marketing team'],
        technical: ['development', 'engineering', 'technical', 'technology', 'system', 'architecture', 'tech team', 'developers'],
        operations: ['operations', 'process', 'logistics', 'supply chain', 'efficiency', 'ops team'],
        finance: ['finance', 'budget', 'cost', 'financial', 'accounting', 'investment', 'finance team'],
        hr: ['hr', 'human resources', 'people', 'hiring', 'talent', 'culture', 'hr team'],
        leadership: ['leadership', 'management', 'strategy', 'vision', 'direction', 'managers', 'leads', 'head of'],
        people_search: ['who else', 'other people', 'anyone else', 'team members', 'relates to', 'works with', 'similar role']
      };
      
      const queryLower = query.toLowerCase();
      
      // Score people based on role relevance to query
      const scoredPeople = allPeople.map(person => {
        let relevanceScore = 0;
        const roleLower = (person.role || '').toLowerCase();
        
        // Check each expertise area
        for (const [area, keywords] of Object.entries(expertiseKeywords)) {
          const queryMatches = keywords.some(keyword => queryLower.includes(keyword));
          const roleMatches = keywords.some(keyword => roleLower.includes(keyword.split(' ')[0])); // Match first word
          
          if (queryMatches && roleMatches) {
            relevanceScore += 10; // High relevance
          } else if (queryMatches || roleMatches) {
            relevanceScore += 3; // Some relevance
          }
        }
        
        // Boost recent interactions
        if (person.last_contact) {
          const daysSinceContact = Math.floor((Date.now() - new Date(person.last_contact).getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceContact < 7) relevanceScore += 2;
          else if (daysSinceContact < 30) relevanceScore += 1;
        }
        
        return { ...person, relevanceScore };
      });
      
      // Sort by relevance score, then by recent contact
      return scoredPeople
        .sort((a, b) => {
          if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
          }
          // If same relevance, prioritize recent contact
          const aContact = a.last_contact ? new Date(a.last_contact).getTime() : 0;
          const bContact = b.last_contact ? new Date(b.last_contact).getTime() : 0;
          return bContact - aContact;
        })
        .map(({ relevanceScore, ...person }) => person); // Remove score from final result
        
    } catch (error) {
      console.error('Error in topic-relevant people search:', error);
      return allPeople; // Fallback to all people
    }
  }

  private async getPeopleOverview(): Promise<PersonSummary[]> {
    // Get all team members
    const { data: people } = await this.supabase
      .from('people')
      .select('id, name, role, relationship_type, created_at')
      .eq('user_id', this.userId);

    if (!people) return [];

    // Get last contact and recent themes for each person
    const peopleWithContext = await Promise.all(
      people.map(async (person) => {
        const { data: lastMessage } = await this.supabase
          .from('messages')
          .select('created_at')
          .eq('person_id', person.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const recentThemes = await this.getPersonRecentThemes(person.id);

        return {
          ...person,
          last_contact: lastMessage?.created_at,
          recent_themes: recentThemes
        };
      })
    );

    return peopleWithContext;
  }

  private async getPersonRecentThemes(personId: string): Promise<string[]> {
    // Get recent conversation topics for this person
    const { data: messages } = await this.supabase
      .from('messages')
      .select('content')
      .eq('person_id', personId)
      .eq('is_user', true) // User messages show what they're asking about
      .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (!messages) return [];

    // Extract themes from user messages (simplified - could use NLP)
    const themes = this.extractThemesFromMessages(messages.map(m => m.content));
    return themes.slice(0, 3); // Top 3 themes
  }

  private async getRecentThemes(): Promise<ConversationTheme[]> {
    // Get all recent user messages across all conversations
    const { data: messages } = await this.supabase
      .from('messages')
      .select('content, person_id, created_at')
      .eq('is_user', true)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (!messages) return [];

    // Group and analyze themes across all conversations
    return this.analyzeThemesAcrossConversations(messages);
  }

  private async getCurrentChallenges(): Promise<string[]> {
    // Look for recent patterns that suggest current challenges
    const { data: recentMessages } = await this.supabase
      .from('messages')
      .select('content, person_id')
      .eq('is_user', true)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (!recentMessages) return [];

    // Detect challenge keywords and patterns
    return this.detectCurrentChallenges(recentMessages);
  }

  private async getConversationPatterns(): Promise<ManagementContext['conversation_patterns']> {
    // Analyze conversation patterns and cross-references
    const { data: allMessages } = await this.supabase
      .from('messages')
      .select('content, person_id, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (!allMessages) {
      return {
        most_discussed_people: [],
        trending_topics: [],
        cross_person_mentions: []
      };
    }

    return this.analyzeConversationPatterns(allMessages);
  }

  private calculateTeamSize(people: PersonSummary[]) {
    return {
      direct_reports: people.filter(p => p.relationship_type === 'direct_report').length,
      stakeholders: people.filter(p => p.relationship_type === 'stakeholder').length,
      managers: people.filter(p => p.relationship_type === 'manager').length,
      peers: people.filter(p => p.relationship_type === 'peer').length,
    };
  }

  private extractThemesFromMessages(messages: string[]): string[] {
    // Simplified theme extraction - look for common management keywords
    const themes = new Map<string, number>();
    const keywords = [
      'performance', 'feedback', 'goals', 'career', 'development',
      'project', 'deadline', 'communication', 'team', 'workload',
      'process', 'meeting', 'stakeholder', 'priority', 'decision',
      'hiring', 'training', 'conflict', 'motivation', 'strategy'
    ];

    messages.forEach(message => {
      const lowerMessage = message.toLowerCase();
      keywords.forEach(keyword => {
        if (lowerMessage.includes(keyword)) {
          themes.set(keyword, (themes.get(keyword) || 0) + 1);
        }
      });
    });

    return Array.from(themes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([theme]) => theme);
  }

  private analyzeThemesAcrossConversations(messages: any[]): ConversationTheme[] {
    // Group messages by theme and analyze patterns
    const themeMap = new Map<string, {
      count: number;
      people: Set<string>;
      examples: string[];
      lastMentioned: string;
    }>();

    messages.forEach(msg => {
      const themes = this.extractThemesFromMessages([msg.content]);
      themes.forEach(theme => {
        if (!themeMap.has(theme)) {
          themeMap.set(theme, {
            count: 0,
            people: new Set(),
            examples: [],
            lastMentioned: msg.created_at
          });
        }
        const themeData = themeMap.get(theme)!;
        themeData.count++;
        themeData.people.add(msg.person_id);
        if (themeData.examples.length < 3) {
          themeData.examples.push(msg.content.substring(0, 100));
        }
        if (msg.created_at > themeData.lastMentioned) {
          themeData.lastMentioned = msg.created_at;
        }
      });
    });

    return Array.from(themeMap.entries())
      .map(([theme, data]) => ({
        theme,
        frequency: data.count,
        people_mentioned: Array.from(data.people),
        last_mentioned: data.lastMentioned,
        examples: data.examples
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5); // Top 5 themes
  }

  private detectCurrentChallenges(messages: any[]): string[] {
    // Look for challenge indicators in recent messages
    const challengeKeywords = {
      'Team Communication': ['miscommunication', 'unclear', 'confusion', 'alignment'],
      'Workload Management': ['overwhelmed', 'too much', 'burnout', 'capacity'],
      'Performance Issues': ['underperforming', 'concerns', 'improvement', 'not meeting'],
      'Process Problems': ['inefficient', 'broken process', 'bottleneck', 'delays'],
      'Stakeholder Management': ['stakeholder pressure', 'expectations', 'demands']
    };

    const challenges: string[] = [];
    const messageText = messages.map(m => m.content.toLowerCase()).join(' ');

    Object.entries(challengeKeywords).forEach(([challenge, keywords]) => {
      if (keywords.some(keyword => messageText.includes(keyword))) {
        challenges.push(challenge);
      }
    });

    return challenges;
  }

  private analyzeConversationPatterns(messages: any[]) {
    // Analyze which people are discussed most and cross-references
    const personMentions = new Map<string, number>();
    const crossReferences: Array<{
      person_a: string;
      person_b: string;
      context: string;
    }> = [];

    // Count discussion frequency per person
    messages.forEach(msg => {
      personMentions.set(msg.person_id, (personMentions.get(msg.person_id) || 0) + 1);
    });

    const mostDiscussed = Array.from(personMentions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([personId]) => personId);

    // Extract trending topics (simplified)
    const allContent = messages.map(m => m.content).join(' ');
    const trendingTopics = this.extractThemesFromMessages([allContent]).slice(0, 5);

    return {
      most_discussed_people: mostDiscussed,
      trending_topics: trendingTopics,
      cross_person_mentions: crossReferences // Could be enhanced to detect name mentions
    };
  }
}

export function formatContextForPrompt(context: ManagementContext, currentPersonId: string, currentQuery?: string): string {
  const { people, team_size, recent_themes, current_challenges, semantic_context } = context;

  // Handle case where no team members exist yet
  if (people.length === 0) {
    const emptyTeamNote = currentPersonId === 'general' 
      ? '\nCONVERSATION TYPE: General management discussion - no team members added yet, focus on general management advice'
      : '\nCONVERSATION TYPE: Individual discussion - no broader team context available yet';
    
    return `TEAM OVERVIEW: No team members have been added yet. Consider adding your direct reports, peers, managers, and key stakeholders to get more contextual management advice.${emptyTeamNote}

When you add team members and have conversations about them, I'll be able to provide insights that connect patterns and themes across your entire team.`;
  }

  // Build team overview
  const teamOverview = `
TEAM OVERVIEW:
You manage ${team_size.direct_reports} direct reports, work with ${team_size.stakeholders} stakeholders, and coordinate with ${team_size.peers} peers.

TEAM MEMBERS:
${people.map(p => `- ${p.name}: ${p.role || 'No role specified'} (${p.relationship_type})${p.recent_themes?.length ? ` - Recent topics: ${p.recent_themes.join(', ')}` : ''}`).join('\n')}`;

  // Recent management themes
  const themesSection = recent_themes.length > 0 ? `
RECENT MANAGEMENT THEMES (Last 30 days):
${recent_themes.map(t => `- ${t.theme}: discussed ${t.frequency} times across ${t.people_mentioned.length} conversations`).join('\n')}` : '';

  // Current challenges
  const challengesSection = current_challenges.length > 0 ? `
CURRENT CHALLENGES DETECTED:
${current_challenges.map(c => `- ${c}`).join('\n')}` : '';

  // Add semantic context if available
  let semanticSection = '';
  if (semantic_context && currentQuery) {
    if (semantic_context.similar_conversations.length > 0) {
      semanticSection += `
RELEVANT PAST DISCUSSIONS:
${semantic_context.similar_conversations.slice(0, 3).map(conv => 
  `- ${conv.person_id === 'general' ? 'General discussion' : people.find(p => p.id === conv.person_id)?.name || 'Unknown'}: "${conv.content.substring(0, 100)}..." (${Math.round(conv.similarity * 100)}% relevant)`
).join('\n')}`;
    }

    if (semantic_context.cross_person_insights.length > 0) {
      semanticSection += `
RELATED INSIGHTS FROM OTHER CONVERSATIONS:
${semantic_context.cross_person_insights.slice(0, 2).map(insight => 
  `- ${people.find(p => p.id === insight.person_id)?.name || 'Unknown'}: "${insight.content.substring(0, 100)}..."`
).join('\n')}`;
    }
  }

  // Context awareness note
  const contextNote = currentPersonId === 'general' 
    ? '\nCONVERSATION TYPE: General management discussion - use full team context for strategic advice'
    : `\nCONVERSATION TYPE: Focused discussion about ${people.find(p => p.id === currentPersonId)?.name || 'team member'} - but you have full awareness of your entire team context and can reference any team member`;

  return `${teamOverview}${themesSection}${challengesSection}${semanticSection}${contextNote}

When responding, you can reference insights from other team members and conversations when relevant, especially the semantic context provided above. You have full visibility into your entire team and should answer questions about any team member or role. Use this comprehensive awareness to provide deeply contextual and interconnected management advice.`;
} 