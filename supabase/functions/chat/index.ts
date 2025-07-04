import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Anthropic } from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'
import { ManagementContextBuilder, formatContextForPrompt } from '../_shared/management-context.ts'
import { VectorService } from '../_shared/vector-service.ts'
import { buildEnhancedSystemPrompt } from '../_shared/prompt-engineering.ts'
import { OnboardingService } from '../_shared/onboarding-service.ts'
import { getOnboardingPrompt } from '../_shared/onboarding-prompts.ts'
import { detectNewPeopleWithContext } from '../_shared/context-aware-person-detection.ts'
import { analyzeProfileCompleteness, shouldPromptForCompletion } from '../_shared/profile-completeness.ts'
import { 
  getNextQuestion, 
  generateCompletionMessage,
  formatProfileUpdate,
  isCorrection,
  extractCorrection,
  type PersonProfile
} from '../_shared/profile-enhancement.ts'
import { extractProfileDataWithContext } from '../_shared/context-aware-profile-enhancement.ts'
import { LearningSystem } from '../_shared/learning-system.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatRequest {
  person_id: string;
  message: string;
}

interface PersonWelcomeRequest {
  action: 'generate_person_welcome';
  name: string;
  role: string | null;
  relationship_type: string;
}

interface TopicWelcomeRequest {
  action: 'generate_topic_welcome';
  title: string;
  participants: string[];
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

Coaching Approach for People Conversations:
- Start with understanding before advising: "Tell me more about your relationship with {name}..."
- Use reflective questions to deepen insight:
  • "What do you think {name} needs most from you right now?"
  • "How might {name} perceive this situation differently?"
  • "What would a great relationship with {name} look like?"
- Help identify relationship patterns: "I've noticed in our conversations about {name} that..."
- Encourage empathy and perspective-taking before problem-solving
- When discussing conflicts, explore both sides before suggesting approaches

First Conversation Protocol - When this is the first message about a new person:
1. Process their quick setup answers (role, relationship, current situation)
2. Acknowledge what you've learned concisely
3. Provide ONE immediately actionable insight based on their current situation
4. Suggest a specific next step they could take this week
5. Ask what specific support they need for their upcoming interactions
6. Keep it focused and valuable - this should feel like instant ROI

Example response pattern:
"Thanks for that context! So {name} is a {role} who {relationship to user}, currently {situation summary}.

Based on what you've shared, here's something to consider: [specific insight related to their situation]

**Immediate action**: [One concrete thing they could do in the next few days]

What's your next interaction with {name} likely to be? I can help you prepare for it."

Context about the person being discussed:
Name: {name}
Role: {role}
Relationship: {relationship_type}

{management_context}

Previous conversation history:
{conversation_history}

Important: When discussing broader topics that extend beyond this individual:
- If the conversation shifts to team-wide challenges, projects, or initiatives, naturally suggest: "This sounds like it affects more than just {name}. Would you like to create a Topic for [topic name] to explore this more broadly?"
- Examples: team morale issues, cross-functional projects, process improvements, strategic initiatives

Respond in a helpful, professional tone. Focus on actionable advice and insights that will help the manager build better relationships with their team. When relevant team context adds value, reference it naturally in your response. Use hand emojis occasionally to reinforce the "helping hand" theme, but don't overdo it.`;

const GENERAL_SYSTEM_PROMPT = `You are Mano, an intelligent one-on-one management assistant for strategic thinking and management challenges.

{user_context}

Help with:
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

Coaching Approach - Balance questions with advice:
- When someone presents a challenge, often start with 1-2 thoughtful questions before jumping to solutions
- Use powerful coaching questions like:
  • "What's the real challenge here for you?"
  • "What would success look like in this situation?"
  • "What options have you considered?"
  • "What's holding you back from taking action?"
  • "How do you think [person] might be experiencing this?"
- Know when to switch from questions to advice:
  • When they explicitly ask "What should I do?"
  • When they've explored options and need frameworks
  • When facing urgent situations or crises
  • When they lack experience with a specific scenario
- Help users discover patterns: "I notice this is the third time we've discussed similar conflicts with your team. What pattern do you see?"
- Validate their insights: "That's a powerful realization about..."

Important: Proactively suggest organizing conversations when beneficial:
- When the user mentions specific people repeatedly, suggest: "Would you like to create a dedicated space for [Person's name]? This helps me track your interactions and provide more personalized advice."
- When discussing ongoing projects or recurring challenges, suggest: "This sounds like an important ongoing topic. Would you like to create a dedicated Topic for [topic name] to track progress and insights?"
- Be natural about these suggestions - only make them when it genuinely adds value to the conversation

Management Context: {management_context}

Previous Conversation: {conversation_history}

Respond in a warm, professional tone as a trusted management coach. Keep responses focused, practical, and actionable. Address the user by their preferred name when appropriate.`;

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

