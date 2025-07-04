import { Anthropic } from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'

export interface CrossConversationConnection {
  id: string;
  person_a_id: string;
  person_b_id: string;
  connection_type: 'collaboration' | 'conflict' | 'dependency' | 'mentorship' | 'shared_challenge';
  connection_strength: number; // 0.0 to 1.0
  description: string;
  evidence: string[];
  last_updated: string;
  user_id: string;
}

export interface TeamDynamic {
  dynamic_type: 'team_cohesion' | 'communication_gap' | 'collaboration_pattern' | 'leadership_need';
  description: string;
  people_involved: string[];
  impact_level: 'high' | 'medium' | 'low';
  actionable_insights: string[];
  evidence_conversations: string[];
}

export interface CrossConversationInsight {
  insight_type: 'pattern_connection' | 'team_dynamic' | 'knowledge_gap' | 'opportunity';
  title: string;
  description: string;
  people_affected: string[];
  supporting_evidence: string[];
  recommended_actions: string[];
  confidence_score: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Cross-conversation intelligence system that identifies connections between conversations
 * Implements Cross-Conversation Intelligence principle - connects insights across people and topics
 */
export class CrossConversationIntelligence {
  private anthropic: Anthropic;
  private supabase: any;
  private userId: string;

  constructor(supabase: any, userId: string, anthropicApiKey: string) {
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
    this.supabase = supabase;
    this.userId = userId;
  }

  /**
   * Analyze conversations to identify cross-person connections
   */
  async analyzeTeamConnections(managementContext: any): Promise<CrossConversationConnection[]> {
    console.log('🔗 Analyzing cross-conversation connections');
    
    try {
      // Get recent conversations across all people
      const { data: recentMessages } = await this.supabase
        .from('messages')
        .select(`
          id,
          person_id,
          content,
          is_user,
          created_at,
          people:person_id (name, role)
        `)
        .eq('user_id', this.userId)
        .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) // Last 2 weeks
        .order('created_at', { ascending: false })
        .limit(200);

      if (!recentMessages || recentMessages.length === 0) {
        return [];
      }

      // Group messages by person
      const messagesByPerson = this.groupMessagesByPerson(recentMessages);
      
      // Find connections between people mentioned across conversations
      const connections = await this.identifyConnections(messagesByPerson, managementContext);
      
      // Store connections in database
      await this.storeConnections(connections);
      
      console.log(`🔗 Identified ${connections.length} cross-conversation connections`);
      return connections;
      
    } catch (error) {
      console.error('Failed to analyze team connections:', error);
      return [];
    }
  }

  /**
   * Group messages by person for analysis
   */
  private groupMessagesByPerson(messages: any[]): Map<string, any[]> {
    const groupedMessages = new Map();
    
    for (const message of messages) {
      if (!groupedMessages.has(message.person_id)) {
        groupedMessages.set(message.person_id, []);
      }
      groupedMessages.get(message.person_id).push(message);
    }
    
    return groupedMessages;
  }

  /**
   * Identify connections between people based on conversation content
   */
  private async identifyConnections(
    messagesByPerson: Map<string, any[]>, 
    managementContext: any
  ): Promise<CrossConversationConnection[]> {
    
    const connections: CrossConversationConnection[] = [];
    const peopleIds = Array.from(messagesByPerson.keys()).filter(id => id !== 'general');
    
    // Check each pair of people for connections
    for (let i = 0; i < peopleIds.length; i++) {
      for (let j = i + 1; j < peopleIds.length; j++) {
        const personA = peopleIds[i];
        const personB = peopleIds[j];
        
        const connection = await this.analyzePersonConnection(
          personA,
          personB,
          messagesByPerson,
          managementContext
        );
        
        if (connection) {
          connections.push(connection);
        }
      }
    }
    
    return connections;
  }

