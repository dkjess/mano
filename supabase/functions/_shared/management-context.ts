import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
}

export class ManagementContextBuilder {
  constructor(private supabase: SupabaseClient, private userId: string) {}

  async buildFullContext(currentPersonId: string): Promise<ManagementContext> {
    try {
      const [people, themes, challenges, patterns] = await Promise.all([
        this.getPeopleOverview(),
        this.getRecentThemes(),
        this.getCurrentChallenges(),
        this.getConversationPatterns()
      ]);

      return {
        people,
        team_size: this.calculateTeamSize(people),
        recent_themes: themes,
        current_challenges: challenges,
        conversation_patterns: patterns
      };
    } catch (error) {
      console.error('Error building management context:', error);
      // Return minimal context on error
      return {
        people: [],
        team_size: { direct_reports: 0, stakeholders: 0, managers: 0, peers: 0 },
        recent_themes: [],
        current_challenges: [],
        conversation_patterns: { most_discussed_people: [], trending_topics: [], cross_person_mentions: [] }
      };
    }
  }

  private async getPeopleOverview(): Promise<PersonSummary[]> {
    // Get all people in user's network
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

export function formatContextForPrompt(context: ManagementContext, currentPersonId: string): string {
  const { people, team_size, recent_themes, current_challenges } = context;

  // Handle case where no team members exist yet
  if (people.length === 0) {
    const emptyTeamNote = currentPersonId === 'general' 
      ? '\nCONVERSATION TYPE: General management discussion - no team members added yet, focus on general management advice'
      : '\nCONVERSATION TYPE: Individual discussion - no broader team context available yet';
    
    return `TEAM OVERVIEW: No team members have been added to your network yet. Consider adding your direct reports, peers, managers, and key stakeholders to get more contextual management advice.${emptyTeamNote}

When you add team members and have conversations about them, I'll be able to provide insights that connect patterns and themes across your entire management network.`;
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

  // Context awareness note
  const contextNote = currentPersonId === 'general' 
    ? '\nCONVERSATION TYPE: General management discussion - use full team context for strategic advice'
    : `\nCONVERSATION TYPE: Focused discussion about ${people.find(p => p.id === currentPersonId)?.name || 'team member'} - but you have awareness of broader team context`;

  return `${teamOverview}${themesSection}${challengesSection}${contextNote}

When responding, you can reference insights from other team members and conversations when relevant, but stay focused on the current discussion thread. Use this team awareness to provide more contextual and interconnected management advice.`;
} 