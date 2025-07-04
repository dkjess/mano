import { Anthropic } from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'
import { VectorService, type VectorSearchResult } from './vector-service.ts'

export interface SemanticSearchContext {
  query: string;
  person_id?: string;
  time_range?: {
    start: string;
    end: string;
  };
  intent: 'find_similar' | 'find_patterns' | 'find_related_people' | 'find_followups';
  additional_context?: string[];
}

export interface EnhancedSearchResult {
  original_result: VectorSearchResult;
  relevance_score: number; // Enhanced scoring based on context
  context_match: string;
  relationship_to_query: string;
  actionable_insights: string[];
  connected_conversations: VectorSearchResult[];
}

export interface SemanticPattern {
  pattern_type: 'recurring_theme' | 'escalating_issue' | 'collaboration_opportunity' | 'communication_gap';
  pattern_description: string;
  confidence: number;
  supporting_conversations: VectorSearchResult[];
  people_involved: string[];
  suggested_actions: string[];
  trend_direction: 'improving' | 'worsening' | 'stable' | 'emerging';
}

/**
 * Enhanced semantic search that provides better context understanding and pattern recognition
 * Implements improved semantic search with AI-powered context analysis
 */
export class EnhancedSemanticSearch {
  private anthropic: Anthropic;
  private vectorService: VectorService;
  private supabase: any;
  private userId: string;

  constructor(supabase: any, vectorService: VectorService, userId: string, anthropicApiKey: string) {
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
    this.vectorService = vectorService;
    this.supabase = supabase;
    this.userId = userId;
  }

  /**
   * Enhanced semantic search with context-aware ranking
   */
  async enhancedSearch(context: SemanticSearchContext): Promise<EnhancedSearchResult[]> {
    console.log('🔍 Enhanced semantic search with context:', context.intent);
    
    try {
      // Step 1: Basic vector search
      const basicResults = await this.performBasicVectorSearch(context);
      
      // Step 2: AI-powered context analysis and re-ranking
      const enhancedResults = await this.enhanceSearchResults(basicResults, context);
      
      // Step 3: Find connected conversations
      const resultsWithConnections = await this.addConnectedConversations(enhancedResults, context);
      
      console.log(`🔍 Enhanced search returned ${resultsWithConnections.length} results`);
      return resultsWithConnections.slice(0, 10); // Top 10 results
      
    } catch (error) {
      console.error('Enhanced semantic search failed:', error);
      // Fallback to basic search
      return await this.fallbackToBasicSearch(context);
    }
  }

  /**
   * Perform basic vector search
   */
  private async performBasicVectorSearch(context: SemanticSearchContext): Promise<VectorSearchResult[]> {
    // Expand query with context for better search
    const expandedQuery = await this.expandQueryWithContext(context);
    
    let results: VectorSearchResult[] = [];
    
    if (context.person_id && context.person_id !== 'general') {
      // Person-specific search
      results = await this.vectorService.searchSimilarMessages(
        expandedQuery,
        this.userId,
        { 
          person_id: context.person_id,
          limit: 20,
          threshold: 0.7
        }
      );
    } else {
      // Cross-person search
      results = await this.vectorService.searchSimilarMessages(
        expandedQuery,
        this.userId,
        { 
          limit: 30,
          threshold: 0.75
        }
      );
    }
    
    return results;
  }

  /**
   * Expand query with contextual information for better search
   */
  private async expandQueryWithContext(context: SemanticSearchContext): Promise<string> {
    if (!context.additional_context || context.additional_context.length === 0) {
      return context.query;
    }

    try {
      const prompt = `You are helping expand a search query with additional context for better semantic search results.

**Original Query:** "${context.query}"
**Search Intent:** ${context.intent}
**Additional Context:** ${context.additional_context.join(', ')}

**Instructions:**
Expand the original query to include relevant context while maintaining search intent. Add synonyms, related terms, and context that would help find similar conversations.

**Examples:**
- Original: "performance issues" + Context: ["software engineering", "code quality"] 
  → Expanded: "performance issues code quality software engineering technical problems slow systems bottlenecks"
- Original: "team collaboration" + Context: ["remote work", "communication"]
  → Expanded: "team collaboration remote work communication coordination teamwork cross-functional cooperation"

Respond with only the expanded query (no explanations):`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        system: prompt,
        messages: [{
          role: 'user',
          content: `Expand this search query: "${context.query}" with context: ${context.additional_context.join(', ')}`
        }]
      });

