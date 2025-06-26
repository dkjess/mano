import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMessages, createMessage } from '@/lib/database';
import { getChatCompletionStreaming } from '@/lib/claude';
import { formatContextForPrompt, type ManagementContextData, type TeamContext, type PersonContext } from '@/lib/management-context';
import type { Person } from '@/types/database';

// Import the vector-enabled context system
interface ManagementContext {
  people: any[];
  team_size: any;
  recent_themes: any[];
  current_challenges: any[];
  conversation_patterns: any;
  semantic_context?: any;
}

interface VectorSearchResult {
  id: string;
  content: string;
  person_id: string;
  message_type: string;
  created_at: string;
  similarity: number;
  metadata: any;
}

class VectorService {
  constructor(private supabase: any) {}

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
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

  async searchSimilarConversations(
    userId: string,
    query: string,
    options: {
      threshold?: number;
      limit?: number;
      personFilter?: string;
      topicFilter?: string;
    } = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      const { data, error } = await this.supabase
        .rpc('match_conversation_embeddings', {
          query_embedding: queryEmbedding,
          match_user_id: userId,
          match_threshold: options.threshold || 0.78,
          match_count: options.limit || 10,
          person_filter: options.personFilter || null,
          topic_filter: options.topicFilter || null
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

  async findSemanticContext(
    userId: string,
    currentQuery: string,
    currentPersonId: string,
    isTopicConversation: boolean = false,
    topicId?: string
  ): Promise<{
    similarConversations: VectorSearchResult[];
    crossPersonInsights: VectorSearchResult[];
  }> {
    const [similarConversations, allConversations] = await Promise.all([
      // Find similar conversations with current person/topic
      this.searchSimilarConversations(userId, currentQuery, {
        personFilter: (!isTopicConversation && currentPersonId !== 'general') ? currentPersonId : undefined,
        topicFilter: isTopicConversation ? topicId : undefined,
        limit: 5
      }),
      
      // Find similar conversations with other people/topics (cross-context insights)
      this.searchSimilarConversations(userId, currentQuery, {
        limit: 8
      })
    ]);

    const crossPersonInsights = isTopicConversation 
      ? allConversations.filter(r => r.person_id && r.person_id !== 'general').slice(0, 3)
      : allConversations.filter(r => r.person_id !== currentPersonId).slice(0, 3);

    return {
      similarConversations,
      crossPersonInsights
    };
  }

  async storeMessageEmbedding(
    userId: string,
    personIdOrTopicId: string,
    messageId: string,
    content: string,
    messageType: 'user' | 'assistant',
    metadata: any = {},
    isTopicConversation: boolean = false
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(content);

      const { error } = await this.supabase
        .from('conversation_embeddings')
        .insert({
          user_id: userId,
          person_id: isTopicConversation ? null : personIdOrTopicId,
          topic_id: isTopicConversation ? personIdOrTopicId : null,
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
}

class ManagementContextBuilder {
  private vectorService: VectorService;

  constructor(private supabase: any, private userId: string) {
    this.vectorService = new VectorService(supabase);
  }

  async buildFullContext(
    currentPersonId: string, 
    currentQuery?: string,
    isTopicConversation: boolean = false,
    topicId?: string
  ): Promise<{
    context: ManagementContext;
  }> {
    try {
      const [people, semanticContext] = await Promise.all([
        this.getPeopleOverview(),
        currentQuery ? this.getSemanticContext(currentQuery, currentPersonId, isTopicConversation, topicId) : Promise.resolve(undefined)
      ]);

      const context: ManagementContext = {
        people,
        team_size: this.calculateTeamSize(people),
        recent_themes: [],
        current_challenges: [],
        conversation_patterns: { most_discussed_people: [], trending_topics: [], cross_person_mentions: [] },
        semantic_context: semanticContext
      };

      return { context };
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

  private async getPeopleOverview() {
    const { data: people } = await this.supabase
      .from('people')
      .select('*')
      .eq('user_id', this.userId);
    
    return people || [];
  }

  private calculateTeamSize(people: any[]) {
    return {
      direct_reports: people.filter(p => p.relationship_type === 'direct_report').length,
      stakeholders: people.filter(p => p.relationship_type === 'stakeholder').length,
      managers: people.filter(p => p.relationship_type === 'manager').length,
      peers: people.filter(p => p.relationship_type === 'peer').length
    };
  }

  private async getSemanticContext(
    query: string, 
    currentPersonId: string, 
    isTopicConversation: boolean = false,
    topicId?: string
  ) {
    try {
      const context = await this.vectorService.findSemanticContext(
        this.userId,
        query,
        currentPersonId,
        isTopicConversation,
        topicId
      );
      
      // Transform to match interface naming
      return {
        similar_conversations: context.similarConversations,
        cross_person_insights: context.crossPersonInsights,
        related_themes: []
      };
    } catch (error) {
      console.error('Error getting semantic context:', error);
      return undefined;
    }
  }
}

function buildSemanticContext(people: any[], semanticContext: any, currentQuery: string, isTopicConversation: boolean = false): string[] {
  const insights: string[] = [];

  // Add relevant past discussions
  if (semanticContext?.similar_conversations?.length > 0) {
    semanticContext.similar_conversations.slice(0, 3).forEach((conv: any) => {
      let contextName = 'Unknown';
      if (conv.topic_id) {
        contextName = 'Topic discussion';
      } else if (conv.person_id === 'general') {
        contextName = 'General discussion';
      } else if (conv.person_id) {
        contextName = people.find(p => p.id === conv.person_id)?.name || 'Unknown person';
      }
      
      insights.push(`Previous ${contextName}: "${conv.content.substring(0, 100)}..." (${Math.round(conv.similarity * 100)}% relevant)`);
    });
  }

  // Add cross-context insights (person/topic insights)
  if (semanticContext?.cross_person_insights?.length > 0) {
    semanticContext.cross_person_insights.slice(0, 2).forEach((insight: any) => {
      let contextName = 'Unknown';
      if (insight.topic_id) {
        contextName = 'Topic';
      } else if (insight.person_id) {
        contextName = people.find(p => p.id === insight.person_id)?.name || 'Unknown person';
      }
      
      insights.push(`${contextName} pattern: "${insight.content.substring(0, 100)}..."`);
    });
  }

  return insights;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { person_id, message: userMessage, topicId } = body;
    let { isTopicConversation, topicTitle } = body;

    if (!person_id || !userMessage) {
      return new Response('person_id and message are required', { status: 400 });
    }

    // Handle special case for 'general' assistant - now topic-based
    let person: Person;
    let actualTopicId = topicId;
    
    if (person_id === 'general') {
      // Get or create the General topic
      try {
        const { getOrCreateGeneralTopic } = await import('@/lib/general-topic');
        const generalTopic = await getOrCreateGeneralTopic(user.id, supabase);
        actualTopicId = generalTopic.id;
        isTopicConversation = true;
        topicTitle = 'General';
      } catch (error) {
        console.error('Error getting General topic:', error);
      }
      
      person = {
        id: 'general',
        user_id: '',
        name: 'General',
        role: 'Management Assistant',
        relationship_type: 'assistant',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } else {
      // Get person details
      const { data: personData, error: personError } = await supabase
        .from('people')
        .select('*')
        .eq('id', person_id)
        .eq('user_id', user.id)
        .single();

      if (personError || !personData) {
        return new Response('Person not found', { status: 404 });
      }
      
      person = personData;
    }

    // Get conversation history (from topic if applicable, otherwise from person)
    let conversationHistory;
    if (isTopicConversation && actualTopicId) {
      // For topic conversations, get messages from the topic
      const { data: topicMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('topic_id', actualTopicId)
        .order('created_at', { ascending: true });
      conversationHistory = topicMessages || [];
    } else {
      conversationHistory = await getMessages(person_id, supabase);
    }

    // Build enhanced management context with vector search
    let managementContext: ManagementContextData | undefined;
    let vectorService: VectorService | undefined;
    try {
      const contextBuilder = new ManagementContextBuilder(supabase, user.id);
      const { context } = await contextBuilder.buildFullContext(
        person_id, 
        userMessage,
        isTopicConversation,
        actualTopicId
      );
      
      // Convert to expected ManagementContextData format
      const teamContext: TeamContext = {
        totalPeople: context.people.length,
        peopleByRole: context.people.reduce((acc: any, p: any) => {
          const role = p.role || 'Unspecified';
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        }, {}),
        peopleByRelationship: context.people.reduce((acc: any, p: any) => {
          acc[p.relationship_type] = (acc[p.relationship_type] || 0) + 1;
          return acc;
        }, {}),
        recentActivity: [],
        managementChallenges: [],
        teamOverview: `You manage ${context.team_size.direct_reports} direct reports, work with ${context.team_size.stakeholders} stakeholders, and coordinate with ${context.team_size.peers} peers.`
      };

      const allPeople: PersonContext[] = context.people.map((p: any) => ({
        name: p.name,
        role: p.role,
        relationshipType: p.relationship_type,
        recentTopics: [],
        conversationSummary: `Team member: ${p.name}`
      }));

      const crossConversationInsights = buildSemanticContext(context.people, context.semantic_context, userMessage, isTopicConversation);

      managementContext = {
        teamContext,
        allPeople,
        allTopics: [], // TODO: Add topic context when implementing full topic support
        crossConversationInsights,
        contextSummary: `Team of ${context.people.length} people with vector-enhanced context awareness.`
      };
      
      vectorService = new VectorService(supabase);
    } catch (contextError) {
      console.warn('Failed to gather enhanced management context, proceeding without it:', contextError);
      managementContext = undefined;
    }

    // Save user message first (to topic or person)
    let userMessageRecord;
    if (isTopicConversation && actualTopicId) {
      // For topic conversations, save to topic messages
      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          content: userMessage,
          topic_id: actualTopicId,
          person_id: null,
          is_user: true
        })
        .select()
        .single();
      
      if (error) throw error;
      userMessageRecord = message;
    } else {
      userMessageRecord = await createMessage({
        person_id,
        content: userMessage,
        is_user: true,
        user_id: user.id
      }, supabase);
    }

    try {
      // Get Claude's streaming response with management context
      // For topic conversations, enhance the context
      const contextualName = isTopicConversation ? `Topic Discussion: ${topicTitle}` : person.name;
      const contextualRole = isTopicConversation ? 'Management Coach for Topic Discussion' : person.role;
      
      const stream = await getChatCompletionStreaming(
        userMessage,
        contextualName,
        contextualRole,
        person.relationship_type,
        conversationHistory,
        managementContext
      );

      // Create a ReadableStream to handle the streaming response
      const readableStream = new ReadableStream({
        async start(controller) {
          let fullResponse = '';
          const encoder = new TextEncoder();
          
          // Send initial message ID
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'start', 
            userMessageId: userMessageRecord.id 
          })}\n\n`));

          try {
            for await (const chunk of stream) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                const text = chunk.delta.text;
                fullResponse += text;
                
                // Send the text chunk to the client
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'delta', 
                  text 
                })}\n\n`));
              }
            }

            // Save the complete response to database
            let assistantMessage;
            if (isTopicConversation && actualTopicId) {
              // For topic conversations, save to topic messages
              const { data: message, error } = await supabase
                .from('messages')
                .insert({
                  content: fullResponse,
                  topic_id: actualTopicId,
                  person_id: null,
                  is_user: false
                })
                .select()
                .single();
              
              if (error) throw error;
              assistantMessage = message;
            } else {
              assistantMessage = await createMessage({
                person_id,
                content: fullResponse,
                is_user: false,
                user_id: user.id
              }, supabase);
            }

            // Store embeddings for both messages (background task)
            if (vectorService) {
              const embeddingTarget = isTopicConversation ? actualTopicId : person_id;
              
              vectorService.storeMessageEmbedding(
                user.id,
                embeddingTarget,
                userMessageRecord.id,
                userMessage,
                'user',
                {},
                isTopicConversation
              ).catch(console.error);
              
              vectorService.storeMessageEmbedding(
                user.id,
                embeddingTarget,
                assistantMessage.id,
                fullResponse,
                'assistant',
                {},
                isTopicConversation
              ).catch(console.error);
            }

            // Send completion message
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'complete', 
              assistantMessageId: assistantMessage.id,
              fullResponse 
            })}\n\n`));

          } catch (error: any) {
            console.error('Claude streaming API error:', error);
            
            // Create error message based on error type
            let errorMessage = '';
            switch (error.message) {
              case 'RATE_LIMIT':
                errorMessage = '🤚 I\'m getting too many requests right now. Let\'s try again in a moment!';
                break;
              case 'SERVER_ERROR':
                errorMessage = '🤷 I\'m having some technical difficulties. Mind trying that again?';
                break;
              case 'AUTH_ERROR':
                errorMessage = '🔑 There\'s an authentication issue with my AI service. Please contact support.';
                break;
              default:
                errorMessage = '🤔 Something went wrong on my end. Would you like to try sending that message again?';
            }

            // Save error message
            let errorMessageRecord;
            if (isTopicConversation && actualTopicId) {
              const { data: message, error } = await supabase
                .from('messages')
                .insert({
                  content: errorMessage,
                  topic_id: actualTopicId,
                  person_id: null,
                  is_user: false
                })
                .select()
                .single();
              
              if (!error) errorMessageRecord = message;
            } else {
              errorMessageRecord = await createMessage({
                person_id,
                content: errorMessage,
                is_user: false,
                user_id: user.id
              }, supabase);
            }

            // Send error to client
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'error', 
              error: errorMessage,
              assistantMessageId: errorMessageRecord.id,
              shouldRetry: error.message !== 'AUTH_ERROR'
            })}\n\n`));
          }

          controller.close();
        }
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });

    } catch (error) {
      console.error('Error in streaming chat API:', error);
      return new Response('Internal server error', { status: 500 });
    }

  } catch (error) {
    console.error('Error in streaming chat API:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 