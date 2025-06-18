export interface DetectedPerson {
  name: string;
  role?: string;
  relationshipType?: string;
  confidence: number;
  context: string;
  validationScore?: number;
}

export interface PersonDetectionResult {
  detectedPeople: DetectedPerson[];
  hasNewPeople: boolean;
  fallbackUsed?: boolean;
}

export async function detectNewPeopleInMessage(
  message: string,
  existingPeople: string[]
): Promise<PersonDetectionResult> {
  try {
    // Use only enhanced pattern matching (no LLM validation)
    const potentialPeople = await extractPotentialPeople(message, existingPeople);
    
    if (potentialPeople.length === 0) {
      return { detectedPeople: [], hasNewPeople: false, fallbackUsed: true };
    }

    // Enhanced pattern-based validation only
    const validatedPeople = await validateWithPatterns(message, potentialPeople);

    // Final filtering and confidence adjustment
    const finalPeople = validatedPeople
      .filter(person => person.confidence >= 0.6)
      .sort((a, b) => b.confidence - a.confidence);

    return {
      detectedPeople: finalPeople,
      hasNewPeople: finalPeople.length > 0,
      fallbackUsed: true
    };

  } catch (error) {
    console.error('Enhanced person detection failed:', error);
    // Fallback to basic detection
    return await basicPersonDetection(message, existingPeople);
  }
}

