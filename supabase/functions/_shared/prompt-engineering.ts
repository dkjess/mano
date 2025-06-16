import { ConversationMemory, SmartFollowUp, ConversationInsight } from './conversation-intelligence.ts'

export interface PromptEnhancement {
  memories: ConversationMemory[];
  followUps: SmartFollowUp[];
  insights: ConversationInsight[];
}

export function buildEnhancedSystemPrompt(
  basePrompt: string,
  managementContext: any,
  enhancement: PromptEnhancement,
  currentPersonId: string
): string {
  const memorySection = buildMemorySection(enhancement.memories);
  const insightSection = buildInsightSection(enhancement.insights);
  const conversationalGuidance = buildConversationalGuidance(enhancement.followUps);

  return `${basePrompt}

${memorySection}

${insightSection}

${conversationalGuidance}

CONVERSATIONAL STYLE GUIDELINES:
- Reference specific memories naturally: "Remember when you mentioned..." or "Like you discussed with Oliver..."
- Show confidence levels: "Based on your team patterns..." (high confidence) vs "This might be worth exploring..." (lower confidence)
- Ask thoughtful follow-up questions that demonstrate contextual awareness
- Offer proactive insights gently: "I've noticed..." rather than "You should..."
- Connect current discussion to broader team patterns when relevant
- Use natural memory references rather than robotic citations

RESPONSE STRUCTURE:
1. Address the immediate question with contextual awareness
2. Reference relevant memories naturally in your response
3. Offer insights if they add value to the discussion
4. End with a thoughtful follow-up question if appropriate

Remember: You're not just answering questions, you're having an ongoing conversation with someone you know well and whose team dynamics you understand deeply.`;
}

function buildMemorySection(memories: ConversationMemory[]): string {
  if (memories.length === 0) return '';

  const memoryText = memories.map(memory => {
    const confidenceLevel = memory.confidence > 0.8 ? 'strong' : memory.confidence > 0.6 ? 'moderate' : 'light';
    return `- ${memory.source_description} (${confidenceLevel} connection): ${memory.reference_text}`;
  }).join('\n');

  return `RELEVANT CONVERSATION MEMORIES:
These memories from your shared history are relevant to the current discussion:
${memoryText}

Use these memories to provide contextual responses, but reference them naturally in conversation.`;
}

function buildInsightSection(insights: ConversationInsight[]): string {
  if (insights.length === 0) return '';

  const insightText = insights.map(insight => {
    const confidenceDesc = insight.confidence > 0.8 ? 'high confidence' : insight.confidence > 0.6 ? 'moderate confidence' : 'worth exploring';
    return `- ${insight.type}: ${insight.message} (${confidenceDesc})${insight.suggested_action ? ` - Suggested: ${insight.suggested_action}` : ''}`;
  }).join('\n');

  return `CONTEXTUAL INSIGHTS:
Based on conversation patterns and team dynamics:
${insightText}

Share these insights thoughtfully and naturally when they add value to the discussion.`;
}

function buildConversationalGuidance(followUps: SmartFollowUp[]): string {
  if (followUps.length === 0) return '';

  const followUpText = followUps.map(followUp => {
    return `- ${followUp.question} (${followUp.reasoning})`;
  }).join('\n');

  return `POTENTIAL FOLLOW-UP QUESTIONS:
Consider asking these contextually aware questions to deepen the conversation:
${followUpText}

Use these as inspiration for natural follow-up questions, not as a script to follow.`;
}

export function formatResponseWithConfidence(
  response: string,
  confidenceIndicators: {
    teamSpecific: boolean;
    patternBased: boolean;
    generalAdvice: boolean;
  }
): string {
  // This could be used to add subtle confidence indicators to responses
  // For now, we'll let the enhanced prompting handle this naturally
  return response;
} 