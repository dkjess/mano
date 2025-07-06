import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface VectorSearchResult {
  id: string;
  content: string;
  person_id: string;
  message_type: string;
  created_at: string;
  similarity: number;
  metadata: any;
}

export interface SummarySearchResult {
  id: string;
  summary_content: string;
  person_id: string;
  summary_type: string;
  time_range_start: string;
  time_range_end: string;
  similarity: number;
  metadata: any;
}

export class VectorService {
  constructor(private supabase: SupabaseClient) {}

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-ada-002'
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async storeMessageEmbedding(
    userId: string,
    personId: string,
    messageId: string,
    content: string,
    messageType: 'user' | 'assistant',
    metadata: any = {}
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(content);

      const { error } = await this.supabase
        .from('conversation_embeddings')
        .insert({
          user_id: userId,
          person_id: personId,
          message_id: messageId,
          content: content,
          embedding: embedding,
          message_type: messageType,
          metadata: metadata
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error storing message embedding:', error);
      // Don't throw - embedding storage is supplementary
    }
  }

  async searchSimilarConversations(
    userId: string,
    query: string,
    options: {
      threshold?: number;
      limit?: number;
      personFilter?: string;
    } = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      // Use the 5-parameter version explicitly to avoid function overloading conflicts
      const { data, error } = await this.supabase
        .rpc('match_conversation_embeddings', {
          query_embedding: queryEmbedding,
          match_user_id: userId,
          match_threshold: options.threshold || 0.78,
          match_count: options.limit || 10,
          person_filter: options.personFilter || null,
          topic_filter: null  // Explicitly set topic_filter to null to use the 6-parameter version
        });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error searching similar conversations:', error);
      return []; // Return empty array on error
    }
  }

  async searchSimilarSummaries(
    userId: string,
    query: string,
    options: {
      threshold?: number;
      limit?: number;
    } = {}
  ): Promise<SummarySearchResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      const { data, error } = await this.supabase
        .rpc('match_conversation_summaries', {
          query_embedding: queryEmbedding,
          match_user_id: userId,
          match_threshold: options.threshold || 0.75,
          match_count: options.limit || 5
        });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error searching similar summaries:', error);
      return []; // Return empty array on error
    }
  }

  async findSemanticContext(
    userId: string,
    currentQuery: string,
    currentPersonId: string
  ): Promise<{
    similarConversations: VectorSearchResult[];
    relatedThemes: SummarySearchResult[];
    crossPersonInsights: VectorSearchResult[];
  }> {
    const [similarConversations, relatedThemes, crossPersonInsights] = await Promise.all([
      // Find similar conversations with current person
      this.searchSimilarConversations(userId, currentQuery, {
        personFilter: currentPersonId !== 'general' ? currentPersonId : undefined,
        limit: 5
      }),
      
      // Find related theme summaries
      this.searchSimilarSummaries(userId, currentQuery, {
        limit: 3
      }),
      
      // Find similar conversations with other people (cross-person insights)
      currentPersonId !== 'general' 
        ? this.searchSimilarConversations(userId, currentQuery, {
            limit: 8
          }).then(results => results.filter(r => r.person_id !== currentPersonId))
        : []
    ]);

    return {
      similarConversations,
      relatedThemes,
      crossPersonInsights: crossPersonInsights.slice(0, 3) // Limit cross-person insights
    };
  }
} 