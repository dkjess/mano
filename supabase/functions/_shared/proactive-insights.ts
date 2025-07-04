import { Anthropic } from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'
import { LearningSystem, type LearningInsight } from './learning-system.ts'

export interface ProactiveInsight {
  id: string;
  type: 'conversation_starter' | 'follow_up' | 'pattern_alert' | 'preventive_action';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  person_id?: string;
  person_name?: string;
  actionable_steps: string[];
  context: string;
  relevance_score: number;
  expires_at?: string;
  created_at: string;
}

export interface TeamInsight {
  insight_type: 'team_dynamic' | 'communication_gap' | 'growth_opportunity' | 'risk_area';
  insight: string;
  affected_people: string[];
  suggested_actions: string[];
  urgency: 'high' | 'medium' | 'low';
}

/**
 * Proactive insights system that suggests conversation topics and management actions
 * Implements Progressive Intelligence principle - anticipates user needs
 */
export class ProactiveInsightsSystem {
  private anthropic: Anthropic;
  private supabase: any;
  private userId: string;
  private learningSystem: LearningSystem;

  constructor(supabase: any, userId: string, anthropicApiKey: string) {
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
    this.supabase = supabase;
    this.userId = userId;
    this.learningSystem = new LearningSystem(supabase, userId, anthropicApiKey);
  }

  /**
   * Generate proactive insights based on team patterns and learning
   */
  async generateProactiveInsights(managementContext: any): Promise<ProactiveInsight[]> {
    console.log('💡 Generating proactive insights from team patterns');
    
    try {
      const insights: ProactiveInsight[] = [];
      
      // Get learning insights
      const learningInsights = await this.learningSystem.getLearningInsights(managementContext);
      
      // Generate conversation starters
      const conversationStarters = await this.generateConversationStarters(managementContext);
      insights.push(...conversationStarters);
      
      // Generate follow-up suggestions
      const followUps = await this.generateFollowUpSuggestions(managementContext);
      insights.push(...followUps);
      
      // Generate pattern alerts from learning
      const patternAlerts = await this.generatePatternAlerts(learningInsights, managementContext);
      insights.push(...patternAlerts);
      
      // Generate team-wide insights
      const teamInsights = await this.generateTeamInsights(managementContext);
      insights.push(...teamInsights);
      
      // Sort by relevance and priority
      return insights
        .sort((a, b) => {
          const priorityWeight = { high: 3, medium: 2, low: 1 };
          const aPriority = priorityWeight[a.priority] || 1;
          const bPriority = priorityWeight[b.priority] || 1;
          
          return (bPriority * b.relevance_score) - (aPriority * a.relevance_score);
        })
        .slice(0, 10); // Top 10 insights
        
    } catch (error) {
      console.error('Failed to generate proactive insights:', error);
      return [];
    }
  }

