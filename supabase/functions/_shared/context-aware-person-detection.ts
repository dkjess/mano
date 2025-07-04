import { Anthropic } from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'

export interface DetectedPerson {
  name: string;
  role?: string;
  relationshipType?: string;
  confidence: number;
  context: string;
  validationScore?: number;
}

export interface ContextAwarePersonDetectionResult {
  detectedPeople: DetectedPerson[];
  hasNewPeople: boolean;
  contextUsed: boolean;
}

/**
 * Context-aware person detection that leverages full management context
 */
export async function detectNewPeopleWithContext(
  message: string,
  existingPeople: string[],
  managementContext: any,
  anthropicApiKey: string
): Promise<ContextAwarePersonDetectionResult> {
  try {
    // Extract potential people using enhanced pattern matching
    const potentialPeople = await extractPotentialPeopleWithContext(
      message, 
      existingPeople, 
      managementContext
    );
    
    if (potentialPeople.length === 0) {
      return { 
        detectedPeople: [], 
        hasNewPeople: false, 
        contextUsed: true 
      };
    }

    // Validate using AI with full context
    const validatedPeople = await validatePeopleWithContext(
      message,
      potentialPeople,
      managementContext,
      anthropicApiKey
    );

    // Final filtering based on confidence and context relevance
    const finalPeople = validatedPeople
      .filter(person => person.confidence >= 0.7) // Higher threshold with context
      .sort((a, b) => b.confidence - a.confidence);

    return {
      detectedPeople: finalPeople,
      hasNewPeople: finalPeople.length > 0,
      contextUsed: true
    };

  } catch (error) {
    console.error('Context-aware person detection failed:', error);
    // Fallback to basic pattern matching
    return await fallbackToPatternDetection(message, existingPeople);
  }
}

/**
 * Extract potential people using context-aware pattern matching
 */
async function extractPotentialPeopleWithContext(
  message: string,
  existingPeople: string[],
  managementContext: any
): Promise<DetectedPerson[]> {
  
  const potentialPeople: DetectedPerson[] = [];
  
  // Enhanced patterns based on management context
  const patterns = [
    // Direct mentions
    /(?:with|from|to|for|about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    // Possessive forms
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'s\s+/g,
    // Role-based patterns
    /(?:my|our|the)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|mentioned|told|asked)/g,
    // Meeting/interaction patterns
    /(?:meeting|call|chat|discussion)\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      const name = match[1].trim();
      
      // Skip if already exists
      if (existingPeople.includes(name)) continue;
      
      // Skip common words and short names
      if (name.length < 2 || isCommonWord(name)) continue;
      
      // Enhanced context analysis
      const context = extractContextAroundName(message, name);
      const roleHint = inferRoleFromContext(context, managementContext);
      const relationshipHint = inferRelationshipFromContext(context, managementContext);
      
      potentialPeople.push({
        name,
        role: roleHint,
        relationshipType: relationshipHint,
        confidence: calculateContextAwareConfidence(name, context, managementContext),
        context
      });
    }
  }

  // Remove duplicates and sort by confidence
  const uniquePeople = potentialPeople.filter((person, index, self) =>
    index === self.findIndex(p => p.name === person.name)
  );

  return uniquePeople.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Validate detected people using AI with full management context
 */
