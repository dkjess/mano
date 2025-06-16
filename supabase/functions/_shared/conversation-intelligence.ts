import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { VectorService, VectorSearchResult } from './vector-service.ts'

export interface ConversationMemory {
  reference_type: 'specific_conversation' | 'pattern_across_people' | 'recent_theme' | 'long_term_pattern';
  confidence: number; // 0.0 to 1.0
  source_description: string;
  reference_text: string;
  people_involved: string[];
  timeframe: string;
}

export interface SmartFollowUp {
  question: string;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  context_source: string;
}

export interface ConversationInsight {
  type: 'pattern_detection' | 'trend_alert' | 'opportunity' | 'potential_issue';
  message: string;
  confidence: number;
  supporting_evidence: string[];
  suggested_action?: string;
}

export class ConversationIntelligence {
  constructor(
    private supabase: SupabaseClient,
    private vectorService: VectorService,
    private userId: string
  ) {}

  async analyzeConversationContext(
    currentQuery: string,
    currentPersonId: string,
    semanticContext: any,
    managementContext: any
  ): Promise<{
    memories: ConversationMemory[];
    followUps: SmartFollowUp[];
    insights: ConversationInsight[];
  }> {
    const [memories, followUps, insights] = await Promise.all([
      this.extractRelevantMemories(currentQuery, currentPersonId, semanticContext, managementContext),
      this.generateSmartFollowUps(currentQuery, currentPersonId, semanticContext, managementContext),
      this.detectConversationInsights(currentQuery, currentPersonId, managementContext)
    ]);

    return { memories, followUps, insights };
  }

  private async extractRelevantMemories(
    currentQuery: string,
    currentPersonId: string,
    semanticContext: any,
    managementContext: any
  ): Promise<ConversationMemory[]> {
    const memories: ConversationMemory[] = [];

    // Extract specific conversation memories
    if (semanticContext?.similar_conversations) {
      for (const conv of semanticContext.similar_conversations.slice(0, 2)) {
        if (conv.similarity > 0.85) {
          const personName = this.getPersonName(conv.person_id, managementContext.people);
          const timeAgo = this.getTimeAgo(conv.created_at);
          
          memories.push({
            reference_type: 'specific_conversation',
            confidence: conv.similarity,
            source_description: `Previous discussion with ${personName}`,
            reference_text: conv.content.substring(0, 150) + '...',
            people_involved: [conv.person_id],
            timeframe: timeAgo
          });
        }
      }
    }

    // Extract cross-person pattern memories
    if (semanticContext?.cross_person_insights) {
      const crossPersonGroups = this.groupSimilarInsights(semanticContext.cross_person_insights);
      
      for (const group of crossPersonGroups.slice(0, 1)) {
        if (group.length >= 2) {
          const peopleNames = group.map(insight => 
            this.getPersonName(insight.person_id, managementContext.people)
          );
          
          memories.push({
            reference_type: 'pattern_across_people',
            confidence: 0.8,
            source_description: `Similar concerns across multiple team members`,
            reference_text: `This theme has come up in conversations with ${peopleNames.join(' and ')}`,
            people_involved: group.map(g => g.person_id),
            timeframe: 'recent conversations'
          });
        }
      }
    }

    // Extract recent theme memories
    const relevantThemes = managementContext.recent_themes.filter((theme: any) => 
      this.isThemeRelevant(theme.theme, currentQuery)
    );

    for (const theme of relevantThemes.slice(0, 1)) {
      if (theme.frequency >= 2) {
        memories.push({
          reference_type: 'recent_theme',
          confidence: Math.min(theme.frequency / 5, 1.0),
          source_description: `Recurring discussion topic`,
          reference_text: `"${theme.theme}" has come up ${theme.frequency} times across your recent conversations`,
          people_involved: theme.people_mentioned,
          timeframe: 'past month'
        });
      }
    }

    return memories.slice(0, 3); // Limit to most relevant memories
  }

  private async generateSmartFollowUps(
    currentQuery: string,
    currentPersonId: string,
    semanticContext: any,
    managementContext: any
  ): Promise<SmartFollowUp[]> {
    const followUps: SmartFollowUp[] = [];

    // Generate follow-ups based on person-specific patterns
    if (currentPersonId !== 'general') {
      const person = managementContext.people.find((p: any) => p.id === currentPersonId);
      if (person?.recent_themes) {
        const unaddressedThemes = person.recent_themes.filter((theme: any) =>
          !this.queryAddressesTheme(currentQuery, theme)
        );

        for (const theme of unaddressedThemes.slice(0, 1)) {
          followUps.push({
            question: `How has the ${theme} situation been developing since we last discussed it?`,
            reasoning: `You've mentioned ${theme} in previous conversations with ${person.name}`,
            priority: 'medium',
            context_source: `Previous discussions with ${person.name}`
          });
        }
      }
    }

    // Generate follow-ups based on cross-team patterns
    const teamChallenges = managementContext.current_challenges;
    for (const challenge of teamChallenges.slice(0, 1)) {
      if (this.isQueryRelatedToChallenge(currentQuery, challenge)) {
        const relatedPeople = this.getPeopleRelatedToChallenge(challenge, managementContext);
        
        if (relatedPeople.length > 1) {
          followUps.push({
            question: `Have you noticed this ${challenge.toLowerCase()} pattern with other team members like ${relatedPeople.slice(0, 2).join(' or ')}?`,
            reasoning: `Similar challenges detected across multiple team members`,
            priority: 'high',
            context_source: 'Cross-team pattern analysis'
          });
        }
      }
    }

    // Generate follow-ups based on conversation gaps
    const lastContactGaps = this.findLongContactGaps(managementContext.people);
    if (currentPersonId === 'general' && lastContactGaps.length > 0) {
      const stalePerson = lastContactGaps[0];
      followUps.push({
        question: `It's been a while since you've discussed anything with ${stalePerson.name}. Any particular reason, or should that be on your radar?`,
        reasoning: `No recent conversations detected`,
        priority: 'low',
        context_source: 'Team communication patterns'
      });
    }

    return followUps.slice(0, 2); // Limit follow-ups to avoid overwhelming
  }

