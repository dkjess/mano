import { Anthropic } from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'

export interface RecurringPattern {
  id: string;
  pattern_type: 'challenge' | 'topic' | 'relationship' | 'communication';
  pattern_description: string;
  frequency: number;
  last_occurrence: string;
  people_involved: string[];
  context_keywords: string[];
  suggested_actions: string[];
  confidence_score: number;
  user_id: string;
}

export interface LearningInsight {
  pattern: RecurringPattern;
  insight: string;
  actionable_suggestions: string[];
  priority: 'high' | 'medium' | 'low';
  relevance_score: number;
}

export interface ConversationAnalysis {
  themes: string[];
  challenges: string[];
  relationships: string[];
  communication_patterns: string[];
  follow_up_needed: boolean;
  learning_opportunities: string[];
}

/**
 * Learning system that identifies recurring management challenges and patterns
 * Implements Progressive Intelligence principle - learns from user interactions
 */
export class LearningSystem {
  private anthropic: Anthropic;
  private supabase: any;
  private userId: string;

  constructor(supabase: any, userId: string, anthropicApiKey: string) {
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
    this.supabase = supabase;
    this.userId = userId;
  }

  /**
   * Analyze conversation for learning patterns
   */
  async analyzeConversationForLearning(
    conversationHistory: any[],
    personId: string,
    managementContext: any
  ): Promise<ConversationAnalysis> {
    
    console.log('🧠 Learning system analyzing conversation for patterns');
    
    try {
      const prompt = `You are analyzing a management conversation to identify learning patterns and recurring challenges.

**Context:**
- Manager is discussing ${personId === 'general' ? 'general management topics' : 'a specific team member'}
- Team context: ${managementContext.people?.length || 0} people, ${managementContext.recent_themes?.length || 0} recent themes

**Conversation History:**
${conversationHistory.map(msg => `${msg.is_user ? 'Manager' : 'Mano'}: ${msg.content}`).join('\n')}

**Management Context:**
- Recent themes: ${managementContext.recent_themes?.join(', ') || 'None'}
- Team challenges: ${managementContext.challenges?.join(', ') || 'None'}

**Instructions:**
Identify learning opportunities and patterns in this conversation. Focus on:
1. Recurring management challenges
2. Communication patterns
3. Relationship dynamics
4. Areas where the manager could benefit from ongoing support

Respond in JSON format:
{
  "themes": ["theme1", "theme2"],
  "challenges": ["challenge1", "challenge2"],
  "relationships": ["relationship_pattern1", "relationship_pattern2"],
  "communication_patterns": ["pattern1", "pattern2"],
  "follow_up_needed": true/false,
  "learning_opportunities": ["opportunity1", "opportunity2"]
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: prompt,
        messages: [{
          role: 'user',
          content: 'Analyze this conversation for learning patterns and recurring challenges.'
        }]
      });

      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent?.text) {
        throw new Error('No analysis from learning system');
      }

      const analysis = JSON.parse(textContent.text);
      
      console.log('🧠 Learning analysis completed:', {
        themes: analysis.themes?.length || 0,
        challenges: analysis.challenges?.length || 0,
        opportunities: analysis.learning_opportunities?.length || 0
      });

      return analysis;

    } catch (error) {
      console.error('Learning system analysis failed:', error);
      return {
        themes: [],
        challenges: [],
        relationships: [],
        communication_patterns: [],
        follow_up_needed: false,
        learning_opportunities: []
      };
    }
  }

  /**
   * Store learning patterns in database
   */
  async storeRecurringPattern(pattern: Omit<RecurringPattern, 'id'>): Promise<string | null> {
    try {
      // Check if similar pattern already exists
      const existingPattern = await this.findSimilarPattern(pattern);
      
      if (existingPattern) {
        // Update frequency and last occurrence
        await this.supabase
          .from('recurring_patterns')
          .update({
            frequency: existingPattern.frequency + 1,
            last_occurrence: new Date().toISOString(),
            confidence_score: Math.min(existingPattern.confidence_score + 0.1, 1.0)
          })
          .eq('id', existingPattern.id);
          
        console.log('🧠 Updated existing pattern:', existingPattern.id);
        return existingPattern.id;
      } else {
        // Create new pattern
        const { data, error } = await this.supabase
          .from('recurring_patterns')
          .insert({
            ...pattern,
            user_id: this.userId,
            frequency: 1,
            last_occurrence: new Date().toISOString()
          })
          .select('id')
          .single();

        if (error) throw error;
        
        console.log('🧠 Created new learning pattern:', data.id);
        return data.id;
      }
    } catch (error) {
      console.error('Failed to store recurring pattern:', error);
      return null;
    }
  }

  /**
   * Find similar existing patterns to avoid duplicates
   */
  private async findSimilarPattern(pattern: Omit<RecurringPattern, 'id'>): Promise<RecurringPattern | null> {
    try {
      const { data } = await this.supabase
        .from('recurring_patterns')
        .select('*')
        .eq('user_id', this.userId)
        .eq('pattern_type', pattern.pattern_type);

      if (!data || data.length === 0) return null;

      // Simple similarity check based on keywords overlap
      for (const existing of data) {
        const keywordOverlap = pattern.context_keywords.filter(keyword => 
          existing.context_keywords.includes(keyword)
        ).length;
        
        const similarity = keywordOverlap / Math.max(pattern.context_keywords.length, existing.context_keywords.length);
        
        if (similarity > 0.6) {
          return existing;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to find similar pattern:', error);
      return null;
    }
  }

  /**
   * Get learning insights for proactive suggestions
   */
  async getLearningInsights(managementContext: any): Promise<LearningInsight[]> {
    try {
      // Get recent patterns
      const { data: patterns } = await this.supabase
        .from('recurring_patterns')
        .select('*')
        .eq('user_id', this.userId)
        .gte('frequency', 2) // Only patterns that occurred multiple times
        .order('last_occurrence', { ascending: false })
        .limit(10);

      if (!patterns || patterns.length === 0) {
        return [];
      }

      const insights: LearningInsight[] = [];

      for (const pattern of patterns) {
        // Generate insights based on pattern type and context
        const insight = await this.generateInsightFromPattern(pattern, managementContext);
        if (insight) {
          insights.push(insight);
        }
      }

      return insights.sort((a, b) => b.relevance_score - a.relevance_score);

    } catch (error) {
      console.error('Failed to get learning insights:', error);
      return [];
    }
  }

  /**
   * Generate actionable insight from recurring pattern
   */
  private async generateInsightFromPattern(
    pattern: RecurringPattern, 
    managementContext: any
  ): Promise<LearningInsight | null> {
    
    try {
      const prompt = `You are generating a learning insight from a recurring management pattern.

**Pattern:**
- Type: ${pattern.pattern_type}
- Description: ${pattern.pattern_description}
- Frequency: ${pattern.frequency} times
- Keywords: ${pattern.context_keywords.join(', ')}
- People involved: ${pattern.people_involved.join(', ')}

**Current Management Context:**
- Team size: ${managementContext.people?.length || 0}
- Recent themes: ${managementContext.recent_themes?.join(', ') || 'None'}
- Active challenges: ${managementContext.challenges?.join(', ') || 'None'}

**Instructions:**
Generate a learning insight that helps the manager proactively address this recurring pattern.
Focus on:
1. Why this pattern keeps recurring
2. Actionable steps to address it
3. Prevention strategies

Respond in JSON format:
{
  "insight": "Clear insight about the pattern",
  "actionable_suggestions": ["suggestion1", "suggestion2", "suggestion3"],
  "priority": "high|medium|low",
  "relevance_score": 0.0-1.0
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: prompt,
        messages: [{
          role: 'user',
          content: `Generate learning insight for this recurring pattern: ${pattern.pattern_description}`
        }]
      });

      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent?.text) {
        return null;
      }

