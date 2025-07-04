import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@/types/database';
import type { ManagementContextData } from './management-context';
import { formatContextForPrompt } from './management-context';

const anthropic = new Anthropic({
 apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const SYSTEM_PROMPT = `You are Mano, an intelligent management assistant and helping hand for managers.

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

export const GENERAL_SYSTEM_PROMPT = `You are Mano, an intelligent one-on-one management assistant for strategic thinking and management challenges.

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

async function callClaudeWithRetry(
 systemPrompt: string,
 userMessage: string,
 maxRetries: number = 2
): Promise<string> {
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
     });

     const textContent = response.content.find(block => block.type === 'text');
     return textContent?.text || 'Sorry, I had trouble generating a response.';

   } catch (error: any) {
     console.error(`Claude API attempt ${attempt} failed:`, error);
     
     // If this is the last attempt, throw the error
     if (attempt === maxRetries + 1) {
       // Return different messages based on error type
       if (error.status === 429) {
         throw new Error('RATE_LIMIT');
       } else if (error.status >= 500) {
         throw new Error('SERVER_ERROR');
       } else if (error.status === 401) {
         throw new Error('AUTH_ERROR');
       } else {
         throw new Error('UNKNOWN_ERROR');
       }
     }
     
     // Wait before retrying (exponential backoff)
     await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
   }
 }
 
 throw new Error('UNKNOWN_ERROR');
}

interface UserProfile {
 call_name?: string | null;
 job_role?: string | null;
 company?: string | null;
}

function formatUserContext(profile?: UserProfile): string {
 if (!profile) return '';
 
 const parts = [];
 if (profile.call_name) {
   parts.push(`You are speaking with ${profile.call_name}`);
 }
 if (profile.job_role) {
   parts.push(`they work as a ${profile.job_role}`);
 }
 if (profile.company) {
   parts.push(`at ${profile.company}`);
 }
 
 return parts.length > 0 ? parts.join(', ') + '.' : '';
}

export async function getChatCompletion(
 userMessage: string,
 personName: string,
 personRole: string | null,
 relationshipType: string,
 conversationHistory: Message[],
 managementContext?: ManagementContextData,
 userProfile?: UserProfile
): Promise<string> {
 // Format conversation history
 const historyText = conversationHistory
   .slice(-10) // Only use last 10 messages for context
   .map(msg => `${msg.is_user ? 'Manager' : 'Mano'}: ${msg.content}`)
   .join('\n');

 // Format management context if available
 const contextText = managementContext ? formatContextForPrompt(managementContext) : '';

 let systemPrompt: string;
 
 // Use different system prompt for general assistant
 if (personName === 'General') {
   const userContextText = formatUserContext(userProfile);
   systemPrompt = GENERAL_SYSTEM_PROMPT
     .replace('{user_context}', userContextText || 'No user profile information available.')
     .replace('{management_context}', contextText || 'No additional team context available.')
     .replace('{conversation_history}', historyText || 'No previous conversation');
 } else {
   // Replace placeholders in person-specific system prompt
   systemPrompt = SYSTEM_PROMPT
     .replace('{name}', personName)
     .replace('{role}', personRole || 'No specific role')
     .replace('{relationship_type}', relationshipType)
     .replace('{management_context}', contextText || 'No additional team context available.')
     .replace('{conversation_history}', historyText || 'No previous conversation');
 }

 return await callClaudeWithRetry(systemPrompt, userMessage);
}

export async function getChatCompletionStreaming(
 userMessage: string,
 personName: string,
 personRole: string | null,
 relationshipType: string,
 conversationHistory: Message[],
 managementContext?: ManagementContextData,
 userProfile?: UserProfile
) {
 const historyText = conversationHistory
   .slice(-10)
   .map(msg => `${msg.is_user ? 'Manager' : 'Mano'}: ${msg.content}`)
   .join('\n');

 // Format management context if available
 const contextText = managementContext ? formatContextForPrompt(managementContext) : '';

 let systemPrompt: string;
 
 // Use different system prompt for general assistant
 if (personName === 'General') {
   const userContextText = formatUserContext(userProfile);
   systemPrompt = GENERAL_SYSTEM_PROMPT
     .replace('{user_context}', userContextText || 'No user profile information available.')
     .replace('{management_context}', contextText || 'No additional team context available.')
     .replace('{conversation_history}', historyText || 'No previous conversation');
 } else {
   systemPrompt = SYSTEM_PROMPT
     .replace('{name}', personName)
     .replace('{role}', personRole || 'No specific role')
     .replace('{relationship_type}', relationshipType)
     .replace('{management_context}', contextText || 'No additional team context available.')
     .replace('{conversation_history}', historyText || 'No previous conversation');
 }

 return anthropic.messages.stream({
   model: 'claude-sonnet-4-20250514',
   max_tokens: 1024,
   system: systemPrompt,
   messages: [
     {
       role: 'user',
       content: userMessage
     }
   ]
 });
}