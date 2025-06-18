export interface ProfileQuestions {
  role: string;
  company: string;
  relationship: string;
  location: string;
  notes: string;
}

export interface ProfileField {
  field: string;
  value: string;
  confidence: number;
}

export interface ProfileExtractionResult {
  primaryField: string;
  extractedValue: string;
  additionalFields: ProfileField[];
  confidence: number;
  needsMoreInfo: boolean;
}

export interface PersonProfile {
  name: string;
  role?: string | null;
  relationship_type?: string;
  team?: string | null;
  location?: string | null;
  notes?: string | null;
  communication_style?: string | null;
  goals?: string | null;
  strengths?: string | null;
  challenges?: string | null;
}

// Generate contextual questions for profile completion
export function generateProfileQuestions(personName: string): ProfileQuestions {
  return {
    role: `What's ${personName}'s role or job title?`,
    company: `What company or team does ${personName} work for?`,
    relationship: `How do you know ${personName}? Are they your direct report, manager, peer, or stakeholder?`,
    location: `Where is ${personName} based? (city, country, or remote)`,
    notes: `Any other details about ${personName} you'd like me to remember? (communication style, goals, strengths, challenges, etc.)`
  };
}

// Determine the next question to ask based on current profile completeness
export function getNextQuestion(personProfile: PersonProfile, answeredFields: string[]): string | null {
  const questions = generateProfileQuestions(personProfile.name);
  const requiredFields = ['role', 'relationship'];
  const optionalFields = ['company', 'location', 'notes'];
  
  // Check required fields first
  for (const field of requiredFields) {
    if (!answeredFields.includes(field) && !personProfile[field as keyof PersonProfile]) {
      return questions[field as keyof ProfileQuestions];
    }
  }
  
  // Then check optional fields
  for (const field of optionalFields) {
    if (!answeredFields.includes(field) && !personProfile[field as keyof PersonProfile]) {
      return questions[field as keyof ProfileQuestions];
    }
  }
  
  // All basic questions answered
  return null;
}

// Generate completion message when profile setup is done
export function generateCompletionMessage(personName: string): string {
  return `Perfect! I've got all the basic information about ${personName}. 

I'll use this context to provide better guidance about your interactions. Feel free to:
- Ask me questions about managing ${personName}
- Get advice on communication strategies
- Discuss any challenges or opportunities
- Update their profile anytime by saying "update ${personName}'s profile"

What would you like to discuss about ${personName}?`;
}

// Extract profile information from natural language using pattern matching
export async function extractProfileData(
  userResponse: string, 
  currentField: string, 
  personName: string
): Promise<ProfileExtractionResult> {
  const response = userResponse.toLowerCase().trim();
  
  // Handle "I don't know" or skip responses
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
      needsMoreInfo: false
    };
  }
  
  // Field-specific extraction
  switch (currentField) {
    case 'role':
      return extractRoleInformation(response, userResponse);
    case 'company':
      return extractCompanyInformation(response, userResponse);
    case 'relationship':
      return extractRelationshipInformation(response, userResponse);
    case 'location':
      return extractLocationInformation(response, userResponse);
    case 'notes':
      return extractNotesInformation(response, userResponse);
    default:
      return extractGeneralInformation(response, userResponse, currentField);
  }
}