  /**
   * Analyze connection between two specific people
   */
  private async analyzePersonConnection(
    personAId: string,
    personBId: string,
    messagesByPerson: Map<string, any[]>,
    managementContext: any
  ): Promise<CrossConversationConnection | null> {
    
    try {
      const personAMessages = messagesByPerson.get(personAId) || [];
      const personBMessages = messagesByPerson.get(personBId) || [];
      
      const personAName = personAMessages[0]?.people?.name || personAId;
      const personBName = personBMessages[0]?.people?.name || personBId;
      
      // Get conversation content for analysis
      const personAContent = personAMessages
        .map(m => m.content)
        .join(' ')
        .substring(0, 2000); // Limit content for API
        
      const personBContent = personBMessages
        .map(m => m.content)
        .join(' ')
        .substring(0, 2000);

      // Check if either person mentions the other
      const personAMentionsB = personAContent.toLowerCase().includes(personBName.toLowerCase());
      const personBMentionsA = personBContent.toLowerCase().includes(personAName.toLowerCase());
      
      if (!personAMentionsB && !personBMentionsA) {
        // Look for thematic connections instead
        return await this.analyzeThematicConnection(
          personAId, personBId, personAName, personBName,
          personAContent, personBContent
        );
      }

      // Direct mentions found - analyze the connection
      const prompt = `You are analyzing workplace relationships between two team members based on conversation patterns.

**Person A:** ${personAName}
**Person B:** ${personBName}

**Conversations about ${personAName}:**
${personAContent}

**Conversations about ${personBName}:**
${personBContent}

**Instructions:**
Analyze the connection between these two people. Look for:
1. Direct collaboration or working relationships
2. Conflicts or tension
3. Dependencies (one relies on the other)
4. Mentorship or guidance relationships
5. Shared challenges or goals

Respond in JSON format:
{
  "has_connection": true/false,
  "connection_type": "collaboration|conflict|dependency|mentorship|shared_challenge",
  "connection_strength": 0.0-1.0,
  "description": "Clear description of the connection",
  "evidence": ["evidence1", "evidence2"],
  "actionable_insights": ["insight1", "insight2"]
}

If no meaningful connection exists, respond: {"has_connection": false}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: prompt,
        messages: [{
          role: 'user',
          content: `Analyze the connection between ${personAName} and ${personBName}`
        }]
      });

      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent?.text) return null;

      const analysis = JSON.parse(textContent.text);
      
      if (!analysis.has_connection) return null;
      
      return {
        id: `connection_${personAId}_${personBId}_${Date.now()}`,
        person_a_id: personAId,
        person_b_id: personBId,
        connection_type: analysis.connection_type,
        connection_strength: analysis.connection_strength || 0.5,
        description: analysis.description,
        evidence: analysis.evidence || [],
        last_updated: new Date().toISOString(),
        user_id: this.userId
      };
      
    } catch (error) {
      console.error(`Failed to analyze connection between ${personAId} and ${personBId}:`, error);
      return null;
    }
  }

  /**
   * Analyze thematic connections between people who don't directly mention each other
   */
  private async analyzeThematicConnection(
    personAId: string,
    personBId: string,
    personAName: string,
    personBName: string,
    personAContent: string,
    personBContent: string
  ): Promise<CrossConversationConnection | null> {
    
    try {
      const prompt = `You are identifying thematic connections between two team members based on shared challenges, topics, or patterns.

**Person A (${personAName}) conversations:**
${personAContent}

**Person B (${personBName}) conversations:**
${personBContent}

**Instructions:**
Look for thematic connections such as:
- Similar challenges or obstacles
- Complementary skills or needs
- Shared project areas or goals
- Similar communication patterns or concerns

Only identify strong thematic connections that would be valuable for a manager to know about.

Respond in JSON format:
{
  "has_thematic_connection": true/false,
  "connection_type": "shared_challenge|complementary_skills|similar_goals",
  "connection_strength": 0.0-1.0,
  "description": "Description of the thematic connection",
  "evidence": ["theme1", "theme2"],
  "potential_actions": ["action1", "action2"]
}

If no meaningful thematic connection exists, respond: {"has_thematic_connection": false}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: prompt,
        messages: [{
          role: 'user',
          content: `Analyze thematic connections between ${personAName} and ${personBName}`
        }]
      });

      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent?.text) return null;

      const analysis = JSON.parse(textContent.text);
      
      if (!analysis.has_thematic_connection || analysis.connection_strength < 0.6) {
        return null;
      }
      
      return {
        id: `thematic_connection_${personAId}_${personBId}_${Date.now()}`,
        person_a_id: personAId,
        person_b_id: personBId,
        connection_type: analysis.connection_type,
        connection_strength: analysis.connection_strength,
        description: analysis.description,
        evidence: analysis.evidence || [],
        last_updated: new Date().toISOString(),
        user_id: this.userId
      };
      
    } catch (error) {
      console.error('Failed to analyze thematic connection:', error);
      return null;
    }
  }

  /**
   * Store connections in database
   */
  private async storeConnections(connections: CrossConversationConnection[]): Promise<void> {
    try {
      if (connections.length === 0) return;

      // Clear old connections first
      await this.supabase
        .from('cross_conversation_connections')
        .delete()
        .eq('user_id', this.userId)
        .lt('last_updated', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      // Insert new connections
      const { error } = await this.supabase
        .from('cross_conversation_connections')
        .upsert(connections.map(conn => ({
          ...conn,
          id: undefined // Let database generate new IDs
        })));

      if (error) {
        console.error('Failed to store cross-conversation connections:', error);
      } else {
        console.log(`🔗 Stored ${connections.length} cross-conversation connections`);
      }
      
    } catch (error) {
      console.error('Failed to store connections:', error);
    }
  }

  /**
   * Generate team dynamics insights from connections
   */
  async generateTeamDynamicsInsights(connections: CrossConversationConnection[]): Promise<TeamDynamic[]> {
    if (connections.length === 0) return [];
    
    try {
      const prompt = `You are analyzing team dynamics from workplace relationship data.

**Team Connections:**
${connections.map(conn => 
  `- ${conn.connection_type} connection (strength: ${conn.connection_strength}): ${conn.description}`
).join('\n')}

**Instructions:**
Identify key team dynamics that a manager should be aware of. Focus on:
1. Overall team cohesion patterns
2. Communication gaps or silos
3. Collaboration patterns and effectiveness  
4. Leadership emergence or needs
5. Risk areas (conflicts, dependencies)

Generate 2-3 high-value team dynamics insights.

Respond in JSON format:
{
  "team_dynamics": [
    {
      "dynamic_type": "team_cohesion|communication_gap|collaboration_pattern|leadership_need",
      "description": "Clear description of the dynamic",
      "impact_level": "high|medium|low",
      "actionable_insights": ["insight1", "insight2"],
      "people_involved": ["person1", "person2"]
    }
  ]
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: prompt,
        messages: [{
          role: 'user',
          content: 'Analyze team dynamics from these relationship connections'
        }]
      });

      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent?.text) return [];

      const analysis = JSON.parse(textContent.text);
      return analysis.team_dynamics || [];
      
    } catch (error) {
      console.error('Failed to generate team dynamics insights:', error);
      return [];
    }
  }

  /**
   * Get cross-conversation insights for management context
   */
  async getCrossConversationInsights(managementContext: any): Promise<CrossConversationInsight[]> {
    try {
      // Analyze team connections
      const connections = await this.analyzeTeamConnections(managementContext);
      
      // Generate team dynamics
      const teamDynamics = await this.generateTeamDynamicsInsights(connections);
      
      // Convert to cross-conversation insights
      const insights: CrossConversationInsight[] = [];
      
      // Add connection-based insights
      for (const connection of connections.slice(0, 3)) { // Top 3 connections
        if (connection.connection_strength > 0.7) {
          insights.push({
            insight_type: 'pattern_connection',
            title: `${connection.connection_type} Connection Identified`,
            description: connection.description,
            people_affected: [connection.person_a_id, connection.person_b_id],
            supporting_evidence: connection.evidence,
            recommended_actions: [`Leverage this ${connection.connection_type} for team effectiveness`],
            confidence_score: connection.connection_strength,
            priority: connection.connection_strength > 0.8 ? 'high' : 'medium'
          });
        }
      }
      
      // Add team dynamics insights
      for (const dynamic of teamDynamics) {
        insights.push({
          insight_type: 'team_dynamic',
          title: `Team Dynamic: ${dynamic.dynamic_type.replace('_', ' ')}`,
          description: dynamic.description,
          people_affected: dynamic.people_involved,
          supporting_evidence: [`Based on cross-conversation analysis`],
          recommended_actions: dynamic.actionable_insights,
          confidence_score: dynamic.impact_level === 'high' ? 0.8 : 0.6,
          priority: dynamic.impact_level
        });
      }
      
      return insights.sort((a, b) => b.confidence_score - a.confidence_score);
      
    } catch (error) {
      console.error('Failed to get cross-conversation insights:', error);
      return [];
    }
  }
}