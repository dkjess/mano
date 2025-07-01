import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMessages, createMessage } from '@/lib/database';
import { getChatCompletionStreaming } from '@/lib/claude';
import { formatContextForPrompt, type ManagementContextData, type TeamContext, type PersonContext } from '@/lib/management-context';
import { BUCKET_NAME } from '@/lib/storage';
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
    fileContent?: VectorSearchResult[];
  }> {
    const [similarConversations, allConversations, fileContent] = await Promise.all([
      // Find similar conversations with current person/topic
      this.searchSimilarConversations(userId, currentQuery, {
        personFilter: (!isTopicConversation && currentPersonId !== 'general') ? currentPersonId : undefined,
        topicFilter: isTopicConversation ? topicId : undefined,
        limit: 5
      }),
      
      // Find similar conversations with other people/topics (cross-context insights)
      this.searchSimilarConversations(userId, currentQuery, {
        limit: 8
      }),

      // Search through uploaded file content
      this.searchFileContent(userId, currentQuery, {
        personFilter: (!isTopicConversation && currentPersonId !== 'general') ? currentPersonId : undefined,
        topicFilter: isTopicConversation ? topicId : undefined,
        limit: 3,
        threshold: 0.75 // Slightly higher threshold for file content
      })
    ]);

    const crossPersonInsights = isTopicConversation 
      ? allConversations.filter(r => r.person_id && r.person_id !== 'general').slice(0, 3)
      : allConversations.filter(r => r.person_id !== currentPersonId).slice(0, 3);

    return {
      similarConversations,
      crossPersonInsights,
      fileContent: fileContent.length > 0 ? fileContent : undefined
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
          metadata: metadata,
          content_type: 'message'
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error storing message embedding:', error);
      // Don't throw - embedding storage is supplementary
    }
  }

  /**
   * Store embeddings for file content
   */
  async storeFileContentEmbedding(
    userId: string,
    fileId: string,
    messageId: string,
    content: string,
    metadata: any = {}
  ): Promise<void> {
    try {
      // For large files, chunk the content
      const chunks = this.chunkContent(content);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.generateEmbedding(chunk);

        // Get the message details to determine person_id or topic_id
        const { data: messageRecord } = await this.supabase
          .from('messages')
          .select('person_id, topic_id')
          .eq('id', messageId)
          .single();

        const { error } = await this.supabase
          .from('conversation_embeddings')
          .insert({
            user_id: userId,
            person_id: messageRecord?.person_id || null,
            topic_id: messageRecord?.topic_id || null,
            message_id: messageId,
            file_id: fileId,
            content: chunk,
            embedding: embedding,
            message_type: 'user', // File uploads are always from user
            metadata: {
              ...metadata,
              original_filename: metadata.filename,
              chunk_number: i,
              total_chunks: chunks.length
            },
            content_type: chunks.length > 1 ? 'file_chunk' : 'file_content',
            chunk_index: i
          });

        if (error) {
          console.error(`Error storing file embedding chunk ${i}:`, error);
        }
      }
    } catch (error) {
      console.error('Error storing file content embedding:', error);
      // Don't throw - embedding storage is supplementary
    }
  }

  /**
   * Search through file content embeddings
   */
  async searchFileContent(
    userId: string,
    query: string,
    options: {
      threshold?: number;
      limit?: number;
      fileId?: string;
      personFilter?: string;
      topicFilter?: string;
    } = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      const { data, error } = await this.supabase
        .rpc('match_file_content_embeddings', {
          query_embedding: queryEmbedding,
          match_user_id: userId,
          match_threshold: options.threshold || 0.78,
          match_count: options.limit || 10,
          file_filter: options.fileId || null,
          person_filter: options.personFilter || null,
          topic_filter: options.topicFilter || null
        });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error searching file content:', error);
      return [];
    }
  }

  /**
   * Split content into manageable chunks for embedding
   */
  private chunkContent(content: string, maxChunkSize: number = 8000): string[] {
    if (content.length <= maxChunkSize) {
      return [content];
    }

    const chunks: string[] = [];
    const sentences = content.split(/[.!?]\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      const testChunk = currentChunk + (currentChunk ? '. ' : '') + sentence;
      
      if (testChunk.length <= maxChunkSize) {
        currentChunk = testChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          // Single sentence is too long, split by words
          const words = sentence.split(' ');
          let wordChunk = '';
          
          for (const word of words) {
            const testWordChunk = wordChunk + (wordChunk ? ' ' : '') + word;
            if (testWordChunk.length <= maxChunkSize) {
              wordChunk = testWordChunk;
            } else {
              if (wordChunk) chunks.push(wordChunk);
              wordChunk = word;
            }
          }
          
          if (wordChunk) currentChunk = wordChunk;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [content.substring(0, maxChunkSize)];
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
        file_content_insights: context.fileContent,
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

  // Add relevant file content insights
  if (semanticContext?.file_content_insights?.length > 0) {
    semanticContext.file_content_insights.slice(0, 2).forEach((fileInsight: any) => {
      const fileName = fileInsight.metadata?.original_filename || 'Unknown file';
      const similarity = Math.round(fileInsight.similarity * 100);
      
      insights.push(`From uploaded file "${fileName}": "${fileInsight.content.substring(0, 100)}..." (${similarity}% relevant)`);
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

    // Fetch user profile for personalized responses
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('call_name, job_role, company')
      .eq('user_id', user.id)
      .single();

    const body = await request.json();
    console.log('🔍 DEBUG: Request body received:', {
      person_id: body.person_id,
      message: body.message?.substring(0, 100) + (body.message?.length > 100 ? '...' : ''),
      topicId: body.topicId,
      hasFiles: body.hasFiles,
      isTopicConversation: body.isTopicConversation,
      topicTitle: body.topicTitle
    });
    
    const { person_id, message: userMessage, topicId, hasFiles } = body;
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
        const { getOrCreateGeneralTopic } = await import('@/lib/general-topic-server');
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

    // Find the existing user message (created by frontend) instead of creating a new one
    let userMessageRecord;
    if (isTopicConversation && actualTopicId) {
      // For topic conversations, find the most recent user message
      const { data: message, error } = await supabase
        .from('messages')
        .select('*')
        .eq('topic_id', actualTopicId)
        .eq('is_user', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        console.warn('Could not find existing user message for topic, creating new one:', error);
        // Fallback: create new message if not found
        const { data: newMessage, error: createError } = await supabase
          .from('messages')
          .insert({
            content: userMessage,
            topic_id: actualTopicId,
            person_id: null,
            is_user: true,
            user_id: user.id
          })
          .select()
          .single();
        
        if (createError) throw createError;
        userMessageRecord = newMessage;
      } else {
        userMessageRecord = message;
      }
    } else {
      // For person conversations, find the most recent user message
      const { data: message, error } = await supabase
        .from('messages')
        .select('*')
        .eq('person_id', person_id)
        .eq('is_user', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        console.warn('Could not find existing user message for person, creating new one:', error);
        // Fallback: create new message if not found
        userMessageRecord = await createMessage({
          person_id,
          content: userMessage,
          is_user: true,
          user_id: user.id
        }, supabase);
      } else {
        userMessageRecord = message;
      }
    }

    // If the user uploaded files, fetch them to include in context
    let fileContext = '';
    console.log('🔍 DEBUG: Checking for files...', { hasFiles, userMessageId: userMessageRecord?.id });
    
    if (hasFiles && userMessageRecord) {
      try {
        console.log('🔍 DEBUG: Fetching message files from database...');
        const { data: messageFiles } = await supabase
          .from('message_files')
          .select('original_name, file_type, content_type, extracted_content, processing_status')
          .eq('message_id', userMessageRecord.id);
        
        console.log('🔍 DEBUG: Message files query result:', { messageFiles, count: messageFiles?.length });
        
        if (messageFiles && messageFiles.length > 0) {
          fileContext = `\n\n[Attached files:]\n`;
          console.log('🔍 DEBUG: Processing', messageFiles.length, 'files...');
          
          // Use extracted content from database (much simpler and faster)
          for (const file of messageFiles) {
            console.log('🔍 DEBUG: Processing file:', {
              name: file.original_name,
              type: file.file_type,
              contentType: file.content_type,
              hasExtractedContent: !!file.extracted_content,
              processingStatus: file.processing_status
            });
            
            fileContext += `\n--- File: ${file.original_name} ---\n`;
            
            // Use extracted content from database
            if (file.extracted_content) {
              console.log('🔍 DEBUG: Using extracted content from database:', { 
                contentLength: file.extracted_content.length,
                preview: file.extracted_content.substring(0, 100) + (file.extracted_content.length > 100 ? '...' : '')
              });
              
              // Limit content to avoid token limits
              const content = file.extracted_content.length > 5000 
                ? file.extracted_content.substring(0, 5000) + '\n...[truncated]'
                : file.extracted_content;
              fileContext += `Content:\n${content}\n`;
            } else if (file.processing_status === 'processing') {
              console.log('🔍 DEBUG: File is still being processed');
              fileContext += `[File is being processed...]\n`;
            } else if (file.processing_status === 'failed') {
              console.log('🔍 DEBUG: File processing failed');
              fileContext += `[File processing failed]\n`;
            } else if (file.processing_status === 'pending') {
              console.log('🔍 DEBUG: File processing is pending');
              fileContext += `[File processing is pending...]\n`;
            } else {
              console.log('🔍 DEBUG: No text content available for file type');
              fileContext += `[No text content available for this file type]\n`;
            }
            
            fileContext += `--- End of ${file.original_name} ---\n`;
          }
        } else {
          console.log('🔍 DEBUG: No files found for message ID:', userMessageRecord.id);
        }
      } catch (error) {
        console.error('🔍 DEBUG: Error fetching message files:', error);
      }
    } else {
      console.log('🔍 DEBUG: Skipping file processing - hasFiles:', hasFiles, 'userMessageRecord:', !!userMessageRecord);
    }
    
    console.log('🔍 DEBUG: Final fileContext length:', fileContext.length);
    if (fileContext.length > 0) {
      console.log('🔍 DEBUG: FileContext preview:', fileContext.substring(0, 200) + (fileContext.length > 200 ? '...' : ''));
    }

    try {
      // Get Claude's streaming response with management context
      // For topic conversations, use the topic title directly (especially important for "General")
      const contextualName = isTopicConversation ? topicTitle : person.name;
      const contextualRole = isTopicConversation ? 'Management Coach for Topic Discussion' : person.role;
      
      const finalMessage = userMessage + fileContext;
      console.log('🔍 DEBUG: Sending to Claude:', {
        originalMessage: userMessage,
        fileContextLength: fileContext.length,
        finalMessageLength: finalMessage.length,
        hasFileContent: fileContext.length > 0
      });
      
      if (fileContext.length > 0) {
        console.log('🔍 DEBUG: Message with file context preview:', finalMessage.substring(0, 500) + (finalMessage.length > 500 ? '...' : ''));
      }
      
      const stream = await getChatCompletionStreaming(
        finalMessage,
        contextualName,
        contextualRole,
        person.relationship_type,
        conversationHistory,
        managementContext,
        userProfile
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
                  is_user: false,
                  user_id: user.id
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
                  is_user: false,
                  user_id: user.id
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