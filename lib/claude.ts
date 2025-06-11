import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@/types/database';

const anthropic = new Anthropic({
 apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const SYSTEM_PROMPT = `You are Mano, an intelligent management assistant and helping hand for managers.

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

Previous conversation history:
{conversation_history}

Respond in a helpful, professional tone. Focus on actionable advice and insights that will help the manager build better relationships with their team. Use hand emojis occasionally to reinforce the "helping hand" theme, but don't overdo it.`;

export const GENERAL_SYSTEM_PROMPT = `You are Mano, an intelligent management assistant for strategic thinking and general management challenges. Help with:

Hiring decisions and team building
Communication strategies and stakeholder management
Process improvements and organizational challenges
Strategic planning and prioritization
Leadership development and management skills

Provide practical, actionable advice for management situations that aren't specific to individual team members. Be conversational but professional, and ask clarifying questions when helpful.

Previous conversation history:
{conversation_history}

Respond in a helpful, professional tone. Focus on strategic management guidance and general leadership advice. Use hand emojis occasionally to reinforce the "helping hand" theme, but don't overdo it.`;

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
 conversationHistory: Message[]
): Promise<string> {
 // Format conversation history
 const historyText = conversationHistory
   .slice(-10) // Only use last 10 messages for context
   .map(msg => `${msg.is_user ? 'Manager' : 'Mano'}: ${msg.content}`)
   .join('\n');

 let systemPrompt: string;
 
 // Use different system prompt for general assistant
 if (personName === 'general') {
   systemPrompt = GENERAL_SYSTEM_PROMPT
     .replace('{conversation_history}', historyText || 'No previous conversation');
 } else {
   // Replace placeholders in person-specific system prompt
   systemPrompt = SYSTEM_PROMPT
     .replace('{name}', personName)
     .replace('{role}', personRole || 'No specific role')
     .replace('{relationship_type}', relationshipType)
     .replace('{conversation_history}', historyText || 'No previous conversation');
 }

 return await callClaudeWithRetry(systemPrompt, userMessage);
}

export async function getChatCompletionStreaming(
 userMessage: string,
 personName: string,
 personRole: string | null,
 relationshipType: string,
 conversationHistory: Message[]
) {
 const historyText = conversationHistory
   .slice(-10)
   .map(msg => `${msg.is_user ? 'Manager' : 'Mano'}: ${msg.content}`)
   .join('\n');

 let systemPrompt: string;
 
 // Use different system prompt for general assistant
 if (personName === 'general') {
   systemPrompt = GENERAL_SYSTEM_PROMPT
     .replace('{conversation_history}', historyText || 'No previous conversation');
 } else {
   systemPrompt = SYSTEM_PROMPT
     .replace('{name}', personName)
     .replace('{role}', personRole || 'No specific role')
     .replace('{relationship_type}', relationshipType)
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