  private async detectConversationInsights(
    currentQuery: string,
    currentPersonId: string,
    managementContext: any
  ): Promise<ConversationInsight[]> {
    const insights: ConversationInsight[] = [];

    // Detect team communication patterns
    const communicationInsight = this.analyzeCommunicationPatterns(managementContext);
    if (communicationInsight) {
      insights.push(communicationInsight);
    }

    // Detect workload distribution patterns
    const workloadInsight = this.analyzeWorkloadPatterns(currentQuery, managementContext);
    if (workloadInsight) {
      insights.push(workloadInsight);
    }

    // Detect potential escalation needs
    const escalationInsight = this.detectEscalationNeeds(currentQuery, currentPersonId, managementContext);
    if (escalationInsight) {
      insights.push(escalationInsight);
    }

    return insights.slice(0, 2); // Limit insights
  }

  // Helper methods
  private getPersonName(personId: string, people: any[]): string {
    if (personId === 'general') return 'your general management discussions';
    const person = people.find(p => p.id === personId);
    return person?.name || 'unknown person';
  }

  private getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  }

  private groupSimilarInsights(insights: VectorSearchResult[]): VectorSearchResult[][] {
    // Simple grouping by person_id for now
    const groups = new Map<string, VectorSearchResult[]>();
    insights.forEach(insight => {
      if (!groups.has(insight.person_id)) {
        groups.set(insight.person_id, []);
      }
      groups.get(insight.person_id)!.push(insight);
    });
    return Array.from(groups.values()).filter(group => group.length >= 1);
  }

  private isThemeRelevant(theme: string, query: string): boolean {
    const themeWords = theme.toLowerCase().split(' ');
    const queryWords = query.toLowerCase().split(' ');
    return themeWords.some(word => queryWords.includes(word));
  }

  private queryAddressesTheme(query: string, theme: string): boolean {
    return query.toLowerCase().includes(theme.toLowerCase());
  }

  private isQueryRelatedToChallenge(query: string, challenge: string): boolean {
    const challengeWords = challenge.toLowerCase().split(' ');
    const queryLower = query.toLowerCase();
    return challengeWords.some(word => queryLower.includes(word));
  }

  private getPeopleRelatedToChallenge(challenge: string, context: any): string[] {
    // Simplified - would need more sophisticated analysis
    return context.people
      .filter((p: any) => p.recent_themes?.some((theme: any) => 
        challenge.toLowerCase().includes(theme.toLowerCase())
      ))
      .map((p: any) => p.name);
  }

  private findLongContactGaps(people: any[]): any[] {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return people
      .filter(person => {
        if (!person.last_contact) return true;
        return new Date(person.last_contact) < weekAgo;
      })
      .sort((a, b) => {
        const aDate = a.last_contact ? new Date(a.last_contact) : new Date(0);
        const bDate = b.last_contact ? new Date(b.last_contact) : new Date(0);
        return aDate.getTime() - bDate.getTime();
      });
  }

  private analyzeCommunicationPatterns(context: any): ConversationInsight | null {
    const communicationThemes = context.recent_themes.filter((theme: any) =>
      ['communication', 'clarity', 'alignment', 'confusion'].some(keyword =>
        theme.theme.toLowerCase().includes(keyword)
      )
    );

    if (communicationThemes.length >= 2) {
      return {
        type: 'pattern_detection',
        message: 'Communication challenges are appearing across multiple conversations',
        confidence: 0.8,
        supporting_evidence: communicationThemes.map((t: any) => `"${t.theme}" mentioned ${t.frequency} times`),
        suggested_action: 'Consider a team communication audit or process improvement'
      };
    }

    return null;
  }

  private analyzeWorkloadPatterns(query: string, context: any): ConversationInsight | null {
    const workloadKeywords = ['overwhelmed', 'busy', 'capacity', 'workload', 'burnout'];
    const queryLower = query.toLowerCase();
    
    if (workloadKeywords.some(keyword => queryLower.includes(keyword))) {
      const workloadThemes = context.recent_themes.filter((theme: any) =>
        workloadKeywords.some(keyword => theme.theme.toLowerCase().includes(keyword))
      );

      if (workloadThemes.length > 0) {
        return {
          type: 'trend_alert',
          message: 'Workload concerns are becoming a recurring theme',
          confidence: 0.7,
          supporting_evidence: [`Workload mentioned across ${workloadThemes.length} different conversation themes`],
          suggested_action: 'Consider reviewing team capacity and priorities'
        };
      }
    }

    return null;
  }

  private detectEscalationNeeds(query: string, personId: string, context: any): ConversationInsight | null {
    const escalationKeywords = ['conflict', 'disagreement', 'frustrated', 'blocked', 'urgent'];
    const queryLower = query.toLowerCase();

    if (escalationKeywords.some(keyword => queryLower.includes(keyword))) {
      return {
        type: 'potential_issue',
        message: 'This situation might benefit from senior leadership input',
        confidence: 0.6,
        supporting_evidence: ['Escalation indicators detected in current query'],
        suggested_action: 'Consider involving your manager or HR if the situation persists'
      };
    }

    return null;
  }
} 