async function validatePeopleWithContext(
  message: string,
  potentialPeople: DetectedPerson[],
  managementContext: any,
  anthropicApiKey: string
): Promise<DetectedPerson[]> {
  
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });
  
  const teamRoles = managementContext.people ? 
    [...new Set(managementContext.people.map((p: any) => p.role).filter(Boolean))] : [];
  const teamSize = managementContext.people ? managementContext.people.length : 0;
  const existingPeopleContext = managementContext.people ? 
    managementContext.people.map((p: any) => `${p.name} (${p.role || 'Unknown role'}) - ${p.relationship_type}`).join(', ') : 'No existing team members';

  const prompt = `You are analyzing a management conversation to detect mentions of new people who should be added to the team.

**Message to analyze:**
"${message}"

**Potential people detected:**
${potentialPeople.map(p => `- ${p.name} (context: "${p.context}", suggested role: ${p.role || 'unknown'}, suggested relationship: ${p.relationshipType || 'unknown'})`).join('\n')}

**Current team context:**
- Team size: ${teamSize} people
- Existing team: ${existingPeopleContext}
- Common roles in team: ${teamRoles.join(', ')}

**Instructions:**
For each potential person, provide a validation score from 1-10 and refined details:

1. **Score 8-10**: Clearly a real person who should be added (explicit work relationships, specific interactions)
2. **Score 5-7**: Likely a person but needs context (mentioned in work context but unclear role)
3. **Score 1-4**: Probably not a person to add (generic references, unclear mentions)

For each person, also provide:
- **Refined role** (based on context clues and team patterns)
- **Refined relationship** (direct_report, manager, peer, stakeholder, or unknown)
- **Confidence reasoning** (why this score)

Respond in JSON format:
{
  "validatedPeople": [
    {
      "name": "string",
      "score": number,
      "refinedRole": "string or null",
      "refinedRelationship": "string",
      "reasoning": "string"
    }
  ]
}

Only include people with scores 6 or higher.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: `Validate these potential people: ${potentialPeople.map(p => p.name).join(', ')}`
        }
      ]
    });

    const textContent = response.content.find((block: any) => block.type === 'text');
    if (!textContent?.text) {
      throw new Error('No response from AI validation');
    }

    const validationResult = JSON.parse(textContent.text);
    
    // Apply validation results to potential people
    const validatedPeople: DetectedPerson[] = [];
    
    for (const validation of validationResult.validatedPeople) {
      const originalPerson = potentialPeople.find(p => p.name === validation.name);
      if (originalPerson && validation.score >= 6) {
        validatedPeople.push({
          ...originalPerson,
          role: validation.refinedRole || originalPerson.role,
          relationshipType: validation.refinedRelationship || originalPerson.relationshipType,
          confidence: validation.score / 10,
          validationScore: validation.score
        });
      }
    }

    return validatedPeople;

  } catch (error) {
    console.error('AI validation failed, using pattern-based validation:', error);
    // Fallback to enhanced pattern validation
    return potentialPeople.filter(p => p.confidence >= 0.6);
  }
}

/**
 * Fallback to basic pattern detection without context
 */
async function fallbackToPatternDetection(
  message: string,
  existingPeople: string[]
): Promise<ContextAwarePersonDetectionResult> {
  
  const basicPatterns = [
    /(?:with|from|to|for|about)\s+([A-Z][a-z]+)/g,
    /([A-Z][a-z]+)'s\s+/g,
  ];

  const detectedPeople: DetectedPerson[] = [];

  for (const pattern of basicPatterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      const name = match[1].trim();
      
      if (!existingPeople.includes(name) && name.length >= 2 && !isCommonWord(name)) {
        detectedPeople.push({
          name,
          confidence: 0.5, // Lower confidence for fallback
          context: extractContextAroundName(message, name)
        });
      }
    }
  }

  const uniquePeople = detectedPeople.filter((person, index, self) =>
    index === self.findIndex(p => p.name === person.name)
  );

  return {
    detectedPeople: uniquePeople,
    hasNewPeople: uniquePeople.length > 0,
    contextUsed: false
  };
}

// Helper functions
function extractContextAroundName(message: string, name: string): string {
  const nameIndex = message.indexOf(name);
  if (nameIndex === -1) return '';
  
  const start = Math.max(0, nameIndex - 50);
  const end = Math.min(message.length, nameIndex + name.length + 50);
  return message.substring(start, end);
}

function inferRoleFromContext(context: string, managementContext: any): string | undefined {
  const contextLower = context.toLowerCase();
  
  // Pattern-based role inference
  if (contextLower.includes('engineer') || contextLower.includes('developer')) return 'Engineer';
  if (contextLower.includes('manager') || contextLower.includes('lead')) return 'Manager';
  if (contextLower.includes('designer')) return 'Designer';
  if (contextLower.includes('product')) return 'Product Manager';
  
  return undefined;
}

function inferRelationshipFromContext(context: string, managementContext: any): string {
  const contextLower = context.toLowerCase();
  
  if (contextLower.includes('my team') || contextLower.includes('reports to me')) return 'direct_report';
  if (contextLower.includes('my manager') || contextLower.includes('my boss')) return 'manager';
  if (contextLower.includes('peer') || contextLower.includes('colleague')) return 'peer';
  if (contextLower.includes('stakeholder') || contextLower.includes('client')) return 'stakeholder';
  
  return 'peer'; // Default
}

function calculateContextAwareConfidence(
  name: string, 
  context: string, 
  managementContext: any
): number {
  let confidence = 0.5; // Base confidence
  
  const contextLower = context.toLowerCase();
  
  // Boost for work-related context
  if (contextLower.includes('meeting') || contextLower.includes('project') || 
      contextLower.includes('team') || contextLower.includes('work')) {
    confidence += 0.2;
  }
  
  // Boost for role mentions
  if (contextLower.includes('manager') || contextLower.includes('engineer') || 
      contextLower.includes('designer') || contextLower.includes('lead')) {
    confidence += 0.2;
  }
  
  // Boost for relationship context
  if (contextLower.includes('reports') || contextLower.includes('boss') || 
      contextLower.includes('peer') || contextLower.includes('stakeholder')) {
    confidence += 0.1;
  }
  
  // Reduce for common words or unclear context
  if (isCommonWord(name) || context.length < 10) {
    confidence -= 0.3;
  }
  
  return Math.max(0.1, Math.min(0.9, confidence));
}

function isCommonWord(word: string): boolean {
  const commonWords = [
    'The', 'And', 'But', 'For', 'Not', 'You', 'All', 'Can', 'Had', 'Her', 'Was', 'One', 'Our', 'Out', 'Day', 'Get', 'Has', 'Him', 'His', 'How', 'Man', 'New', 'Now', 'Old', 'See', 'Two', 'Who', 'Boy', 'Did', 'Its', 'Let', 'Put', 'Say', 'She', 'Too', 'Use'
  ];
  return commonWords.includes(word);
}