    // Parse request body
    const requestBody = await req.json()

    // Handle person welcome message generation
    if (requestBody.action === 'generate_person_welcome') {
      const { name, role, relationship_type }: PersonWelcomeRequest = requestBody

      if (!name || !relationship_type) {
        return new Response(JSON.stringify({ error: 'name and relationship_type are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      try {
        // Build management context for welcome message
        const contextBuilder = new ManagementContextBuilder(supabase, user.id)
        const { context: managementContext } = await contextBuilder.buildFullContext(
          'temp', 
          '', 
          false
        )

        const roleDescription = role ? `${role}` : 'team member'
        const teamSize = managementContext.people.length
        const existingRoles = [...new Set(managementContext.people.map(p => p.role).filter(Boolean))]
        const recentChallenges = managementContext.recent_themes.slice(0, 3)
        const teamDynamics = managementContext.team_dynamics || []
        const crossPersonInsights = managementContext.semantic_context?.cross_person_insights || []
        const similarRoles = managementContext.people.filter(p => p.role === role)

        // Build dynamic context based on existing team patterns
        let contextualInsights = []
        if (similarRoles.length > 0) {
          contextualInsights.push(`Similar role: You already work with ${similarRoles.map(p => p.name).join(', ')} in ${role} roles`)
        }
        if (crossPersonInsights.length > 0) {
          contextualInsights.push(`Team patterns: ${crossPersonInsights.slice(0, 2).join(', ')}`)
        }
        if (teamDynamics.length > 0) {
          contextualInsights.push(`Current dynamics: ${teamDynamics.slice(0, 2).join(', ')}`)
        }

        const prompt = `You are Mano, an intelligent management assistant. A manager has just added a new person profile to track their relationship and you need to create a helpful message for the MANAGER about this person.

**Person Being Added:**
- Name: ${name}
- Role: ${roleDescription}
- Relationship to manager: ${relationship_type}

**Manager's Current Context:**
- Team size: ${teamSize} people  
- Existing roles: ${existingRoles.join(', ') || 'First team member'}
- Recent management challenges: ${recentChallenges.join(', ') || 'Building team foundation'}
- Contextual insights: ${contextualInsights.join(' • ') || 'Fresh start with team building'}

**IMPORTANT:** This message is FOR the manager, ABOUT ${name}. Address the manager directly, not ${name}.

**Dynamic Instructions:**
Create a contextual, personalized message (100-150 words) that:

1. **References specific team context** - mention similar roles, patterns, or dynamics when relevant
2. **Acknowledges ${name}'s unique position** in their current team structure  
3. **Asks ONE highly relevant question** based on the team context and relationship type
4. **Provides actionable insight** tailored to their specific management situation
5. **Uses natural, conversational language** that feels personally generated

**Relationship-specific focus:**
- direct_report: Development opportunities, performance patterns, career growth in context of existing team
- manager: Communication strategies, managing up effectively, alignment with their leadership style
- peer: Collaboration opportunities, shared challenges, mutual support based on team dynamics  
- stakeholder: Project alignment, communication cadence, success metrics relevant to current context

Use 🤲 once naturally. Generate only the message content - make it feel like intelligent, contextual advice tailored to their specific situation.`

        console.log('🤖 Generating AI welcome message for:', name)
        console.log('🤖 ANTHROPIC_API_KEY available:', !!Deno.env.get('ANTHROPIC_API_KEY'))
        console.log('🤖 ANTHROPIC_API_KEY length:', Deno.env.get('ANTHROPIC_API_KEY')?.length || 0)
        console.log('🤖 ANTHROPIC_API_KEY starts with:', Deno.env.get('ANTHROPIC_API_KEY')?.substring(0, 10) || 'null')
        console.log('🤖 All environment variables available:', Object.keys(Deno.env.toObject()).sort())
        
        // Robust AI generation with retry logic - NO hardcoded fallbacks
        let welcomeMessage = ''
        const maxRetries = 3
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 300,
              system: prompt,
              messages: [
                {
                  role: 'user',
                  content: `Create the welcome message for ${name}.`
                }
              ]
            })

            const textContent = response.content.find(block => block.type === 'text')
            if (textContent?.text) {
              welcomeMessage = textContent.text
              break
            }
          } catch (retryError) {
            console.error(`AI generation attempt ${attempt} failed:`, retryError)
            if (attempt === maxRetries) {
              throw new Error('AI generation failed after multiple attempts')
            }
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
          }
        }

        if (!welcomeMessage) {
          throw new Error('AI failed to generate welcome message')
        }
        
        console.log('🤖 Generated welcome message:', welcomeMessage.substring(0, 100) + '...')
        
        return new Response(JSON.stringify({ welcomeMessage }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      } catch (error) {
        console.error('Error generating person welcome message:', error)
        // Return error - let the API layer handle fallback logic
        return new Response(JSON.stringify({ error: 'Failed to generate AI welcome message' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Handle topic welcome message generation
    if (requestBody.action === 'generate_topic_welcome') {
      const { title, participants }: TopicWelcomeRequest = requestBody

      if (!title) {
        return new Response(JSON.stringify({ error: 'title is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      try {
        // Build management context for topic welcome message
        const contextBuilder = new ManagementContextBuilder(supabase, user.id)
        const { context: managementContext } = await contextBuilder.buildFullContext(
          'general', 
          '', 
          true // Include proactive insights for topics
        )

        // Get participant names if any
        const participantNames: string[] = []
        if (participants.length > 0) {
          const { data: people } = await supabase
            .from('people')
            .select('name')
            .in('id', participants)
            .eq('user_id', user.id)
          
          if (people) {
            participantNames.push(...people.map(p => p.name))
          }
        }

        const teamSize = managementContext.people.length
        const recentChallenges = managementContext.recent_themes.slice(0, 3)
        const crossConversationInsights = managementContext.semantic_context?.cross_person_insights || []
        const teamDynamics = managementContext.team_dynamics || []

        // Build contextual insights for topic
        let topicInsights = []
        if (crossConversationInsights.length > 0) {
          topicInsights.push(`Team insights: ${crossConversationInsights.slice(0, 2).join(', ')}`)
        }
        if (teamDynamics.length > 0) {
          topicInsights.push(`Current dynamics: ${teamDynamics.slice(0, 2).join(', ')}`)
        }

        const prompt = `You are Mano, an intelligent management assistant. A manager has just created a new topic for strategic discussion and you need to create a helpful welcome message for the MANAGER about this topic.

**Topic Details:**
- Title: "${title}"
- Participants: ${participantNames.length > 0 ? participantNames.join(', ') : 'No specific participants yet'}

**Manager's Current Context:**
- Team size: ${teamSize} people
- Recent management challenges: ${recentChallenges.join(', ') || 'Building team foundation'}
- Cross-conversation insights: ${crossConversationInsights.slice(0, 3).join(', ') || 'Fresh strategic focus'}
- Team dynamics: ${topicInsights.join(' • ') || 'Establishing new processes'}

**Dynamic Instructions:**
Create a strategic, contextual welcome message (120-180 words) that:

1. **Acknowledges the topic** and its strategic importance in their current context
2. **References specific team dynamics** or challenges when relevant
3. **Suggests 2-3 specific discussion frameworks** or approaches tailored to this topic type
4. **Connects to broader team context** if participants are specified
5. **Asks ONE strategic question** to get productive discussion started

**Topic-type specific guidance:**
- If topic sounds like a project: Focus on deliverables, stakeholders, timeline frameworks
- If topic sounds like team-related: Focus on dynamics, communication, development strategies
- If topic sounds like strategy: Focus on decision-making frameworks, outcomes, measurement
- If topic sounds like performance: Focus on goals, feedback systems, development plans

Use 🤲 once naturally. Generate only the message content - make it feel like intelligent strategic guidance tailored to their specific management context and this topic's unique requirements.`

        console.log('🤖 Generating AI topic welcome message for:', title)
        
        // Robust AI generation with retry logic - NO hardcoded fallbacks
        let welcomeMessage = ''
        const maxRetries = 3
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 350,
              system: prompt,
              messages: [
                {
                  role: 'user',
                  content: `Create the welcome message for the topic "${title}".`
                }
              ]
            })

            const textContent = response.content.find(block => block.type === 'text')
            if (textContent?.text) {
              welcomeMessage = textContent.text
              break
            }
          } catch (retryError) {
            console.error(`AI topic generation attempt ${attempt} failed:`, retryError)
            if (attempt === maxRetries) {
              throw new Error('AI topic generation failed after multiple attempts')
            }
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
          }
        }

        if (!welcomeMessage) {
          throw new Error('AI failed to generate topic welcome message')
        }
        
        console.log('🤖 Generated topic welcome message:', welcomeMessage.substring(0, 100) + '...')
        
        return new Response(JSON.stringify({ welcomeMessage }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      } catch (error) {
        console.error('Error generating topic welcome message:', error)
        // Return error - let the API layer handle fallback logic
        return new Response(JSON.stringify({ error: 'Failed to generate AI topic welcome message' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Handle regular chat requests
    const { person_id, message: userMessage }: ChatRequest = requestBody

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
    const { context: managementContext, enhancement } = await contextBuilder.buildFullContext(
      person_id, 
      userMessage, 
      person_id === 'general' // Include proactive insights for general conversations
    )
    const contextBuildTime = Date.now() - startTime

    console.log(`Context building took ${contextBuildTime}ms for user ${user.id}`)
    console.log(`Context includes ${managementContext.people.length} people, ${managementContext.recent_themes.length} themes`)
    if (managementContext.semantic_context) {
      console.log(`Semantic context: ${managementContext.semantic_context.similar_conversations.length} similar conversations, ${managementContext.semantic_context.cross_person_insights.length} cross-person insights`)
    }
    if (enhancement) {
      console.log(`Conversational intelligence: ${enhancement.memories.length} memories, ${enhancement.followUps.length} follow-ups, ${enhancement.insights.length} insights`)
    }

    // Check if user is responding to a profile prompt and process with context
    let profileUpdateResult = null;
    if (person_id !== 'general') {
      try {
        // Check if this might be a profile response by looking at recent conversation
        const recentMessages = conversationHistory.slice(-3); // Last 3 messages for context
        const lastAssistantMessage = recentMessages.filter(m => !m.is_user).pop();
        
        if (lastAssistantMessage && 
           (lastAssistantMessage.content.includes("What's") || 
            lastAssistantMessage.content.includes("Tell me") || 
            lastAssistantMessage.content.includes("role") ||
            lastAssistantMessage.content.includes("location") ||
            lastAssistantMessage.content.includes("company") ||
            lastAssistantMessage.content.includes("relationship"))) {
          
          console.log('🔍 Potential profile response detected, using context-aware extraction');
          
          // Determine what field was being asked about
          const currentField = getCurrentProfileField(conversationHistory);
          const personName = person.name;
          
          // Use context-aware profile extraction
          const extractionResult = await extractProfileDataWithContext(
            userMessage,
            currentField,
            personName,
            person_id,
            user.id,
            supabase,
            Deno.env.get('ANTHROPIC_API_KEY')!
          );
          
          console.log('🔍 Context-aware profile extraction result:', {
            field: currentField,
            extracted: extractionResult.extractedValue,
            confidence: extractionResult.confidence,
            teamMatches: extractionResult.teamPatternMatches.length,
            insights: extractionResult.contextualInsights.length
          });
          
          // Update person profile if we extracted something valuable
          if (extractionResult.extractedValue && extractionResult.confidence > 0.6) {
            const updateData: any = {};
            
            // Map field to database column
            const fieldMapping: Record<string, string> = {
              'role': 'role',
              'company': 'team',
              'team': 'team',
              'relationship': 'relationship_type',
              'location': 'location',
              'notes': 'notes'
            };
            
            const dbField = fieldMapping[currentField];
            if (dbField) {
              updateData[dbField] = extractionResult.extractedValue;
              
              // Also update any additional fields that were extracted
              extractionResult.additionalFields.forEach(field => {
                const additionalDbField = fieldMapping[field.field];
                if (additionalDbField && field.confidence > 0.7) {
                  updateData[additionalDbField] = field.value;
                }
              });
              
              // Update the person record
              const { data: updatedPerson } = await supabase
                .from('people')
                .update(updateData)
                .eq('id', person_id)
                .eq('user_id', user.id)
                .select()
                .single();
              
              if (updatedPerson) {
                profileUpdateResult = {
                  field: currentField,
                  value: extractionResult.extractedValue,
                  confidence: extractionResult.confidence,
                  teamMatches: extractionResult.teamPatternMatches,
                  insights: extractionResult.contextualInsights
                };
                
                console.log('🔍 Profile updated successfully:', updateData);
              }
            }
          }
        }
      } catch (profileError) {
        console.error('Context-aware profile enhancement failed:', profileError);
        // Don't fail the whole request if profile enhancement fails
      }
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

    // Process conversation for learning patterns (background task)
    const learningSystem = new LearningSystem(supabase, user.id, Deno.env.get('ANTHROPIC_API_KEY')!)
    learningSystem.processConversationForLearning(
      conversationHistory,
      person_id,
      managementContext
    ).catch(console.error)

    // Detect new people mentioned in the user message with full context
    let personDetection = null
    try {
      // Get existing people names
      const { data: existingPeople } = await supabase
        .from('people')
        .select('name')
        .eq('user_id', user.id)
      
      const existingNames = existingPeople?.map(p => p.name) || []
      
      // Use context-aware person detection with full management context
      const detectionResult = await detectNewPeopleWithContext(
        userMessage, 
        existingNames, 
        managementContext,
        Deno.env.get('ANTHROPIC_API_KEY')!
      )
      
      if (detectionResult.hasNewPeople) {
        personDetection = detectionResult
        console.log(`Context-aware person detection found ${detectionResult.detectedPeople.length} people (context used: ${detectionResult.contextUsed})`)
      }
    } catch (detectionError) {
      console.error('Context-aware person detection failed:', detectionError)
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

    if (profileUpdateResult) {
      responseData.profileUpdateResult = profileUpdateResult;
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