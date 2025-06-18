export interface DetectedPerson {
  name: string;
  role?: string;
  relationshipType?: string;
  confidence: number;
  context: string; // The sentence where they were mentioned
}

export interface PersonDetectionResult {
  detectedPeople: DetectedPerson[];
  hasNewPeople: boolean;
}

export async function detectNewPeopleInMessage(
  message: string,
  existingPeople: string[] // Array of existing person names
): Promise<PersonDetectionResult> {
  const detectedPeople: DetectedPerson[] = [];
  const existingNamesLower = existingPeople.map(name => name.toLowerCase());
  
  // Pattern 1: "I work with Sarah" or "working with John"
  const workWithPattern = /(?:work with|working with|collaborate with|partnering with)\s+([A-Z][a-zA-Z]+)/gi;
  let match;
  while ((match = workWithPattern.exec(message)) !== null) {
    const name = match[1];
    if (!existingNamesLower.includes(name.toLowerCase()) && !isCommonWord(name)) {
      detectedPeople.push({
        name: capitalizeFirst(name),
        confidence: 0.7,
        context: match[0]
      });
    }
  }
  
  // Pattern 2: "My manager Sarah" or "my boss John"
  const managerPattern = /(?:my manager|my boss|report to|reports to)\s+([A-Z][a-zA-Z]+)/gi;
  while ((match = managerPattern.exec(message)) !== null) {
    const name = match[1];
    if (!existingNamesLower.includes(name.toLowerCase()) && !isCommonWord(name)) {
      detectedPeople.push({
        name: capitalizeFirst(name),
        relationshipType: 'manager',
        confidence: 0.8,
        context: match[0]
      });
    }
  }
  
  // Pattern 3: "I manage Sarah" or "Sarah reports to me"
  const directReportPattern = /(?:I manage|manage|managing)\s+([A-Z][a-zA-Z]+)|([A-Z][a-zA-Z]+)\s+reports to me/gi;
  while ((match = directReportPattern.exec(message)) !== null) {
    const name = match[1] || match[2];
    if (!existingNamesLower.includes(name.toLowerCase()) && !isCommonWord(name)) {
      detectedPeople.push({
        name: capitalizeFirst(name),
        relationshipType: 'direct_report',
        confidence: 0.8,
        context: match[0]
      });
    }
  }
  
  // Pattern 4: "Sarah (Product Manager)" or "John the developer"
  const rolePattern = /([A-Z][a-zA-Z]+)\s*(?:\(([^)]+)\)|(?:the|is a|is an|who is)\s+([^,.!?]+))/gi;
  while ((match = rolePattern.exec(message)) !== null) {
    const name = match[1];
    const role = (match[2] || match[3])?.trim();
    if (!existingNamesLower.includes(name.toLowerCase()) && !isCommonWord(name) && role) {
      detectedPeople.push({
        name: capitalizeFirst(name),
        role: role,
        confidence: 0.9,
        context: match[0]
      });
    }
  }
  
  // Pattern 5: "Sarah and I" or "John and me"
  const collaborationPattern = /([A-Z][a-zA-Z]+)\s+and\s+(?:I|me)/gi;
  while ((match = collaborationPattern.exec(message)) !== null) {
    const name = match[1];
    if (!existingNamesLower.includes(name.toLowerCase()) && !isCommonWord(name)) {
      detectedPeople.push({
        name: capitalizeFirst(name),
        relationshipType: 'peer',
        confidence: 0.6,
        context: match[0]
      });
    }
  }
  
  // Remove duplicates and low confidence matches
  const uniquePeople = detectedPeople
    .filter((person, index, self) => 
      index === self.findIndex(p => p.name.toLowerCase() === person.name.toLowerCase())
    )
    .filter(person => person.confidence >= 0.6)
    .sort((a, b) => b.confidence - a.confidence);
  
  return {
    detectedPeople: uniquePeople,
    hasNewPeople: uniquePeople.length > 0
  };
}

function isCommonWord(word: string): boolean {
  const commonWords = [
    // Days and months
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 
    'july', 'august', 'september', 'october', 'november', 'december',
    // Common nouns that might be capitalized
    'project', 'team', 'company', 'meeting', 'email', 'call', 'work', 'task',
    'goal', 'plan', 'issue', 'problem', 'today', 'tomorrow', 'yesterday',
    'week', 'month', 'year', 'time', 'help', 'support', 'update', 'review',
    // Common names that are also words
    'will', 'may', 'august', 'april', 'june', 'rose', 'grace', 'hope',
    'faith', 'joy', 'love', 'peace', 'sage', 'summer', 'winter'
  ];
  
  return commonWords.includes(word.toLowerCase());
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
} 