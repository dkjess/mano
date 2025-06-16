import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Anthropic } from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'
import { ManagementContextBuilder, formatContextForPrompt } from '../_shared/management-context.ts'

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
}

// System prompts - copied from lib/claude.ts
const SYSTEM_PROMPT = `You are Mano, an intelligent management assistant and helping hand for managers.

Your role is to:
- Provide thoughtful management advice based on conversation history
- Suggest conversation starters and topics for 1-1s
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request
    const { person_id, message: userMessage }: ChatRequest = await req.json()

    if (!person_id || !userMessage) {
      return new Response(JSON.stringify({ error: 'person_id and message are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
    const userMessageRecord = await createMessage({
      person_id,
      content: userMessage,
      is_user: true
    }, supabase)

    // Build enhanced management context
    const startTime = Date.now()
    const contextBuilder = new ManagementContextBuilder(supabase, user.id)
    const managementContext = await contextBuilder.buildFullContext(person_id)
    const contextBuildTime = Date.now() - startTime

    console.log(`Context building took ${contextBuildTime}ms for user ${user.id}`)
    console.log(`Context includes ${managementContext.people.length} people, ${managementContext.recent_themes.length} themes`)

    // Format conversation history
    const historyText = conversationHistory
      .slice(-10) // Only use last 10 messages for context
      .map((msg: Message) => `${msg.is_user ? 'Manager' : 'Mano'}: ${msg.content}`)
      .join('\n')

    // Choose base system prompt and enhance with management context
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

    // Enhance system prompt with management context
    const enhancedContext = formatContextForPrompt(managementContext, person_id)
    const systemPrompt = baseSystemPrompt.replace('{management_context}', enhancedContext)

    // Call Claude API with retry logic
    let claudeResponse: string
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
      is_user: false
    }, supabase)

    // Return response in same format as current client
    return new Response(JSON.stringify({
      userMessage: userMessageRecord,
      assistantMessage,
      shouldRetry: claudeResponse.includes('🤚') || claudeResponse.includes('🤷') || claudeResponse.includes('🤔')
    }), {
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