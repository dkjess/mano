import type { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { ManagementContextData } from './management-context';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface ContextAwareProfileField {
  field: string;
  value: string;
  confidence: number;
  reasoning: string;
  validatedAgainstTeam: boolean;
}

export interface ContextAwareProfileExtractionResult {
  primaryField: string;
  extractedValue: string;
  additionalFields: ContextAwareProfileField[];
  confidence: number;
  needsMoreInfo: boolean;
  contextualInsights: string[];
  teamPatternMatches: string[];
}

export interface ConversationHistoryContext {
  previousMentions: string[];
  roleHints: string[];
  relationshipClues: string[];
  communicationStyle: string;
  topicPatterns: string[];
}

/**
 * Extract profile data using conversation history and team context
 * This replaces the basic pattern matching with AI-powered contextual analysis
 */
export async function extractProfileDataWithContext(
  userResponse: string,
  currentField: string,
  personName: string,
  personId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<ContextAwareProfileExtractionResult> {
  
  try {
    // Gather conversation context for this person
    const conversationContext = await gatherConversationContext(personId, userId, supabase);
    
    // Get team context for validation
    const teamContext = await getTeamContext(userId, supabase);
    
    // Use AI to extract and validate profile information
    const aiExtractionResult = await extractWithAI(
      userResponse,
      currentField,
      personName,
      conversationContext,
      teamContext
    );
    
    // Validate against team patterns
    const teamValidation = validateAgainstTeamPatterns(
      aiExtractionResult,
      teamContext,
      currentField
    );
    
    return {
      ...aiExtractionResult,
      teamPatternMatches: teamValidation.matches,
      contextualInsights: teamValidation.insights
    };

  } catch (error) {
    console.error('Context-aware profile extraction failed:', error);
    // Fallback to basic extraction
    return await fallbackToBasicExtraction(userResponse, currentField, personName);
  }
}

/**
 * Gather conversation history context for better interpretation
 */
async function gatherConversationContext(
  personId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<ConversationHistoryContext> {
  
  try {
    // Get conversation messages for this person
    const { data: messages } = await supabase
      .from('messages')
      .select('content, is_user, created_at')
      .eq('person_id', personId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(20); // Last 20 messages for context
    
    if (!messages || messages.length === 0) {
      return {
        previousMentions: [],
        roleHints: [],
        relationshipClues: [],
        communicationStyle: '',
        topicPatterns: []
      };
    }

    // Analyze conversation content for context clues
    const conversationText = messages.map(m => m.content).join(' ');
    const userMessages = messages.filter(m => m.is_user).map(m => m.content);
    
    // Extract context using pattern analysis
    const previousMentions = extractPreviousMentions(conversationText);
    const roleHints = extractRoleHints(conversationText);
    const relationshipClues = extractRelationshipClues(conversationText);
    const communicationStyle = analyzeUserCommunicationStyle(userMessages);
    const topicPatterns = extractTopicPatterns(conversationText);
    
    return {
      previousMentions,
      roleHints,
      relationshipClues,
      communicationStyle,
      topicPatterns
    };

  } catch (error) {
    console.error('Failed to gather conversation context:', error);
    return {
      previousMentions: [],
      roleHints: [],
      relationshipClues: [],
      communicationStyle: '',
      topicPatterns: []
    };
  }
}

/**
 * Get team context for validation and pattern matching
 */
async function getTeamContext(userId: string, supabase: SupabaseClient) {
  try {
    const { data: teamMembers } = await supabase
      .from('people')
      .select('name, role, relationship_type, team, location')
      .eq('user_id', userId);
    
    if (!teamMembers) return { roles: [], relationships: [], teams: [], locations: [] };
    
    // Extract unique patterns from existing team
    const roles = [...new Set(teamMembers.map(p => p.role).filter(Boolean))];
    const relationships = [...new Set(teamMembers.map(p => p.relationship_type).filter(Boolean))];
    const teams = [...new Set(teamMembers.map(p => p.team).filter(Boolean))];
    const locations = [...new Set(teamMembers.map(p => p.location).filter(Boolean))];
    
    return { roles, relationships, teams, locations, teamMembers };
    
  } catch (error) {
    console.error('Failed to get team context:', error);
    return { roles: [], relationships: [], teams: [], locations: [] };
  }
}

/**
 * Use AI to extract profile information with full context
 */
async function extractWithAI(
  userResponse: string,
  currentField: string,
  personName: string,
  conversationContext: ConversationHistoryContext,
  teamContext: any
): Promise<ContextAwareProfileExtractionResult> {
  
  const prompt = `You are helping extract and validate profile information about a team member in a management context.

**Person:** ${personName}
**Field to extract:** ${currentField}
**User's response:** "${userResponse}"

**Conversation Context:**
- Previous mentions: ${conversationContext.previousMentions.join(', ') || 'None'}
- Role hints from conversation: ${conversationContext.roleHints.join(', ') || 'None'}
- Relationship clues: ${conversationContext.relationshipClues.join(', ') || 'None'}
- User's communication style: ${conversationContext.communicationStyle || 'Not analyzed'}
- Topic patterns: ${conversationContext.topicPatterns.join(', ') || 'None'}

**Team Context:**
- Existing roles in team: ${teamContext.roles?.join(', ') || 'None'}
- Relationship types used: ${teamContext.relationships?.join(', ') || 'None'}
- Teams/departments: ${teamContext.teams?.join(', ') || 'None'}
- Locations: ${teamContext.locations?.join(', ') || 'None'}

**Instructions:**
1. Extract the ${currentField} information from the user's response
2. Consider conversation history to resolve ambiguities
3. Validate against existing team patterns
4. Identify any additional profile information mentioned
5. Assess confidence based on clarity and context consistency

**Field-specific guidance:**
- **Role**: Look for job titles, responsibilities, seniority levels. Consider team role patterns.
- **Relationship**: Validate against existing relationship types (direct_report, manager, peer, stakeholder).
- **Company/Team**: Look for department, division, or company names. Check against existing teams.
- **Location**: Extract office location, city, remote status. Normalize to team patterns.
- **Notes**: Extract any work-related context, challenges, or important details.

Respond in JSON format:
{
  "primaryField": "${currentField}",
  "extractedValue": "extracted main value or empty string if none",
  "additionalFields": [
    {
      "field": "field_name",
      "value": "extracted_value", 
      "confidence": 0.0-1.0,
      "reasoning": "why this was extracted",
      "validatedAgainstTeam": true/false
    }
  ],
  "confidence": 0.0-1.0,
  "needsMoreInfo": true/false,
  "contextualInsights": ["insight1", "insight2"],
  "teamPatternMatches": ["pattern1", "pattern2"]
}

If the user response is unclear, vague, or says they don't know, set extractedValue to empty string and needsMoreInfo to true.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: `Extract and validate the ${currentField} information from: "${userResponse}"`
        }
      ]
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent?.text) {
      throw new Error('No response from AI extraction');
    }

    const result = JSON.parse(textContent.text);
    
    // Ensure required fields
    return {
      primaryField: result.primaryField || currentField,
      extractedValue: result.extractedValue || '',
      additionalFields: result.additionalFields || [],
      confidence: result.confidence || 0.5,
      needsMoreInfo: result.needsMoreInfo || false,
      contextualInsights: result.contextualInsights || [],
      teamPatternMatches: result.teamPatternMatches || []
    };

  } catch (error) {
    console.error('AI extraction failed:', error);
    throw error;
  }
}

/**
 * Validate extracted information against team patterns
 */
function validateAgainstTeamPatterns(
  extractionResult: ContextAwareProfileExtractionResult,
  teamContext: any,
  currentField: string
): { matches: string[]; insights: string[] } {
  
  const matches: string[] = [];
  const insights: string[] = [];
  
  if (!extractionResult.extractedValue) {
    return { matches, insights };
  }
  
  const value = extractionResult.extractedValue.toLowerCase();
  
  switch (currentField) {
    case 'role':
      // Check if role matches existing team roles
      const matchingRoles = teamContext.roles?.filter((role: string) => 
        role.toLowerCase().includes(value) || value.includes(role.toLowerCase())
      ) || [];
      
      if (matchingRoles.length > 0) {
        matches.push(`Role matches team pattern: ${matchingRoles.join(', ')}`);
      }
      
      // Check for seniority patterns
      const seniorityKeywords = ['senior', 'lead', 'principal', 'manager', 'director'];
      if (seniorityKeywords.some(keyword => value.includes(keyword))) {
        insights.push('Seniority level detected - consider leadership responsibilities');
      }
      break;
      
    case 'relationship':
      // Validate against known relationship types
      const validRelationships = ['direct_report', 'manager', 'peer', 'stakeholder'];
      const matchingRelationship = validRelationships.find(rel => 
        value.includes(rel.replace('_', ' ')) || rel.includes(value)
      );
      
      if (matchingRelationship) {
        matches.push(`Relationship type: ${matchingRelationship}`);
      }
      break;
      
    case 'team':
      // Check against existing teams
      const matchingTeams = teamContext.teams?.filter((team: string) =>
        team.toLowerCase().includes(value) || value.includes(team.toLowerCase())
      ) || [];
      
      if (matchingTeams.length > 0) {
        matches.push(`Team matches existing: ${matchingTeams.join(', ')}`);
      }
      break;
      
    case 'location':
      // Check against existing locations
      const matchingLocations = teamContext.locations?.filter((loc: string) =>
        loc.toLowerCase().includes(value) || value.includes(loc.toLowerCase())
      ) || [];
      
      if (matchingLocations.length > 0) {
        matches.push(`Location matches team pattern: ${matchingLocations.join(', ')}`);
      }
      break;
  }
  
  return { matches, insights };
}

/**
 * Fallback to basic pattern extraction without context
 */
async function fallbackToBasicExtraction(
  userResponse: string,
  currentField: string,
  personName: string
): Promise<ContextAwareProfileExtractionResult> {
  
  const response = userResponse.toLowerCase().trim();
  
  // Handle skip patterns
  const skipPatterns = [
    /^(i )?don'?t know$/i,
    /^not sure$/i,
    /^skip$/i,
    /^n\/?a$/i,
    /^-$/i,
    /^none$/i
  ];
  
  if (skipPatterns.some(pattern => pattern.test(response))) {
    return {
      primaryField: currentField,
      extractedValue: '',
      additionalFields: [],
      confidence: 1.0,
      needsMoreInfo: false,
      contextualInsights: [],
      teamPatternMatches: []
    };
  }
  
  // Basic extraction without context
  return {
    primaryField: currentField,
    extractedValue: userResponse.trim(),
    additionalFields: [],
    confidence: 0.6, // Lower confidence for basic extraction
    needsMoreInfo: false,
    contextualInsights: ['Basic extraction - no context analysis'],
    teamPatternMatches: []
  };
}

// Helper functions for conversation analysis
function extractPreviousMentions(conversationText: string): string[] {
  // Extract previous mentions of roles, companies, etc.
  const mentions: string[] = [];
  
  // Role patterns
  const rolePattern = /(?:role|job|position|title).*?(?:is|as a?|work as)\s+([A-Za-z\s]+?)(?:\.|,|$)/gi;
  let match;
  while ((match = rolePattern.exec(conversationText)) !== null) {
    mentions.push(`Role: ${match[1].trim()}`);
  }
  
  // Company patterns
  const companyPattern = /(?:at|with|for|company|organization)\s+([A-Z][A-Za-z\s&]+?)(?:\.|,|$)/g;
  while ((match = companyPattern.exec(conversationText)) !== null) {
    mentions.push(`Company: ${match[1].trim()}`);
  }
  
  return mentions.slice(0, 5); // Limit to 5 most recent
}

function extractRoleHints(conversationText: string): string[] {
  const roleKeywords = [
    'engineer', 'developer', 'manager', 'director', 'analyst', 'designer', 
    'product', 'marketing', 'sales', 'support', 'lead', 'senior', 'junior'
  ];
  
  const hints: string[] = [];
  const text = conversationText.toLowerCase();
  
  for (const keyword of roleKeywords) {
    if (text.includes(keyword)) {
      hints.push(keyword);
    }
  }
  
  return [...new Set(hints)]; // Remove duplicates
}

function extractRelationshipClues(conversationText: string): string[] {
  const relationshipPatterns = [
    /reports to me/gi,
    /my manager/gi,
    /my boss/gi,
    /team member/gi,
    /direct report/gi,
    /stakeholder/gi,
    /peer/gi,
    /colleague/gi
  ];
  
  const clues: string[] = [];
  
  for (const pattern of relationshipPatterns) {
    const matches = conversationText.match(pattern);
    if (matches) {
      clues.push(...matches);
    }
  }
  
  return clues;
}

function analyzeUserCommunicationStyle(userMessages: string[]): string {
  if (userMessages.length === 0) return '';
  
  const allText = userMessages.join(' ').toLowerCase();
  const avgLength = allText.length / userMessages.length;
  
  // Analyze communication style
  if (avgLength < 50) return 'Concise and direct';
  if (avgLength > 200) return 'Detailed and thorough';
  if (allText.includes('please') || allText.includes('thanks')) return 'Polite and formal';
  if (allText.includes('!') || allText.includes('great')) return 'Enthusiastic';
  
  return 'Conversational';
}

function extractTopicPatterns(conversationText: string): string[] {
  const topicKeywords = [
    'performance', 'project', 'meeting', 'feedback', 'goal', 'challenge', 
    'development', 'training', 'promotion', 'issue', 'conflict', 'strategy'
  ];
  
  const patterns: string[] = [];
  const text = conversationText.toLowerCase();
  
  for (const keyword of topicKeywords) {
    if (text.includes(keyword)) {
      patterns.push(keyword);
    }
  }
  
  return [...new Set(patterns)];
}