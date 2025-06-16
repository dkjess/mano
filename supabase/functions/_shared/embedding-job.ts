import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { VectorService } from './vector-service.ts'

export class EmbeddingJob {
  constructor(
    private supabase: SupabaseClient,
    private vectorService: VectorService
  ) {}

  async processUnembeddedMessages(userId: string): Promise<void> {
    try {
      // Find messages without embeddings
      const { data: unembeddedMessages } = await this.supabase
        .from('messages')
        .select(`
          id,
          person_id,
          content,
          is_user,
          created_at
        `)
        .not('id', 'in', 
          this.supabase
            .from('conversation_embeddings')
            .select('message_id')
            .eq('user_id', userId)
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50); // Process in batches

      if (!unembeddedMessages || unembeddedMessages.length === 0) {
        return;
      }

      console.log(`Processing ${unembeddedMessages.length} unembbeded messages for user ${userId}`);

      // Process messages in parallel (but rate-limited)
      const batchSize = 5;
      for (let i = 0; i < unembeddedMessages.length; i += batchSize) {
        const batch = unembeddedMessages.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (message) => {
            await this.vectorService.storeMessageEmbedding(
              userId,
              message.person_id,
              message.id,
              message.content,
              message.is_user ? 'user' : 'assistant',
              {
                original_created_at: message.created_at
              }
            );
          })
        );

        // Rate limiting delay between batches
        if (i + batchSize < unembeddedMessages.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Completed embedding ${unembeddedMessages.length} messages for user ${userId}`);
    } catch (error) {
      console.error('Error processing unembbeded messages:', error);
    }
  }

  async generateConversationSummaries(userId: string): Promise<void> {
    try {
      // Generate daily conversation summaries for recent activity
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      
      const { data: recentMessages } = await this.supabase
        .from('messages')
        .select('person_id, content, is_user, created_at')
        .eq('user_id', userId)
        .gte('created_at', threeDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (!recentMessages || recentMessages.length === 0) {
        return;
      }

      // Group messages by person and day
      const messagesByPersonDay = new Map<string, Map<string, any[]>>();
      
      recentMessages.forEach(msg => {
        const day = msg.created_at.split('T')[0]; // Get YYYY-MM-DD
        const key = `${msg.person_id}-${day}`;
        
        if (!messagesByPersonDay.has(msg.person_id)) {
          messagesByPersonDay.set(msg.person_id, new Map());
        }
        if (!messagesByPersonDay.get(msg.person_id)!.has(day)) {
          messagesByPersonDay.get(msg.person_id)!.set(day, []);
        }
        messagesByPersonDay.get(msg.person_id)!.get(day)!.push(msg);
      });

      // Generate summaries for each person-day combination
      for (const [personId, dayMap] of messagesByPersonDay) {
        for (const [day, messages] of dayMap) {
          await this.generateDailySummary(userId, personId, day, messages);
        }
      }

    } catch (error) {
      console.error('Error generating conversation summaries:', error);
    }
  }

  private async generateDailySummary(
    userId: string,
    personId: string,
    day: string,
    messages: any[]
  ): Promise<void> {
    if (messages.length < 3) return; // Skip days with minimal activity

    try {
      // Check if summary already exists
      const { data: existingSummary } = await this.supabase
        .from('conversation_summary_embeddings')
        .select('id')
        .eq('user_id', userId)
        .eq('person_id', personId)
        .eq('summary_type', 'daily')
        .gte('time_range_start', `${day}T00:00:00Z`)
        .lt('time_range_start', `${day}T23:59:59Z`)
        .single();

      if (existingSummary) return; // Summary already exists

      // Generate summary content
      const conversationText = messages
        .map(m => `${m.is_user ? 'Manager' : 'Mano'}: ${m.content}`)
        .join('\n');

      const summary = this.extractConversationThemes(conversationText);
      
      if (summary.length < 20) return; // Skip if summary too short

      // Store summary with embedding
      const embedding = await this.vectorService.generateEmbedding(summary);

      await this.supabase
        .from('conversation_summary_embeddings')
        .insert({
          user_id: userId,
          person_id: personId,
          summary_type: 'daily',
          summary_content: summary,
          embedding: embedding,
          time_range_start: `${day}T00:00:00Z`,
          time_range_end: `${day}T23:59:59Z`,
          metadata: {
            message_count: messages.length,
            generated_at: new Date().toISOString()
          }
        });

    } catch (error) {
      console.error(`Error generating daily summary for ${personId} on ${day}:`, error);
    }
  }

  private extractConversationThemes(conversationText: string): string {
    // Simple theme extraction - could be enhanced with AI summarization
    const lines = conversationText.split('\n');
    const managerQuestions = lines
      .filter(line => line.startsWith('Manager:'))
      .map(line => line.replace('Manager:', '').trim())
      .slice(0, 3); // Top 3 questions/topics

    const themes = managerQuestions.length > 0 
      ? `Key discussion topics: ${managerQuestions.join('; ')}`
      : 'General management discussion';

    return themes;
  }
} 