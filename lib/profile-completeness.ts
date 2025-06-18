export interface ProfileCompleteness {
  score: number; // 0-100 percentage
  missingFields: string[];
  criticalMissing: string[];
  suggestions: ProfileSuggestion[];
  isComplete: boolean;
}

export interface ProfileSuggestion {
  field: string;
  prompt: string;
  priority: 'high' | 'medium' | 'low';
  examples?: string[];
}

export interface Person {
  id: string;
  name: string;
  role: string | null;
  relationship_type: string;
  notes?: string | null;
  emoji?: string | null;
  team?: string | null;
  location?: string | null;
  start_date?: string | null;
  communication_style?: string | null;
  goals?: string | null;
  strengths?: string | null;
  challenges?: string | null;
}

export function analyzeProfileCompleteness(person: Person): ProfileCompleteness {
  const fieldWeights = {
    role: 20,           // Critical for context
    notes: 15,          // Important for relationship context
    team: 10,           // Useful for org understanding
    communication_style: 10, // Helps with conversation advice
    goals: 10,          // Important for development discussions
    strengths: 10,      // Useful for team insights
    challenges: 10,     // Important for support/coaching
    emoji: 5,           // Nice to have for personality
    location: 5,        // Useful for scheduling context
    start_date: 5       // Helpful for tenure context
  };

  const missingFields: string[] = [];
  const criticalMissing: string[] = [];
  let totalPossibleScore = 0;
  let currentScore = 0;

  // Analyze each field
  Object.entries(fieldWeights).forEach(([field, weight]) => {
    totalPossibleScore += weight;
    
    const value = person[field as keyof Person];
    const isEmpty = !value || (typeof value === 'string' && value.trim() === '');
    
    if (isEmpty) {
      missingFields.push(field);
      if (weight >= 15) {
        criticalMissing.push(field);
      }
    } else {
      currentScore += weight;
    }
  });

  const score = Math.round((currentScore / totalPossibleScore) * 100);
  const isComplete = score >= 80; // 80% threshold for "complete"

  const suggestions = generateProfileSuggestions(person, missingFields, criticalMissing);

  return {
    score,
    missingFields,
    criticalMissing,
    suggestions,
    isComplete
  };
}

function generateProfileSuggestions(
  person: Person, 
  missingFields: string[], 
  criticalMissing: string[]
): ProfileSuggestion[] {
  const suggestions: ProfileSuggestion[] = [];
  
  // Role suggestions
  if (missingFields.includes('role')) {
    suggestions.push({
      field: 'role',
      prompt: `What's ${person.name}'s role or job title?`,
      priority: 'high',
      examples: ['Product Manager', 'Senior Developer', 'UX Designer', 'Marketing Manager']
    });
  }

  // Notes suggestions based on relationship type
  if (missingFields.includes('notes')) {
    let notesPrompt = `Tell me a bit about ${person.name}`;
    let examples: string[] = [];

    switch (person.relationship_type) {
      case 'direct_report':
        notesPrompt = `What should I know about ${person.name} as their manager?`;
        examples = ['Great at problem-solving', 'Prefers written communication', 'Working on leadership skills'];
        break;
      case 'manager':
        notesPrompt = `How would you describe your working relationship with ${person.name}?`;
        examples = ['Very supportive', 'Detail-oriented', 'Gives clear direction'];
        break;
      case 'peer':
        notesPrompt = `What's your collaboration like with ${person.name}?`;
        examples = ['Great cross-functional partner', 'Always reliable', 'Creative problem solver'];
        break;
      case 'stakeholder':
        notesPrompt = `What should I know about working with ${person.name}?`;
        examples = ['Focused on business outcomes', 'Needs regular updates', 'Values data-driven decisions'];
        break;
    }

    suggestions.push({
      field: 'notes',
      prompt: notesPrompt,
      priority: 'high',
      examples
    });
  }

  // Team suggestions
  if (missingFields.includes('team')) {
    suggestions.push({
      field: 'team',
      prompt: `What team or department is ${person.name} part of?`,
      priority: 'medium',
      examples: ['Engineering', 'Product', 'Design', 'Marketing', 'Sales']
    });
  }

  // Communication style suggestions
  if (missingFields.includes('communication_style')) {
    suggestions.push({
      field: 'communication_style',
      prompt: `How does ${person.name} prefer to communicate?`,
      priority: 'medium',
      examples: ['Prefers email updates', 'Likes face-to-face discussions', 'Direct and concise', 'Appreciates detailed context']
    });
  }

  // Goals suggestions (for direct reports)
  if (missingFields.includes('goals') && person.relationship_type === 'direct_report') {
    suggestions.push({
      field: 'goals',
      prompt: `What are ${person.name}'s current goals or development areas?`,
      priority: 'medium',
      examples: ['Improving technical leadership', 'Learning product strategy', 'Building public speaking skills']
    });
  }

  // Strengths suggestions
  if (missingFields.includes('strengths')) {
    suggestions.push({
      field: 'strengths',
      prompt: `What are ${person.name}'s key strengths?`,
      priority: 'low',
      examples: ['Technical problem solving', 'Team collaboration', 'Strategic thinking', 'Attention to detail']
    });
  }

  // Challenges suggestions
  if (missingFields.includes('challenges')) {
    suggestions.push({
      field: 'challenges',
      prompt: `Are there any challenges or growth areas for ${person.name}?`,
      priority: 'low',
      examples: ['Time management', 'Delegation', 'Public speaking', 'Cross-team communication']
    });
  }

  // Sort by priority
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  return suggestions.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
}

export function shouldPromptForCompletion(
  person: Person, 
  conversationCount: number,
  lastPromptDate?: string
): boolean {
  const completeness = analyzeProfileCompleteness(person);
  
  // Don't prompt if profile is already complete
  if (completeness.isComplete) return false;
  
  // Don't prompt too early - let user have a few conversations first
  if (conversationCount < 3) return false;
  
  // Don't prompt too frequently
  if (lastPromptDate) {
    const daysSinceLastPrompt = Math.floor(
      (Date.now() - new Date(lastPromptDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastPrompt < 7) return false; // Wait at least a week
  }
  
  // Prompt if there are critical missing fields or score is very low
  return completeness.criticalMissing.length > 0 || completeness.score < 50;
} 