// Extract role/job title information
function extractRoleInformation(response: string, original: string): ProfileExtractionResult {
  const additionalFields: ProfileField[] = [];
  
  // Common role patterns
  const rolePatterns = [
    /(?:he'?s|she'?s|they'?re|is)\s+a(?:n)?\s+(.+?)(?:\s+at\s+(.+))?$/,
    /(?:his|her|their)\s+(?:role|job|title)\s+is\s+(.+?)(?:\s+at\s+(.+))?$/,
    /^(.+?)(?:\s+at\s+(.+))?$/
  ];
  
  for (const pattern of rolePatterns) {
    const match = response.match(pattern);
    if (match) {
      const role = match[1]?.trim();
      const company = match[2]?.trim();
      
      if (role) {
        if (company) {
          additionalFields.push({
            field: 'team',
            value: company,
            confidence: 0.8
          });
        }
        
        return {
          primaryField: 'role',
          extractedValue: capitalizeTitle(role),
          additionalFields,
          confidence: 0.9,
          needsMoreInfo: false
        };
      }
    }
  }
  
  // Fallback: use the entire response as role
  return {
    primaryField: 'role',
    extractedValue: capitalizeTitle(response),
    additionalFields: [],
    confidence: 0.7,
    needsMoreInfo: false
  };
}

// Extract company/team information
function extractCompanyInformation(response: string, original: string): ProfileExtractionResult {
  const companyPatterns = [
    /(?:works?\s+(?:at|for)\s+)?(.+)/,
    /(?:he'?s|she'?s|they'?re)\s+(?:at|with)\s+(.+)/
  ];
  
  for (const pattern of companyPatterns) {
    const match = response.match(pattern);
    if (match) {
      const company = match[1]?.trim();
      if (company) {
        return {
          primaryField: 'team',
          extractedValue: capitalizeCompany(company),
          additionalFields: [],
          confidence: 0.9,
          needsMoreInfo: false
        };
      }
    }
  }
  
  return {
    primaryField: 'team',
    extractedValue: capitalizeCompany(response),
    additionalFields: [],
    confidence: 0.7,
    needsMoreInfo: false
  };
}

// Extract relationship information
function extractRelationshipInformation(response: string, original: string): ProfileExtractionResult {
  const relationshipMappings = {
    'direct report': 'direct_report',
    'reports to me': 'direct_report',
    'works for me': 'direct_report',
    'my report': 'direct_report',
    'team member': 'direct_report',
    'manager': 'manager',
    'boss': 'manager',
    'supervisor': 'manager',
    'my manager': 'manager',
    'reports to': 'manager',
    'peer': 'peer',
    'colleague': 'peer',
    'coworker': 'peer',
    'same level': 'peer',
    'stakeholder': 'stakeholder',
    'client': 'stakeholder',
    'customer': 'stakeholder',
    'partner': 'stakeholder'
  };
  
  // Find matching relationship type
  for (const [keyword, type] of Object.entries(relationshipMappings)) {
    if (response.includes(keyword)) {
      return {
        primaryField: 'relationship_type',
        extractedValue: type,
        additionalFields: [],
        confidence: 0.95,
        needsMoreInfo: false
      };
    }
  }
  
  // Default to peer if unclear
  return {
    primaryField: 'relationship_type',
    extractedValue: 'peer',
    additionalFields: [],
    confidence: 0.6,
    needsMoreInfo: true
  };
}

// Extract location information
function extractLocationInformation(response: string, original: string): ProfileExtractionResult {
  const locationPatterns = [
    /(?:based\s+in\s+|located\s+in\s+|from\s+)?(.+)/,
    /(?:works?\s+(?:from|in)\s+)?(.+)/
  ];
  
  for (const pattern of locationPatterns) {
    const match = response.match(pattern);
    if (match) {
      const location = match[1]?.trim();
      if (location) {
        return {
          primaryField: 'location',
          extractedValue: capitalizeLocation(location),
          additionalFields: [],
          confidence: 0.8,
          needsMoreInfo: false
        };
      }
    }
  }
  
  return {
    primaryField: 'location',
    extractedValue: capitalizeLocation(response),
    additionalFields: [],
    confidence: 0.7,
    needsMoreInfo: false
  };
}

// Extract notes and additional information
function extractNotesInformation(response: string, original: string): ProfileExtractionResult {
  const additionalFields: ProfileField[] = [];
  
  // Look for specific attributes in the notes
  const attributePatterns = {
    communication_style: /(?:communicates?|communication style|prefers?|likes?)\s+(.+?)(?:\.|,|$)/i,
    goals: /(?:goals?|wants?|aims?|objectives?)\s+(.+?)(?:\.|,|$)/i,
    strengths: /(?:good at|strong|strengths?|excels?)\s+(.+?)(?:\.|,|$)/i,
    challenges: /(?:struggles?|challenges?|difficulties?|problems?)\s+(.+?)(?:\.|,|$)/i
  };
  
  for (const [field, pattern] of Object.entries(attributePatterns)) {
    const match = original.match(pattern);
    if (match) {
      additionalFields.push({
        field,
        value: match[1].trim(),
        confidence: 0.8
      });
    }
  }
  
  return {
    primaryField: 'notes',
    extractedValue: original,
    additionalFields,
    confidence: 0.9,
    needsMoreInfo: false
  };
}

// Extract general information when field is not specific
function extractGeneralInformation(response: string, original: string, field: string): ProfileExtractionResult {
  return {
    primaryField: field,
    extractedValue: original,
    additionalFields: [],
    confidence: 0.7,
    needsMoreInfo: false
  };
}

// Helper functions for text formatting
function capitalizeTitle(title: string): string {
  return title.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function capitalizeCompany(company: string): string {
  // Handle common company formats
  const words = company.split(' ');
  return words.map(word => {
    // Keep all caps for common acronyms
    if (word.length <= 3 && word.toUpperCase() === word) {
      return word.toUpperCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

function capitalizeLocation(location: string): string {
  return location.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Format profile updates for confirmation messages
export function formatProfileUpdate(data: Record<string, any>): string {
  const updates = Object.entries(data)
    .filter(([_, value]) => value !== null && value !== '')
    .map(([field, value]) => `✓ ${capitalizeFieldName(field)}: ${value}`)
    .join('\n');
  
  return `Got it! Updated profile:\n${updates}`;
}

function capitalizeFieldName(field: string): string {
  const fieldNames: Record<string, string> = {
    role: 'Role',
    team: 'Company/Team',
    relationship_type: 'Relationship',
    location: 'Location',
    notes: 'Notes',
    communication_style: 'Communication Style',
    goals: 'Goals',
    strengths: 'Strengths',
    challenges: 'Challenges'
  };
  
  return fieldNames[field] || field.charAt(0).toUpperCase() + field.slice(1);
}

// Check if a correction is being made
export function isCorrection(message: string): boolean {
  const correctionPatterns = [
    /^actually,?\s*/i,
    /^correction:?\s*/i,
    /^no,?\s*/i,
    /^wait,?\s*/i,
    /^sorry,?\s*/i,
    /(he|she|they)'?s\s+actually\s+/i,
    /that'?s\s+not\s+right/i,
    /let me correct/i
  ];
  
  return correctionPatterns.some(pattern => pattern.test(message.trim()));
}

// Extract correction information
export async function extractCorrection(message: string, personName: string): Promise<ProfileExtractionResult> {
  const cleanMessage = message.replace(/^(actually,?|correction:?|no,?|wait,?|sorry,?)\s*/i, '').trim();
  
  // Try to determine what field is being corrected
  const fieldKeywords = {
    role: ['role', 'job', 'title', 'position'],
    team: ['company', 'team', 'works at', 'works for'],
    relationship_type: ['relationship', 'manager', 'report', 'peer', 'stakeholder'],
    location: ['location', 'based', 'from', 'works from'],
    notes: ['note', 'detail', 'information']
  };
  
  for (const [field, keywords] of Object.entries(fieldKeywords)) {
    if (keywords.some(keyword => cleanMessage.toLowerCase().includes(keyword))) {
      return await extractProfileData(cleanMessage, field, personName);
    }
  }
  
  // Default to general extraction
  return {
    primaryField: 'notes',
    extractedValue: cleanMessage,
    additionalFields: [],
    confidence: 0.8,
    needsMoreInfo: false
  };
} 