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

Context about the person being discussed:
Name: {name}
Role: {role}
Relationship: {relationship_type}

{management_context}

Previous conversation history:
{conversation_history}

Respond in a helpful, professional tone. Focus on actionable advice and insights that will help the manager build better relationships with their team. When relevant team context adds value, reference it naturally in your response. Use hand emojis occasionally to reinforce the "helping hand" theme, but don't overdo it.`;

export const GENERAL_SYSTEM_PROMPT = `You are Mano, an intelligent one-on-one management assistant for strategic thinking and management challenges. Help with:

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

export async function getChatCompletion(
 userMessage: string,
 personName: string,
 personRole: string | null,
 relationshipType: string,
 conversationHistory: Message[],
 managementContext?: ManagementContextData
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
   systemPrompt = GENERAL_SYSTEM_PROMPT
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
 managementContext?: ManagementContextData
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
   systemPrompt = GENERAL_SYSTEM_PROMPT
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