async function extractPotentialPeople(
  message: string,
  existingPeople: string[]
): Promise<DetectedPerson[]> {
  const detectedPeople: DetectedPerson[] = [];
  const existingNamesLower = existingPeople.map(name => name.toLowerCase());
  
  // Enhanced patterns that work across languages
  const patterns = [
    // Work relationships - more comprehensive
    {
      regex: /(?:work with|working with|collaborate with|collaborated with|partnering with|team up with|paired with)\s+([A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F'-]{1,20})(?=\s|[,.!?]|$)/gi,
      relationshipType: 'peer',
      confidence: 0.7
    },
    // Management relationships
    {
      regex: /(?:my manager|my boss|our manager|report to|reports to|supervisor|lead by)\s+([A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F'-]{1,20})(?=\s|[,.!?]|$)/gi,
      relationshipType: 'manager',
      confidence: 0.8
    },
    // Direct reports
    {
      regex: /(?:I manage|manage|managing|my team member|direct report)\s+([A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F'-]{1,20})(?=\s|[,.!?]|$)/gi,
      relationshipType: 'direct_report',
      confidence: 0.8
    },
    // Names with roles - enhanced to capture more patterns
    {
      regex: /([A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F'-]{1,20})\s*(?:\(([^)]+)\)|(?:the|is a|is an|who is|works as)\s+([^,.!?]{1,30}))/gi,
      hasRole: true,
      confidence: 0.9
    },
    // Collaboration patterns - "Name and I"
    {
      regex: /([A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F'-]{1,20})\s+and\s+(?:I|me|myself)(?=\s|[,.!?]|$)/gi,
      relationshipType: 'peer',
      confidence: 0.6
    },
    // Meeting/discussion context
    {
      regex: /(?:meeting with|talked to|spoke with|discussed with|called)\s+([A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F'-]{1,20})(?=\s|[,.!?]|$)/gi,
      relationshipType: 'stakeholder',
      confidence: 0.7
    },
    // Discussion patterns with objects in between
    {
      regex: /discussed\s+(?:the\s+)?[a-zA-Z\s]+\s+with\s+([A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F'-]{1,20})(?=\s|[,.!?]|$)/gi,
      relationshipType: 'stakeholder',
      confidence: 0.7
    },
    // Email context
    {
      regex: /(?:emailed|email)\s+([A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F'-]{1,20})(?=\s|[,.!?]|$)/gi,
      relationshipType: 'stakeholder',
      confidence: 0.7
    },
    // Hyphenated names pattern
    {
      regex: /\b([A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F]*-[A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F]*)\s+(?:is|was|will|would|can|could|should|might|leads?|works?|manages?)/gi,
      confidence: 0.8
    }
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(message)) !== null) {
      const name = match[1]?.trim();
      const role = pattern.hasRole ? (match[2] || match[3])?.trim() : undefined;
      
      if (name && !existingNamesLower.includes(name.toLowerCase()) && isValidName(name)) {
        detectedPeople.push({
          name: capitalizeName(name),
          role: role,
          relationshipType: pattern.relationshipType,
          confidence: pattern.confidence,
          context: match[0]
        });
      }
    }
  }

  // Remove duplicates
  return detectedPeople.filter((person, index, self) => 
    index === self.findIndex(p => p.name.toLowerCase() === person.name.toLowerCase())
  );
}

async function validateWithPatterns(
  message: string,
  potentialPeople: DetectedPerson[]
): Promise<DetectedPerson[]> {
  // Enhanced pattern-based validation for fallback
  return potentialPeople.filter(person => {
    const name = person.name.toLowerCase();
    
    // Additional validation rules
    if (isCommonWord(name)) return false;
    if (containsNumbers(name)) return false;
    if (isAllCaps(person.name)) return false;
    if (name.length < 2 || name.length > 30) return false;
    
    // Context validation - look for person-like contexts
    const context = person.context.toLowerCase();
    const personContexts = [
      'work', 'manage', 'report', 'team', 'colleague', 'boss', 'staff',
      'meeting', 'discuss', 'talk', 'call', 'email', 'collaborate'
    ];
    
    const hasPersonContext = personContexts.some(ctx => 
      context.includes(ctx) || message.toLowerCase().includes(ctx)
    );
    
    if (hasPersonContext) {
      person.confidence += 0.1;
    }
    
    return person.confidence >= 0.6;
  });
}

async function basicPersonDetection(
  message: string,
  existingPeople: string[]
): Promise<PersonDetectionResult> {
  // Fallback to the original simple detection logic
  const detectedPeople: DetectedPerson[] = [];
  const existingNamesLower = existingPeople.map(name => name.toLowerCase());
  
  const workWithPattern = /(?:work with|working with)\s+([A-Z][a-zA-Z]+)/gi;
  let match;
  while ((match = workWithPattern.exec(message)) !== null) {
    const name = match[1];
    if (!existingNamesLower.includes(name.toLowerCase()) && !isCommonWord(name)) {
      detectedPeople.push({
        name: capitalizeName(name),
        confidence: 0.7,
        context: match[0]
      });
    }
  }

  return {
    detectedPeople,
    hasNewPeople: detectedPeople.length > 0,
    fallbackUsed: true
  };
}

function isValidName(name: string): boolean {
  // Enhanced name validation that works across languages
  if (!name || name.length < 2 || name.length > 30) return false;
  
  // Check for valid name characters (including international characters and hyphens)
  const namePattern = /^[A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F'-]*$/;
  if (!namePattern.test(name)) return false;
  
  // Check against common words and false positives
  if (isCommonWord(name)) return false;
  if (containsNumbers(name)) return false;
  if (isAllCaps(name)) return false;
  
  // Check for obvious non-names
  const nonNamePatterns = [
    /^(the|and|or|but|if|when|where|what|how|why)$/i,
    /^(project|team|company|meeting|email|call)$/i,
    /^(today|tomorrow|yesterday|week|month|year)$/i,
    /^(after|before|during|about|from)$/i
  ];
  
  return !nonNamePatterns.some(pattern => pattern.test(name));
}

function isCommonWord(word: string): boolean {
  const commonWords = [
    // Days and months
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 
    'july', 'august', 'september', 'october', 'november', 'december',
    // Common nouns
    'project', 'team', 'company', 'meeting', 'email', 'call', 'work', 'task',
    'goal', 'plan', 'issue', 'problem', 'today', 'tomorrow', 'yesterday',
    'week', 'month', 'year', 'time', 'help', 'support', 'update', 'review',
    'system', 'process', 'data', 'report', 'document', 'file', 'folder',
    // Words that are also names
    'will', 'may', 'august', 'april', 'june', 'rose', 'grace', 'hope',
    'faith', 'joy', 'love', 'peace', 'sage', 'summer', 'winter', 'autumn',
    // Common false positives
    'google', 'microsoft', 'apple', 'amazon', 'facebook', 'twitter',
    'slack', 'zoom', 'teams', 'office', 'excel', 'word', 'powerpoint'
  ];
  
  return commonWords.includes(word.toLowerCase());
}

function containsNumbers(str: string): boolean {
  return /\d/.test(str);
}

function isAllCaps(str: string): boolean {
  return str === str.toUpperCase() && str !== str.toLowerCase();
}

function capitalizeName(name: string): string {
  // Handle hyphenated names and spaces
  return name.split(/(\s|-)/g)
    .map(part => {
      if (part === ' ' || part === '-') return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
} 