      const textContent = response.content.find(block => block.type === 'text');
      return textContent?.text?.trim() || context.query;
      
    } catch (error) {
      console.error('Failed to expand query:', error);
      return context.query;
    }
  }

  /**
   * Enhance search results with AI-powered analysis
   */
  private async enhanceSearchResults(
    results: VectorSearchResult[], 
    context: SemanticSearchContext
  ): Promise<EnhancedSearchResult[]> {
    
    const enhancedResults: EnhancedSearchResult[] = [];
    
    for (const result of results) {
      try {
        const enhancement = await this.analyzeResultRelevance(result, context);
        enhancedResults.push({
          original_result: result,
          relevance_score: enhancement.relevance_score,
          context_match: enhancement.context_match,
          relationship_to_query: enhancement.relationship_to_query,
          actionable_insights: enhancement.actionable_insights,
          connected_conversations: [] // Will be populated later
        });
      } catch (error) {
        console.error('Failed to enhance search result:', error);
        // Include with basic relevance
        enhancedResults.push({
          original_result: result,
          relevance_score: result.similarity,
          context_match: 'Basic similarity match',
          relationship_to_query: 'Related conversation',
          actionable_insights: [],
          connected_conversations: []
        });
      }
    }
    
    // Sort by enhanced relevance score
    return enhancedResults.sort((a, b) => b.relevance_score - a.relevance_score);
  }

  /**
   * Analyze how relevant a search result is to the context
   */
  private async analyzeResultRelevance(
    result: VectorSearchResult, 
    context: SemanticSearchContext
  ): Promise<{
    relevance_score: number;
    context_match: string;
    relationship_to_query: string;
    actionable_insights: string[];
  }> {
    
    const prompt = `You are analyzing the relevance of a conversation snippet to a search query.

**Search Query:** "${context.query}"
**Search Intent:** ${context.intent}
**Conversation Snippet:** "${result.content}"
**Basic Similarity Score:** ${result.similarity}

**Instructions:**
Analyze how relevant this conversation is to the search query considering:
1. Direct content relevance
2. Contextual/thematic relevance  
3. Potential insights or patterns
4. Actionable information for a manager

Respond in JSON format:
{
  "relevance_score": 0.0-1.0,
  "context_match": "brief description of how this matches the search",
  "relationship_to_query": "specific relationship (e.g., 'similar challenge', 'same topic', 'related pattern')",
  "actionable_insights": ["insight1", "insight2"]
}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: prompt,
      messages: [{
        role: 'user',
        content: `Analyze relevance for: "${context.query}" vs "${result.content.substring(0, 200)}"`
      }]
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent?.text) {
      throw new Error('No relevance analysis returned');
    }

    const analysis = JSON.parse(textContent.text);
    
    return {
      relevance_score: Math.min(analysis.relevance_score || result.similarity, 1.0),
      context_match: analysis.context_match || 'Content similarity',
      relationship_to_query: analysis.relationship_to_query || 'Related conversation',
      actionable_insights: analysis.actionable_insights || []
    };
  }

  /**
   * Add connected conversations to each result
   */
  private async addConnectedConversations(
    enhancedResults: EnhancedSearchResult[], 
    context: SemanticSearchContext
  ): Promise<EnhancedSearchResult[]> {
    
    for (const result of enhancedResults.slice(0, 5)) { // Only for top 5 results
      try {
        // Find conversations from the same person around the same time
        const connectedConversations = await this.findConnectedConversations(
          result.original_result, 
          context
        );
        
        result.connected_conversations = connectedConversations;
        
      } catch (error) {
        console.error('Failed to find connected conversations:', error);
      }
    }
    
    return enhancedResults;
  }

  /**
   * Find conversations connected to a specific result
   */
  private async findConnectedConversations(
    result: VectorSearchResult, 
    context: SemanticSearchContext
  ): Promise<VectorSearchResult[]> {
    
    // Search for conversations from same person within 3 days
    const resultDate = new Date(result.created_at);
    const threeDaysBefore = new Date(resultDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    const threeDaysAfter = new Date(resultDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    const { data: connectedMessages } = await this.supabase
      .from('message_embeddings')
      .select('*')
      .eq('user_id', this.userId)
      .eq('person_id', result.person_id)
      .gte('created_at', threeDaysBefore.toISOString())
      .lte('created_at', threeDaysAfter.toISOString())
      .neq('id', result.id)
      .limit(5);
    
    return connectedMessages || [];
  }

  /**
   * Detect semantic patterns across search results
   */
  async detectSemanticPatterns(
    searchResults: EnhancedSearchResult[], 
    context: SemanticSearchContext
  ): Promise<SemanticPattern[]> {
    
    if (searchResults.length < 3) {
      return []; // Need at least 3 results to detect patterns
    }
    
    try {
      const prompt = `You are detecting patterns across multiple conversation snippets related to a search query.

**Search Query:** "${context.query}"
**Search Intent:** ${context.intent}

**Conversation Snippets:**
${searchResults.slice(0, 8).map((r, i) => 
  `${i + 1}. (${r.original_result.person_id}, ${new Date(r.original_result.created_at).toDateString()}): "${r.original_result.content.substring(0, 150)}"`
).join('\n')}

**Instructions:**
Identify patterns across these conversations. Look for:
1. Recurring themes or challenges
2. Escalating issues over time
3. Collaboration opportunities
4. Communication gaps
5. Trends (improving/worsening situations)

Generate 1-2 high-value patterns only.

Respond in JSON format:
{
  "patterns": [
    {
      "pattern_type": "recurring_theme|escalating_issue|collaboration_opportunity|communication_gap",
      "pattern_description": "clear description of the pattern",
      "confidence": 0.0-1.0,
      "people_involved": ["person1", "person2"],
      "suggested_actions": ["action1", "action2"],
      "trend_direction": "improving|worsening|stable|emerging"
    }
  ]
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: prompt,
        messages: [{
          role: 'user',
          content: `Detect patterns in these search results for: "${context.query}"`
        }]
      });

      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent?.text) return [];

      const analysis = JSON.parse(textContent.text);
      
      return (analysis.patterns || []).map((pattern: any) => ({
        ...pattern,
        supporting_conversations: searchResults.slice(0, 5).map(r => r.original_result)
      }));
      
    } catch (error) {
      console.error('Failed to detect semantic patterns:', error);
      return [];
    }
  }

  /**
   * Fallback to basic search if enhanced search fails
   */
  private async fallbackToBasicSearch(context: SemanticSearchContext): Promise<EnhancedSearchResult[]> {
    try {
      const basicResults = await this.performBasicVectorSearch(context);
      
      return basicResults.map(result => ({
        original_result: result,
        relevance_score: result.similarity,
        context_match: 'Basic similarity match',
        relationship_to_query: 'Related conversation',
        actionable_insights: [],
        connected_conversations: []
      }));
      
    } catch (error) {
      console.error('Fallback search also failed:', error);
      return [];
    }
  }

  /**
   * Search for conversations with specific management intent
   */
  async searchWithManagementIntent(
    query: string, 
    intent: 'coaching_moments' | 'performance_patterns' | 'team_dynamics' | 'growth_opportunities',
    personId?: string
  ): Promise<EnhancedSearchResult[]> {
    
    const context: SemanticSearchContext = {
      query,
      person_id: personId,
      intent: 'find_patterns',
      additional_context: this.getContextForManagementIntent(intent)
    };
    
    const results = await this.enhancedSearch(context);
    
    // Filter results based on management intent
    return results.filter(result => {
      switch (intent) {
        case 'coaching_moments':
          return result.actionable_insights.length > 0 || 
                 result.context_match.toLowerCase().includes('development') ||
                 result.context_match.toLowerCase().includes('growth');
        case 'performance_patterns':
          return result.context_match.toLowerCase().includes('performance') ||
                 result.context_match.toLowerCase().includes('challenge') ||
                 result.relevance_score > 0.8;
        case 'team_dynamics':
          return result.connected_conversations.length > 0 ||
                 result.context_match.toLowerCase().includes('team') ||
                 result.context_match.toLowerCase().includes('collaboration');
        case 'growth_opportunities':
          return result.actionable_insights.length > 0 ||
                 result.context_match.toLowerCase().includes('opportunity');
        default:
          return true;
      }
    });
  }

  /**
   * Get additional context keywords for management intents
   */
  private getContextForManagementIntent(intent: string): string[] {
    switch (intent) {
      case 'coaching_moments':
        return ['development', 'learning', 'growth', 'feedback', 'mentoring', 'skills'];
      case 'performance_patterns':
        return ['performance', 'results', 'goals', 'challenges', 'improvement', 'success'];
      case 'team_dynamics':
        return ['team', 'collaboration', 'communication', 'relationships', 'coordination'];
      case 'growth_opportunities':
        return ['opportunity', 'potential', 'advancement', 'promotion', 'development'];
      default:
        return [];
    }
  }
}