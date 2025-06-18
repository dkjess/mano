import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Anthropic } from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'
import { ManagementContextBuilder, formatContextForPrompt } from '../_shared/management-context.ts'
import { VectorService } from '../_shared/vector-service.ts'
import { buildEnhancedSystemPrompt } from '../_shared/prompt-engineering.ts'
import { OnboardingService } from '../_shared/onboarding-service.ts'
import { getOnboardingPrompt } from '../_shared/onboarding-prompts.ts'
import { detectNewPeopleInMessage } from '../_shared/enhanced-person-detection-safe.ts'
import { analyzeProfileCompleteness, shouldPromptForCompletion } from '../_shared/profile-completeness.ts'
import { 
  extractProfileData, 
  getNextQuestion, 
  generateCompletionMessage,
  formatProfileUpdate,
  isCorrection,
  extractCorrection,
  type PersonProfile
} from '../_shared/profile-enhancement.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatRequest {
  person_id: string;
  message: string;
}

interface Message {
  id: string;
  person_id: string;
  content: string;
  is_user: boolean;
  created_at: string;
}

interface Person {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  relationship_type: string;
  created_at: string;
  updated_at: string;
  team?: string | null;
  location?: string | null;
  notes?: string | null;
  communication_style?: string | null;
  goals?: string | null;
  strengths?: string | null;
  challenges?: string | null;
}

// System prompts - copied from lib/claude.ts
const SYSTEM_PROMPT = `You are Mano, an intelligent management assistant and helping hand for managers.

Your role is to:
- Provide thoughtful management advice based on conversation history
- Suggest conversation starters and topics for one-on-ones
- Help managers track important information about their people
- Offer insights about team dynamics and individual needs
- Be supportive but practical in your guidance

You are the manager's helping hand - supportive, intelligent, and focused on making them more effective in their leadership role.

Context about the person being discussed:
Name: {name}
Role: {role}
Relationship: {relationship_type}

{management_context}

Previous conversation history:
{conversation_history}

Respond in a helpful, professional tone. Focus on actionable advice and insights that will help the manager build better relationships with their team. When relevant team context adds value, reference it naturally in your response. Use hand emojis occasionally to reinforce the "helping hand" theme, but don't overdo it.`;

const GENERAL_SYSTEM_PROMPT = `You are Mano, an intelligent one-on-one management assistant for strategic thinking and management challenges. Help with:

• Strategic planning and decision-making frameworks
• Team leadership and development strategies  
• Communication and stakeholder management
• Process improvement and operational excellence
• Performance management and feedback techniques
• Conflict resolution and difficult conversations
• Career coaching and development planning
• Meeting effectiveness and time management
• Change management and organizational dynamics
• Hiring, onboarding, and team building

You excel at:
- Asking clarifying questions to understand context
- Offering frameworks and structured approaches
- Providing specific, actionable advice
- Helping break down complex challenges
- Suggesting conversation starters and scripts
- Drawing connections between different management challenges

Management Context: {management_context}

Previous Conversation: {conversation_history}

Respond in a warm, professional tone as a trusted management coach. Keep responses focused, practical, and actionable.`;

const PROFILE_SETUP_PROMPT = `You are Mano, helping a manager set up a team member's profile through natural conversation.

Your role in profile setup:
- Ask one question at a time to gather profile information
- Extract structured data from natural language responses  
- Provide confirmations when information is updated
- Guide the conversation toward completion
- Be conversational and helpful, not robotic

Current person: {name}
Profile completion status: {completion_status}
Next question to ask: {next_question}

Previous conversation:
{conversation_history}

If the user provides profile information, acknowledge it and ask the next logical question. If they want to skip or finish, respect that choice. Keep the tone friendly and conversational.`;