      const insightData = JSON.parse(textContent.text);
      
      return {
        pattern,
        insight: insightData.insight,
        actionable_suggestions: insightData.actionable_suggestions || [],
        priority: insightData.priority || 'medium',
        relevance_score: insightData.relevance_score || 0.5
      };

    } catch (error) {
      console.error('Failed to generate insight from pattern:', error);
      return null;
    }
  }

  /**
   * Process conversation for learning after it's completed
   */
  async processConversationForLearning(
    conversationHistory: any[],
    personId: string,
    managementContext: any
  ): Promise<void> {
    
    if (conversationHistory.length < 4) {
      // Not enough conversation to learn from
      return;
    }

    try {
      // Analyze conversation for patterns
      const analysis = await this.analyzeConversationForLearning(
        conversationHistory,
        personId,
        managementContext
      );

      // Store learning patterns
      const patternPromises = [];

      // Store challenge patterns
      for (const challenge of analysis.challenges) {
        if (challenge.length > 5) { // Filter out very short challenges
          patternPromises.push(this.storeRecurringPattern({
            pattern_type: 'challenge',
            pattern_description: challenge,
            people_involved: personId !== 'general' ? [personId] : [],
            context_keywords: analysis.themes.concat(analysis.communication_patterns),
            suggested_actions: analysis.learning_opportunities,
            confidence_score: 0.7,
            user_id: this.userId
          }));
        }
      }

      // Store relationship patterns
      for (const relationship of analysis.relationships) {
        if (relationship.length > 5) {
          patternPromises.push(this.storeRecurringPattern({
            pattern_type: 'relationship',
            pattern_description: relationship,
            people_involved: personId !== 'general' ? [personId] : [],
            context_keywords: analysis.themes,
            suggested_actions: analysis.learning_opportunities,
            confidence_score: 0.6,
            user_id: this.userId
          }));
        }
      }

      // Store communication patterns
      for (const commPattern of analysis.communication_patterns) {
        if (commPattern.length > 5) {
          patternPromises.push(this.storeRecurringPattern({
            pattern_type: 'communication',
            pattern_description: commPattern,
            people_involved: personId !== 'general' ? [personId] : [],
            context_keywords: analysis.themes,
            suggested_actions: analysis.learning_opportunities,
            confidence_score: 0.5,
            user_id: this.userId
          }));
        }
      }

      await Promise.all(patternPromises);
      
      console.log('🧠 Learning processing completed for conversation');

    } catch (error) {
      console.error('Learning system processing failed:', error);
    }
  }
}