  /**
   * Generate conversation starters based on team patterns
   */
  private async generateConversationStarters(managementContext: any): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];
    
    try {
      // Get people who haven't been contacted recently
      const { data: recentMessages } = await this.supabase
        .from('messages')
        .select('person_id, created_at')
        .eq('user_id', this.userId)
        .eq('is_user', true)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      const recentContactIds = new Set(recentMessages?.map(m => m.person_id) || []);
      const inactivePeople = managementContext.people?.filter(person => 
        !recentContactIds.has(person.id) && person.id !== 'general'
      ) || [];

      // Generate conversation starters for inactive people
      for (const person of inactivePeople.slice(0, 3)) {
        const starter = await this.generatePersonConversationStarter(person, managementContext);
        if (starter) {
          insights.push(starter);
        }
      }

      return insights;
      
    } catch (error) {
      console.error('Failed to generate conversation starters:', error);
      return [];
    }
  }

  /**
   * Generate conversation starter for specific person
   */
  private async generatePersonConversationStarter(
    person: any, 
    managementContext: any
  ): Promise<ProactiveInsight | null> {
    
    try {
      const prompt = `You are suggesting a conversation starter for a manager to reconnect with a team member.

**Person:** ${person.name}
**Role:** ${person.role || 'Unknown'}
**Relationship:** ${person.relationship_type || 'team member'}
**Team Context:** ${managementContext.people?.length || 0} people in team

**Recent Team Themes:** ${managementContext.recent_themes?.join(', ') || 'None'}
**Team Challenges:** ${managementContext.challenges?.join(', ') || 'None'}

**Instructions:**
Create a thoughtful conversation starter that:
1. Shows genuine interest in the person
2. Relates to current team context or their role
3. Opens up meaningful dialogue
4. Feels natural, not scripted

Respond in JSON format:
{
  "title": "Brief title for the conversation starter",
  "description": "Natural conversation opener",
  "actionable_steps": ["step1", "step2"],
  "context": "Why this conversation matters now",
  "relevance_score": 0.0-1.0
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: prompt,
        messages: [{
          role: 'user',
          content: `Generate a conversation starter for reconnecting with ${person.name}`
        }]
      });

      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent?.text) return null;

      const data = JSON.parse(textContent.text);
      
      return {
        id: `starter_${person.id}_${Date.now()}`,
        type: 'conversation_starter',
        title: data.title,
        description: data.description,
        priority: 'medium',
        person_id: person.id,
        person_name: person.name,
        actionable_steps: data.actionable_steps || [],
        context: data.context || `Reconnect with ${person.name}`,
        relevance_score: data.relevance_score || 0.6,
        created_at: new Date().toISOString()
      };

    } catch (error) {
      console.error('Failed to generate conversation starter for person:', error);
      return null;
    }
  }

  /**
   * Generate follow-up suggestions based on recent conversations
   */
  private async generateFollowUpSuggestions(managementContext: any): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];
    
    try {
      // Get recent conversations that might need follow-up
      const { data: recentConversations } = await this.supabase
        .from('messages')
        .select(`
          person_id,
          content,
          created_at,
          people:person_id (name, role)
        `)
        .eq('user_id', this.userId)
        .eq('is_user', false) // Assistant messages
        .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (!recentConversations || recentConversations.length === 0) {
        return insights;
      }

      // Look for conversations that mentioned actions, commitments, or follow-ups
      const actionKeywords = ['follow up', 'check in', 'next week', 'will do', 'action', 'commit', 'plan to'];
      
      const actionConversations = recentConversations.filter(conv => 
        actionKeywords.some(keyword => 
          conv.content.toLowerCase().includes(keyword)
        )
      );

      // Generate follow-up suggestions for conversations with action items
      for (const conv of actionConversations.slice(0, 3)) {
        const followUp = await this.generateFollowUpSuggestion(conv);
        if (followUp) {
          insights.push(followUp);
        }
      }

      return insights;
      
    } catch (error) {
      console.error('Failed to generate follow-up suggestions:', error);
      return [];
    }
  }

  /**
   * Generate follow-up suggestion for specific conversation
   */
  private async generateFollowUpSuggestion(conversation: any): Promise<ProactiveInsight | null> {
    try {
      const prompt = `You are identifying follow-up opportunities from a recent management conversation.

**Conversation Context:**
Person: ${conversation.people?.name || 'Unknown'}
Message: "${conversation.content}"
Date: ${new Date(conversation.created_at).toLocaleDateString()}

**Instructions:**
Identify if this conversation requires follow-up action. Look for:
- Commitments made
- Actions mentioned
- Check-ins needed
- Unresolved issues

If follow-up is needed, respond in JSON format:
{
  "needs_followup": true/false,
  "title": "Brief follow-up title",
  "description": "What follow-up is needed",
  "actionable_steps": ["step1", "step2"],
  "context": "Why this follow-up matters",
  "urgency": "high|medium|low",
  "relevance_score": 0.0-1.0
}

If no follow-up needed, respond: {"needs_followup": false}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 250,
        system: prompt,
        messages: [{
          role: 'user',
          content: `Analyze this conversation for follow-up needs: "${conversation.content}"`
        }]
      });

      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent?.text) return null;

      const data = JSON.parse(textContent.text);
      
      if (!data.needs_followup) return null;
      
      return {
        id: `followup_${conversation.person_id}_${Date.now()}`,
        type: 'follow_up',
        title: data.title,
        description: data.description,
        priority: data.urgency || 'medium',
        person_id: conversation.person_id,
        person_name: conversation.people?.name,
        actionable_steps: data.actionable_steps || [],
        context: data.context || 'Follow-up needed from recent conversation',
        relevance_score: data.relevance_score || 0.7,
        created_at: new Date().toISOString()
      };

    } catch (error) {
      console.error('Failed to generate follow-up suggestion:', error);
      return null;
    }
  }

  /**
   * Generate pattern alerts from learning insights
   */
  private async generatePatternAlerts(
    learningInsights: LearningInsight[], 
    managementContext: any
  ): Promise<ProactiveInsight[]> {
    
    const alerts: ProactiveInsight[] = [];
    
    for (const learning of learningInsights.slice(0, 3)) {
      if (learning.priority === 'high' && learning.relevance_score > 0.7) {
        alerts.push({
          id: `pattern_${learning.pattern.id}_${Date.now()}`,
          type: 'pattern_alert',
          title: `Recurring Pattern Alert: ${learning.pattern.pattern_type}`,
          description: learning.insight,
          priority: learning.priority,
          actionable_steps: learning.actionable_suggestions,
          context: `Pattern occurred ${learning.pattern.frequency} times`,
          relevance_score: learning.relevance_score,
          created_at: new Date().toISOString()
        });
      }
    }
    
    return alerts;
  }

  /**
   * Generate team-wide insights
   */
  private async generateTeamInsights(managementContext: any): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];
    
    try {
      const teamSize = managementContext.people?.length || 0;
      if (teamSize < 2) return insights; // Need at least 2 people for team insights

      const prompt = `You are analyzing team dynamics to provide management insights.

**Team Context:**
- Team size: ${teamSize} people
- Recent themes: ${managementContext.recent_themes?.join(', ') || 'None'}
- Challenges: ${managementContext.challenges?.join(', ') || 'None'}
- Communication patterns: ${managementContext.communication_patterns?.join(', ') || 'None'}

**Instructions:**
Identify team-level insights that could help the manager. Focus on:
1. Team dynamics and collaboration
2. Communication effectiveness
3. Growth opportunities
4. Potential risk areas

Generate 1-2 high-value team insights. Respond in JSON format:
{
  "insights": [
    {
      "title": "Insight title",
      "description": "Detailed insight",
      "actionable_steps": ["step1", "step2"],
      "priority": "high|medium|low",
      "relevance_score": 0.0-1.0
    }
  ]
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: prompt,
        messages: [{
          role: 'user',
          content: 'Generate team-level management insights based on the current context.'
        }]
      });

      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent?.text) return insights;

      const data = JSON.parse(textContent.text);
      
      for (const [index, insight] of (data.insights || []).entries()) {
        insights.push({
          id: `team_insight_${Date.now()}_${index}`,
          type: 'preventive_action',
          title: insight.title,
          description: insight.description,
          priority: insight.priority || 'medium',
          actionable_steps: insight.actionable_steps || [],
          context: 'Team-wide insight',
          relevance_score: insight.relevance_score || 0.6,
          created_at: new Date().toISOString()
        });
      }

      return insights;
      
    } catch (error) {
      console.error('Failed to generate team insights:', error);
      return [];
    }
  }

  /**
   * Get proactive insights for specific person
   */
  async getPersonSpecificInsights(personId: string, managementContext: any): Promise<ProactiveInsight[]> {
    try {
      const person = managementContext.people?.find(p => p.id === personId);
      if (!person) return [];

      const insights: ProactiveInsight[] = [];
      
      // Generate person-specific conversation starters
      const starter = await this.generatePersonConversationStarter(person, managementContext);
      if (starter) {
        insights.push(starter);
      }

      // Check for person-specific patterns from learning system
      const { data: personPatterns } = await this.supabase
        .from('recurring_patterns')
        .select('*')
        .eq('user_id', this.userId)
        .contains('people_involved', [personId])
        .gte('frequency', 2);

      for (const pattern of personPatterns || []) {
        insights.push({
          id: `person_pattern_${pattern.id}`,
          type: 'pattern_alert',
          title: `Pattern for ${person.name}`,
          description: pattern.pattern_description,
          priority: pattern.frequency > 3 ? 'high' : 'medium',
          person_id: personId,
          person_name: person.name,
          actionable_steps: pattern.suggested_actions || [],
          context: `Occurred ${pattern.frequency} times with ${person.name}`,
          relevance_score: Math.min(pattern.confidence_score + 0.2, 1.0),
          created_at: new Date().toISOString()
        });
      }

      return insights.sort((a, b) => b.relevance_score - a.relevance_score);
      
    } catch (error) {
      console.error('Failed to get person-specific insights:', error);
      return [];
    }
  }
}