// Database functions - simplified versions for edge function
async function getMessages(personId: string, supabase: any): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('person_id', personId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function createMessage(
  messageData: {
    person_id: string;
    content: string;
    is_user: boolean;
    user_id: string;
  },
  supabase: any
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Check if this is a profile setup conversation
function isProfileSetupConversation(messages: Message[]): boolean {
  if (messages.length === 0) return false;
  
  // Check if the first system message is about profile setup
  const firstMessage = messages[0];
  return !firstMessage.is_user && (
    firstMessage.content.includes("Let's set up their profile") ||
    firstMessage.content.includes("What's") && firstMessage.content.includes("role")
  );
}

// Determine the current field being asked about in profile setup
function getCurrentProfileField(messages: Message[]): string {
  const lastAssistantMessage = messages
    .filter(m => !m.is_user)
    .pop();
    
  if (!lastAssistantMessage) return 'role';
  
  const content = lastAssistantMessage.content.toLowerCase();
  
  if (content.includes('role') || content.includes('job') || content.includes('title')) {
    return 'role';
  } else if (content.includes('company') || content.includes('team')) {
    return 'company';
  } else if (content.includes('relationship') || content.includes('know')) {
    return 'relationship';
  } else if (content.includes('location') || content.includes('based')) {
    return 'location';
  } else if (content.includes('details') || content.includes('remember')) {
    return 'notes';
  }
  
  return 'role'; // Default
}

// Update person profile with extracted data
async function updatePersonProfile(
  personId: string, 
  extractedData: any, 
  supabase: any
): Promise<Person> {
  const updateData: any = {};
  
  // Map extracted fields to database columns
  const fieldMapping: Record<string, string> = {
    'role': 'role',
    'company': 'team',
    'team': 'team',
    'relationship': 'relationship_type',
    'relationship_type': 'relationship_type',
    'location': 'location',
    'notes': 'notes',
    'communication_style': 'communication_style',
    'goals': 'goals',
    'strengths': 'strengths',
    'challenges': 'challenges'
  };
  
  // Primary field
  if (extractedData.primaryField && extractedData.extractedValue) {
    const dbField = fieldMapping[extractedData.primaryField];
    if (dbField) {
      updateData[dbField] = extractedData.extractedValue;
    }
  }
  
  // Additional fields
  if (extractedData.additionalFields) {
    for (const field of extractedData.additionalFields) {
      const dbField = fieldMapping[field.field];
      if (dbField && field.value) {
        updateData[dbField] = field.value;
      }
    }
  }
  
  if (Object.keys(updateData).length === 0) {
    // No updates to make, just return current person
    const { data } = await supabase
      .from('people')
      .select('*')
      .eq('id', personId)
      .single();
    return data;
  }
  
  const { data, error } = await supabase
    .from('people')
    .update(updateData)
    .eq('id', personId)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
    })

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error in edge function:', authError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    console.log('Edge function auth context:', {
      user_id: user.id,
      user_email: user.email,
      auth_header_present: !!req.headers.get('Authorization')
    })

    // Parse request
    const { person_id, message: userMessage }: ChatRequest = await req.json()

    if (!person_id || !userMessage) {
      return new Response(JSON.stringify({ error: 'person_id and message are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Initialize onboarding service
    const onboardingService = new OnboardingService(supabase)
    const onboardingContext = await onboardingService.getOnboardingContext(user.id)

    // Handle onboarding logic
    if (onboardingContext.isNewUser || !onboardingContext.hasPreferredName) {
      // Extract name from message if user is providing it
      if (!onboardingContext.hasPreferredName) {
        const extractedName = onboardingService.extractNameFromMessage(userMessage)
        if (extractedName) {
          await onboardingService.updatePreferredName(user.id, extractedName)
          onboardingContext.hasPreferredName = true
        }
      }

      // Auto-create team members mentioned in conversation
      const teamMentions = onboardingService.detectTeamMemberMention(userMessage)
      for (const mention of teamMentions) {
        try {
          await supabase.from('people').insert({
            user_id: user.id,
            name: mention.name,
            role: mention.role || null,
            relationship_type: mention.relationship || 'direct_report'
          })
        } catch (error) {
          // Ignore duplicate entries
          console.log(`Person ${mention.name} might already exist`)
        }
      }

      // Update onboarding step if needed
      if (teamMentions.length > 0 && onboardingContext.currentStep === 'welcome') {
        await onboardingService.updateOnboardingStep(user.id, 'team_building')
      }
    }

    // Check if onboarding should be completed
    if (!onboardingContext.isNewUser && await onboardingService.shouldCompleteOnboarding(user.id)) {
      await onboardingService.completeOnboarding(user.id)
      onboardingContext.isNewUser = false
    }

    // Get person details (or handle 'general' case)
    let person: Person
    if (person_id === 'general') {
      person = {
        id: 'general',
        user_id: user.id,
        name: 'general',
        role: 'Management Assistant',
        relationship_type: 'assistant',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    } else {
      const { data: personData, error: personError } = await supabase
        .from('people')
        .select('*')
        .eq('id', person_id)
        .eq('user_id', user.id)
        .single()

      if (personError || !personData) {
        return new Response(JSON.stringify({ error: 'Person not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      person = personData
    }

    // Get conversation history
    const conversationHistory = await getMessages(person_id, supabase)

    // Save user message
    console.log('Attempting to create message with data:', {
      person_id,
      content: userMessage.substring(0, 50) + '...',
      is_user: true,
      user_id: user.id,
      auth_uid: user.id
    })
    
    let userMessageRecord;
    try {
      userMessageRecord = await createMessage({
        person_id,
        content: userMessage,
        is_user: true,
        user_id: user.id
      }, supabase)
      console.log('Message created successfully:', userMessageRecord.id)
    } catch (messageError) {
      console.error('Failed to create user message:', messageError)
      console.log('Debug info - User ID:', user.id)
      console.log('Debug info - Person ID:', person_id)
      console.log('Debug info - Auth UID from context:', user.id)
      
      // Try to check if the user can access their people
      try {
        const { data: userPeople, error: peopleError } = await supabase
          .from('people')
          .select('id, name')
          .eq('user_id', user.id)
        console.log('User people check:', { userPeople, peopleError })
      } catch (peopleCheckError) {
        console.log('People check failed:', peopleCheckError)
      }
      
      // Check auth context directly
      try {
        const { data: authCheck } = await supabase.rpc('auth.uid')
        console.log('Direct auth.uid() check:', authCheck)
      } catch (authCheckError) {
        console.log('Auth check failed:', authCheckError)
      }
      
      // Try a simple test insert to see the exact error
      try {
        const { data: testInsert, error: testError } = await supabase
          .from('messages')
          .insert({
            person_id: 'general',
            content: 'Test message',
            is_user: true,
            user_id: user.id
          })
          .select()
        console.log('Test insert result:', { testInsert, testError })
      } catch (testInsertError) {
        console.log('Test insert failed:', testInsertError)
      }
      
      throw messageError
    }

    // Build enhanced management context with conversational intelligence
    const startTime = Date.now()
    const contextBuilder = new ManagementContextBuilder(supabase, user.id)
    const { context: managementContext, enhancement } = await contextBuilder.buildFullContext(person_id, userMessage)
    const contextBuildTime = Date.now() - startTime

    console.log(`Context building took ${contextBuildTime}ms for user ${user.id}`)
    console.log(`Context includes ${managementContext.people.length} people, ${managementContext.recent_themes.length} themes`)
    if (managementContext.semantic_context) {
      console.log(`Semantic context: ${managementContext.semantic_context.similar_conversations.length} similar conversations, ${managementContext.semantic_context.cross_person_insights.length} cross-person insights`)
    }
    if (enhancement) {
      console.log(`Conversational intelligence: ${enhancement.memories.length} memories, ${enhancement.followUps.length} follow-ups, ${enhancement.insights.length} insights`)
    }

    // Format conversation history
    const historyText = conversationHistory
      .slice(-10) // Only use last 10 messages for context
      .map((msg: Message) => `${msg.is_user ? 'Manager' : 'Mano'}: ${msg.content}`)
      .join('\n')

    // Check if profile completion should be prompted
    let profilePrompt = null
    if (person_id !== 'general') {
      try {
        // Get person details with profile fields
        const { data: personData } = await supabase
          .from('people')
          .select('*')
          .eq('id', person_id)
          .eq('user_id', user.id)
          .single();

        if (personData) {
          // Get conversation count
          const { count: conversationCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('person_id', person_id)
            .eq('is_user', true);

          // Analyze if we should prompt for profile completion
          const completeness = analyzeProfileCompleteness(personData);
          const shouldPrompt = shouldPromptForCompletion(
            personData,
            conversationCount || 0,
            personData.last_profile_prompt
          );

          if (shouldPrompt && completeness.suggestions.length > 0) {
            profilePrompt = completeness.suggestions[0];
            
            // Update last prompt date
            await supabase
              .from('people')
              .update({ last_profile_prompt: new Date().toISOString() })
              .eq('id', person_id);
          }
        }
      } catch (error) {
        console.error('Profile completion check failed:', error);
      }
    }

    // Choose system prompt based on onboarding state
    let systemPrompt: string
    
    if (onboardingContext.isNewUser || !onboardingContext.hasPreferredName) {
      // Use onboarding prompt
      const userProfile = await onboardingService.getUserProfile(user.id)
      systemPrompt = getOnboardingPrompt(
        onboardingContext.currentStep,
        userProfile?.preferred_name || undefined
      )
    } else {
      // Use enhanced system prompt with conversational intelligence
      if (enhancement) {
        // Use conversational intelligence to enhance the prompt
        let baseSystemPrompt: string
        if (person.name === 'general') {
          baseSystemPrompt = GENERAL_SYSTEM_PROMPT
            .replace('{conversation_history}', historyText || 'No previous conversation')
        } else {
          baseSystemPrompt = SYSTEM_PROMPT
            .replace('{name}', person.name)
            .replace('{role}', person.role || 'No specific role')
            .replace('{relationship_type}', person.relationship_type)
            .replace('{conversation_history}', historyText || 'No previous conversation')
        }

        const enhancedContext = formatContextForPrompt(managementContext, person_id, userMessage)
        const basePromptWithContext = baseSystemPrompt.replace('{management_context}', enhancedContext)

        systemPrompt = buildEnhancedSystemPrompt(
          basePromptWithContext,
          managementContext,
          enhancement,
          person_id
        )
      } else {
        // Fallback to basic enhanced context
        let baseSystemPrompt: string
        if (person.name === 'general') {
          baseSystemPrompt = GENERAL_SYSTEM_PROMPT
            .replace('{conversation_history}', historyText || 'No previous conversation')
        } else {
          baseSystemPrompt = SYSTEM_PROMPT
            .replace('{name}', person.name)
            .replace('{role}', person.role || 'No specific role')
            .replace('{relationship_type}', person.relationship_type)
            .replace('{conversation_history}', historyText || 'No previous conversation')
        }

        const enhancedContext = formatContextForPrompt(managementContext, person_id, userMessage)
        systemPrompt = baseSystemPrompt.replace('{management_context}', enhancedContext)
      }
    }

    // Modify system prompt to include profile completion prompt if needed
    if (profilePrompt) {
      const profilePromptText = `

PROFILE COMPLETION PROMPT:
After providing your main response, gently ask: "${profilePrompt.prompt}"

This will help you give better, more personalized advice in future conversations. Keep the prompt natural and conversational - don't make it feel like a form to fill out.`;

      systemPrompt = `${systemPrompt}${profilePromptText}`;
    }

    // Call Claude API with retry logic
    let claudeResponse: string = 'Sorry, I had trouble generating a response.'
    const maxRetries = 2

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userMessage
            }
          ]
        })

        const textContent = response.content.find(block => block.type === 'text')
        claudeResponse = textContent?.text || 'Sorry, I had trouble generating a response.'
        break

      } catch (error: any) {
        console.error(`Claude API attempt ${attempt} failed:`, error)
        
        if (attempt === maxRetries + 1) {
          // Return user-friendly error message
          if (error.status === 429) {
            claudeResponse = '🤚 I\'m getting too many requests right now. Let\'s try again in a moment!'
          } else if (error.status >= 500) {
            claudeResponse = '🤷 I\'m having some technical difficulties. Mind trying that again?'
          } else if (error.status === 401) {
            claudeResponse = '🔑 There\'s an authentication issue with my AI service. Please contact support.'
          } else {
            claudeResponse = '🤔 Something went wrong on my end. Would you like to try sending that message again?'
          }
        } else {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        }
      }
    }

    // Save Claude's response
    const assistantMessage = await createMessage({
      person_id,
      content: claudeResponse,
      is_user: false,
      user_id: user.id
    }, supabase)

    // Store embeddings for both messages (don't await - background task)
    const vectorService = new VectorService(supabase)
    
    vectorService.storeMessageEmbedding(
      user.id,
      person_id,
      userMessageRecord.id,
      userMessage,
      'user'
    ).catch(console.error)
    
    vectorService.storeMessageEmbedding(
      user.id,
      person_id,
      assistantMessage.id,
      claudeResponse,
      'assistant'
    ).catch(console.error)

    // Detect new people mentioned in the user message
    let personDetection = null
    try {
      // Get existing people names
      const { data: existingPeople } = await supabase
        .from('people')
        .select('name')
        .eq('user_id', user.id)
      
      const existingNames = existingPeople?.map(p => p.name) || []
      
      // Detect new people in the message
      const detectionResult = await detectNewPeopleInMessage(userMessage, existingNames)
      
      if (detectionResult.hasNewPeople) {
        personDetection = detectionResult
      }
    } catch (detectionError) {
      console.error('Person detection failed:', detectionError)
      // Don't fail the whole request if detection fails
    }

    // Return response with person detection and profile completion results
    const responseData: any = {
      userMessage: userMessageRecord,
      assistantMessage,
      personDetection,
      shouldRetry: claudeResponse.includes('🤚') || claudeResponse.includes('🤷') || claudeResponse.includes('🤔')
    };

    if (profilePrompt) {
      responseData.profilePrompt = {
        field: profilePrompt.field,
        prompt: profilePrompt.prompt,
        examples: profilePrompt.examples
      };
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in chat function:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}) 