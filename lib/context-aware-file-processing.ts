import type { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface ProcessedFile {
  name: string;
  fileType: string;
  contentType: string;
  extractedContent: string;
  processingStatus: string;
}

export interface ContextualFileInsight {
  filename: string;
  relevantConnections: string[];
  keyInsights: string[];
  suggestedActions: string[];
  crossReferences: {
    relatedPeople: string[];
    relatedTopics: string[];
    similarConversations: string[];
  };
}

export interface IdentityMapping {
  technicalId: string; // "Meeting Room B", "Participant 2"
  resolvedName: string; // "Mike"
  confidence: number;
  evidence: string[];
}

export interface UncertainMapping {
  technicalId: string;
  possibleNames: string[];
  confidence: number;
  context: string;
  importance: 'high' | 'medium' | 'low';
  frequency: number; // How often this speaker appears
}

export interface IdentityQuestion {
  id: string;
  type: 'direct_mapping' | 'multiple_choice' | 'confirmation';
  question: string;
  options?: string[];
  context: string;
  importance: 'high' | 'medium' | 'low';
  technicalId: string;
}

export interface TranscriptAnalysis {
  isTranscript: boolean;
  identityMappings: IdentityMapping[];
  uncertainMappings: UncertainMapping[];
  resolutionRecommendation: 'ask_user' | 'auto_resolve' | 'skip';
  userQuestions: IdentityQuestion[];
  conversationTurns: number;
  uniqueSpeakers: string[];
}

export interface ContextAwareFileProcessingResult {
  fileContext: string;
  fileInsights: ContextualFileInsight[];
  hasSemanticConnections: boolean;
  transcriptAnalysis?: TranscriptAnalysis;
  identityResolutionNeeded?: {
    questions: IdentityQuestion[];
    requiresUserInput: boolean;
  };
}

/**
 * Process uploaded files with context-aware analysis
 * Connects file content to existing conversations, people, and topics
 */
export async function processFilesWithContext(
  files: ProcessedFile[],
  userMessage: string,
  userId: string,
  supabase: SupabaseClient
): Promise<ContextAwareFileProcessingResult> {
  
  if (!files || files.length === 0) {
    return {
      fileContext: '',
      fileInsights: [],
      hasSemanticConnections: false
    };
  }

  try {
    // Process each file with context awareness
    const fileInsights: ContextualFileInsight[] = [];
    let fileContext = `\n\n[Attached files with contextual analysis:]\n`;
    let transcriptAnalysis: TranscriptAnalysis | undefined;
    let identityResolutionNeeded: boolean = false;
    let allIdentityQuestions: IdentityQuestion[] = [];

    for (const file of files) {
      console.log('🔍 Processing file with context:', file.name);
      
      if (!file.extractedContent || file.processingStatus !== 'completed') {
        // Handle non-processed files
        fileContext += await handleNonProcessedFile(file);
        continue;
      }

      // Check if this is a transcript and analyze for identity resolution
      const currentTranscriptAnalysis = await analyzeTranscriptForIdentities(
        file,
        userId,
        supabase
      );

      if (currentTranscriptAnalysis.isTranscript) {
        console.log('🔍 Transcript detected:', file.name, 'with', currentTranscriptAnalysis.uniqueSpeakers.length, 'speakers');
        transcriptAnalysis = currentTranscriptAnalysis;
        
        if (currentTranscriptAnalysis.resolutionRecommendation === 'ask_user') {
          identityResolutionNeeded = true;
          allIdentityQuestions.push(...currentTranscriptAnalysis.userQuestions);
          console.log('🔍 Identity resolution needed for', currentTranscriptAnalysis.userQuestions.length, 'questions');
        }

        // Apply any resolved identities to the file content
        file.extractedContent = applyIdentityMappings(
          file.extractedContent, 
          currentTranscriptAnalysis.identityMappings
        );
      }

      // Find semantic connections for this file
      const connections = await findFileConnections(
        file.extractedContent,
        userId,
        supabase
      );

      // Generate contextual insights
      const insights = await generateFileInsights(
        file,
        connections,
        userMessage
      );

      fileInsights.push(insights);

      // Add contextual file content to file context
      fileContext += await formatFileWithContext(file, insights);
    }

    return {
      fileContext,
      fileInsights,
      hasSemanticConnections: fileInsights.some(f => 
        f.crossReferences.relatedPeople.length > 0 ||
        f.crossReferences.relatedTopics.length > 0 ||
        f.crossReferences.similarConversations.length > 0
      ),
      transcriptAnalysis,
      identityResolutionNeeded: identityResolutionNeeded ? {
        questions: allIdentityQuestions,
        requiresUserInput: true
      } : undefined
    };

  } catch (error) {
    console.error('Context-aware file processing failed:', error);
    // Fallback to basic file processing
    return await fallbackToBasicProcessing(files);
  }
}

/**
 * Find semantic connections between file content and existing data
 */
async function findFileConnections(
  content: string,
  userId: string,
  supabase: SupabaseClient
): Promise<{
  relatedPeople: any[];
  relatedTopics: any[];
  similarMessages: any[];
}> {
  
  try {
    // Get user's people and topics for matching
    const [peopleResult, topicsResult] = await Promise.all([
      supabase
        .from('people')
        .select('id, name, role, relationship_type')
        .eq('user_id', userId),
      supabase
        .from('topics')
        .select('id, title, participants')
        .eq('created_by', userId)
        .eq('status', 'active')
    ]);

    const people = peopleResult.data || [];
    const topics = topicsResult.data || [];

    // Find people mentioned in file content
    const relatedPeople = people.filter(person => 
      content.toLowerCase().includes(person.name.toLowerCase())
    );

    // Find topics related to file content (keyword matching)
    const relatedTopics = topics.filter(topic => {
      const topicKeywords = topic.title.toLowerCase().split(/\s+/);
      const contentLower = content.toLowerCase();
      return topicKeywords.some(keyword => 
        keyword.length > 3 && contentLower.includes(keyword)
      );
    });

    // TODO: Implement vector search for similar messages
    // For now, return empty array as this requires OpenAI embeddings
    const similarMessages: any[] = [];

    return {
      relatedPeople,
      relatedTopics,
      similarMessages
    };

  } catch (error) {
    console.error('Failed to find file connections:', error);
    return {
      relatedPeople: [],
      relatedTopics: [],
      similarMessages: []
    };
  }
}

/**
 * Generate contextual insights about the file using AI
 */
async function generateFileInsights(
  file: ProcessedFile,
  connections: any,
  userMessage: string
): Promise<ContextualFileInsight> {
  
  const relatedPeopleNames = connections.relatedPeople.map((p: any) => p.name);
  const relatedTopicTitles = connections.relatedTopics.map((t: any) => t.title);
  
  const prompt = `You are analyzing a file uploaded in a management conversation context.

**File Details:**
- Name: ${file.name}
- Type: ${file.fileType}
- Content Type: ${file.contentType}

**File Content Preview:**
${file.extractedContent.substring(0, 2000)}${file.extractedContent.length > 2000 ? '\n...[truncated]' : ''}

**User's Current Message:**
"${userMessage}"

**Detected Connections:**
- Related People: ${relatedPeopleNames.join(', ') || 'None detected'}
- Related Topics: ${relatedTopicTitles.join(', ') || 'None detected'}

**Instructions:**
Analyze this file and provide:

1. **Key Insights** (2-3 most important points from the file)
2. **Relevant Connections** (how this relates to the user's message and context)
3. **Suggested Actions** (1-2 specific things the manager could do with this information)

Focus on management-relevant insights: team dynamics, performance, processes, decisions, or strategic information.

Respond in JSON format:
{
  "keyInsights": ["insight1", "insight2", "insight3"],
  "relevantConnections": ["connection1", "connection2"],
  "suggestedActions": ["action1", "action2"]
}

Keep insights concise and actionable for a manager.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: `Analyze the file "${file.name}" and provide contextual insights.`
        }
      ]
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent?.text) {
      throw new Error('No insights generated');
    }

    const insights = JSON.parse(textContent.text);
    
    return {
      filename: file.name,
      relevantConnections: insights.relevantConnections || [],
      keyInsights: insights.keyInsights || [],
      suggestedActions: insights.suggestedActions || [],
      crossReferences: {
        relatedPeople: relatedPeopleNames,
        relatedTopics: relatedTopicTitles,
        similarConversations: [] // TODO: Implement when vector search is added
      }
    };

  } catch (error) {
    console.error('Failed to generate file insights:', error);
    // Fallback to basic analysis
    return {
      filename: file.name,
      relevantConnections: [`Related to current discussion about file: ${file.name}`],
      keyInsights: [`File contains ${file.extractedContent.length} characters of content`],
      suggestedActions: ['Review the file content for relevant information'],
      crossReferences: {
        relatedPeople: relatedPeopleNames,
        relatedTopics: relatedTopicTitles,
        similarConversations: []
      }
    };
  }
}

/**
 * Format file content with contextual information
 */
async function formatFileWithContext(
  file: ProcessedFile,
  insights: ContextualFileInsight
): Promise<string> {
  
  let context = `\n--- File: ${file.name} ---\n`;
  
  // Add contextual insights first
  if (insights.keyInsights.length > 0) {
    context += `**Key Insights:**\n${insights.keyInsights.map(insight => `• ${insight}`).join('\n')}\n\n`;
  }
  
  if (insights.crossReferences.relatedPeople.length > 0) {
    context += `**Related People:** ${insights.crossReferences.relatedPeople.join(', ')}\n`;
  }
  
  if (insights.crossReferences.relatedTopics.length > 0) {
    context += `**Related Topics:** ${insights.crossReferences.relatedTopics.join(', ')}\n`;
  }
  
  if (insights.suggestedActions.length > 0) {
    context += `**Suggested Actions:**\n${insights.suggestedActions.map(action => `• ${action}`).join('\n')}\n\n`;
  }
  
  // Add file content (truncated)
  const content = file.extractedContent.length > 3000 
    ? file.extractedContent.substring(0, 3000) + '\n...[truncated - focus on insights above]'
    : file.extractedContent;
  
  context += `**Content:**\n${content}\n`;
  context += `--- End of ${file.name} ---\n`;
  
  return context;
}

/**
 * Handle files that couldn't be processed
 */
async function handleNonProcessedFile(file: ProcessedFile): Promise<string> {
  let context = `\n--- File: ${file.name} ---\n`;
  
  switch (file.processingStatus) {
    case 'processing':
      context += `[File is being processed...]\n`;
      break;
    case 'failed':
      context += `[File processing failed - content not available]\n`;
      break;
    case 'pending':
      context += `[File processing is pending...]\n`;
      break;
    default:
      context += `[No text content available for this file type: ${file.contentType}]\n`;
  }
  
  context += `--- End of ${file.name} ---\n`;
  return context;
}

/**
 * Fallback to basic file processing without context
 */
async function fallbackToBasicProcessing(
  files: ProcessedFile[]
): Promise<ContextAwareFileProcessingResult> {
  
  let fileContext = `\n\n[Attached files:]\n`;
  
  for (const file of files) {
    fileContext += `\n--- File: ${file.name} ---\n`;
    
    if (file.extractedContent) {
      const content = file.extractedContent.length > 5000 
        ? file.extractedContent.substring(0, 5000) + '\n...[truncated]'
        : file.extractedContent;
      fileContext += `Content:\n${content}\n`;
    } else {
      fileContext += await handleNonProcessedFile(file);
    }
    
    fileContext += `--- End of ${file.name} ---\n`;
  }
  
  return {
    fileContext,
    fileInsights: [],
    hasSemanticConnections: false
  };
}

/**
 * Analyze a file to determine if it's a transcript and perform identity resolution
 */
async function analyzeTranscriptForIdentities(
  file: ProcessedFile,
  userId: string,
  supabase: SupabaseClient
): Promise<TranscriptAnalysis> {
  
  const isTranscript = detectTranscriptFormat(file);
  
  if (!isTranscript) {
    return {
      isTranscript: false,
      identityMappings: [],
      uncertainMappings: [],
      resolutionRecommendation: 'skip',
      userQuestions: [],
      conversationTurns: 0,
      uniqueSpeakers: []
    };
  }

  try {
    // Parse conversation structure
    const conversationTurns = parseConversationTurns(file.extractedContent);
    const uniqueSpeakers = [...new Set(conversationTurns.map(turn => turn.speaker))];
    
    console.log('🔍 Parsed transcript:', conversationTurns.length, 'turns,', uniqueSpeakers.length, 'speakers');

    // Get existing people for context
    const { data: existingPeople } = await supabase
      .from('people')
      .select('name, role, relationship_type')
      .eq('user_id', userId);

    const existingNames = existingPeople?.map(p => p.name) || [];

    // Find identity mappings and uncertainties
    const identityMappings = await findIdentityMappings(conversationTurns, existingNames);
    const uncertainMappings = await findUncertainMappings(conversationTurns, existingNames);
    
    // Determine if we should ask user for clarification
    const resolutionRecommendation = shouldAskForIdentityResolution(uncertainMappings, conversationTurns);
    
    // Generate questions for user
    const userQuestions = resolutionRecommendation === 'ask_user' 
      ? await generateIdentityQuestions(uncertainMappings, existingPeople || [])
      : [];

    return {
      isTranscript: true,
      identityMappings,
      uncertainMappings,
      resolutionRecommendation,
      userQuestions,
      conversationTurns: conversationTurns.length,
      uniqueSpeakers
    };

  } catch (error) {
    console.error('Transcript analysis failed:', error);
    return {
      isTranscript: true,
      identityMappings: [],
      uncertainMappings: [],
      resolutionRecommendation: 'skip',
      userQuestions: [],
      conversationTurns: 0,
      uniqueSpeakers: []
    };
  }
}

/**
 * Detect if a file contains transcript-like content
 */
function detectTranscriptFormat(file: ProcessedFile): boolean {
  const content = file.extractedContent;
  const filename = file.name.toLowerCase();
  
  // Filename indicators
  const filenameIndicators = [
    filename.includes('transcript'),
    filename.includes('meeting'),
    filename.includes('call'),
    filename.includes('recording')
  ];

  // Content structure indicators
  const contentIndicators = [
    // Speaker: Content pattern
    /^[^:\n]{1,50}:\s*.+$/m.test(content),
    // Multiple speaker patterns
    (content.match(/^[^:\n]{1,50}:/gm) || []).length >= 3,
    // Time stamps
    /\d{1,2}:\d{2}/.test(content),
    // Common transcript artifacts
    /meeting room|participant \d+|zoom|teams|webex/i.test(content)
  ];

  const filenameScore = filenameIndicators.filter(Boolean).length;
  const contentScore = contentIndicators.filter(Boolean).length;
  
  // Need at least one filename indicator AND two content indicators
  // OR strong content indicators (3+)
  return (filenameScore >= 1 && contentScore >= 2) || contentScore >= 3;
}

/**
 * Parse transcript into conversation turns
 */
interface ConversationTurn {
  speaker: string;
  content: string;
  turnIndex: number;
}

function parseConversationTurns(transcript: string): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  
  // Split by lines and process
  const lines = transcript.split('\n');
  let currentSpeaker = '';
  let currentContent = '';
  let turnIndex = 0;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Check if this line starts with a speaker pattern
    const speakerMatch = trimmedLine.match(/^([^:]{1,50}):\s*(.*)$/);
    
    if (speakerMatch) {
      // Save previous turn if exists
      if (currentSpeaker && currentContent.trim()) {
        turns.push({
          speaker: currentSpeaker,
          content: currentContent.trim(),
          turnIndex: turnIndex++
        });
      }
      
      // Start new turn
      currentSpeaker = speakerMatch[1].trim();
      currentContent = speakerMatch[2];
    } else {
      // Continuation of current speaker
      currentContent += ' ' + trimmedLine;
    }
  }
  
  // Don't forget the last turn
  if (currentSpeaker && currentContent.trim()) {
    turns.push({
      speaker: currentSpeaker,
      content: currentContent.trim(),
      turnIndex: turnIndex++
    });
  }
  
  return turns;
}

/**
 * Find confident identity mappings using pattern recognition
 */
async function findIdentityMappings(
  turns: ConversationTurn[],
  existingNames: string[]
): Promise<IdentityMapping[]> {
  
  const mappings: IdentityMapping[] = [];
  
  // Pattern 1: Direct address followed by response
  for (let i = 0; i < turns.length - 1; i++) {
    const currentTurn = turns[i];
    const nextTurn = turns[i + 1];
    
    // Look for "Name, question?" pattern
    const directAddressPattern = /([A-Z][a-zA-Z]+),\s+(?:what|how|do|can|would|are|is|will|should)/i;
    const match = currentTurn.content.match(directAddressPattern);
    
    if (match && isTechnicalSpeakerId(nextTurn.speaker)) {
      const addressedName = match[1];
      
      // Verify this looks like a real name and not already in existing people
      if (isValidPersonName(addressedName) && !existingNames.includes(addressedName)) {
        mappings.push({
          technicalId: nextTurn.speaker,
          resolvedName: addressedName,
          confidence: 0.9,
          evidence: [`Direct address: "${addressedName}, ${match[0]}" followed by response from ${nextTurn.speaker}`]
        });
      }
    }
  }

  // Pattern 2: Self-introduction
  for (const turn of turns) {
    if (isTechnicalSpeakerId(turn.speaker)) {
      const selfIntroPattern = /(?:I'm|I am|my name is|this is)\s+([A-Z][a-zA-Z]+)/i;
      const match = turn.content.match(selfIntroPattern);
      
      if (match) {
        const name = match[1];
        if (isValidPersonName(name) && !existingNames.includes(name)) {
          mappings.push({
            technicalId: turn.speaker,
            resolvedName: name,
            confidence: 0.95,
            evidence: [`Self-introduction: "${match[0]}" by ${turn.speaker}`]
          });
        }
      }
    }
  }

  // Remove duplicates and conflicts
  return consolidateIdentityMappings(mappings);
}

/**
 * Find uncertain mappings that need user clarification
 */
async function findUncertainMappings(
  turns: ConversationTurn[],
  existingNames: string[]
): Promise<UncertainMapping[]> {
  
  const uncertainMappings: UncertainMapping[] = [];
  const technicalSpeakers = turns
    .filter(turn => isTechnicalSpeakerId(turn.speaker))
    .reduce((acc, turn) => {
      acc[turn.speaker] = (acc[turn.speaker] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  // Analyze each technical speaker
  for (const [technicalId, frequency] of Object.entries(technicalSpeakers)) {
    const speakerTurns = turns.filter(turn => turn.speaker === technicalId);
    
    // Look for potential name clues in their content or surrounding context
    const possibleNames = await findPossibleNamesForSpeaker(technicalId, turns, existingNames);
    const importance = calculateImportance(frequency, speakerTurns);
    
    if (possibleNames.length > 0 || (frequency >= 3 && importance !== 'low')) {
      const contextSample = speakerTurns
        .slice(0, 2)
        .map(turn => turn.content.substring(0, 100))
        .join(' ... ');

      uncertainMappings.push({
        technicalId,
        possibleNames,
        confidence: possibleNames.length === 1 ? 0.7 : 0.5,
        context: contextSample,
        importance,
        frequency
      });
    }
  }

  return uncertainMappings;
}

/**
 * Find possible names for a technical speaker ID
 */
async function findPossibleNamesForSpeaker(
  technicalId: string,
  allTurns: ConversationTurn[],
  existingNames: string[]
): Promise<string[]> {
  
  const possibleNames: string[] = [];
  const speakerTurns = allTurns.filter(turn => turn.speaker === technicalId);
  
  // Look in surrounding context (turns before this speaker)
  for (const turn of speakerTurns) {
    const contextTurns = allTurns
      .filter(t => t.turnIndex < turn.turnIndex && t.turnIndex > turn.turnIndex - 3)
      .map(t => t.content)
      .join(' ');
    
    // Extract names mentioned in context
    const namePattern = /\b([A-Z][a-zA-Z]{2,})\b/g;
    let match;
    while ((match = namePattern.exec(contextTurns)) !== null) {
      const name = match[1];
      if (isValidPersonName(name) && !existingNames.includes(name)) {
        if (!possibleNames.includes(name)) {
          possibleNames.push(name);
        }
      }
    }
  }

  return possibleNames.slice(0, 3); // Limit to top 3 candidates
}

/**
 * Check if a speaker ID looks like a technical artifact
 */
function isTechnicalSpeakerId(speaker: string): boolean {
  const technicalPatterns = [
    /^Meeting Room [A-Z]$/i,
    /^Conference Room \d+$/i,
    /^Participant \d+$/i,
    /^Zoom Participant \d+$/i,
    /^Teams User \d+$/i,
    /^Room [A-Z\d]+$/i,
    /^Speaker \d+$/i
  ];
  
  return technicalPatterns.some(pattern => pattern.test(speaker.trim()));
}

/**
 * Check if a name looks like a valid person name
 */
function isValidPersonName(name: string): boolean {
  // Basic validation for person names
  if (name.length < 2 || name.length > 20) return false;
  if (!/^[A-Z][a-zA-Z]*$/.test(name)) return false;
  
  // Exclude common non-names
  const commonWords = [
    'The', 'And', 'But', 'For', 'Not', 'You', 'All', 'Can', 'Had', 'Her', 'Was', 'One', 'Our', 'Out', 'Day', 'Get', 'Has', 'Him', 'His', 'How', 'Man', 'New', 'Now', 'Old', 'See', 'Two', 'Who', 'Boy', 'Did', 'Its', 'Let', 'Put', 'Say', 'She', 'Too', 'Use', 'Way', 'May', 'Come', 'Could', 'Time', 'Very', 'When', 'Much', 'Good', 'Well', 'Just', 'First', 'Right', 'Think', 'Make', 'Work', 'Life', 'Only', 'Over', 'After', 'Back', 'Other', 'Many', 'Than', 'Then', 'Them', 'These', 'So', 'Some', 'Her', 'Would', 'There', 'What', 'Up', 'Year', 'Your', 'Want', 'Look', 'Use', 'Her', 'New', 'Go', 'My', 'Could', 'No', 'More', 'If', 'Out', 'So', 'What', 'Time', 'Up', 'Go', 'About', 'Than', 'Into', 'Could', 'State', 'Only', 'New', 'Year', 'Work', 'Take', 'Come', 'These', 'Know', 'See', 'Use', 'Its', 'How', 'Water', 'Than', 'Call', 'First', 'Who', 'Its', 'Now', 'Find', 'Long', 'Down', 'Day', 'Did', 'Get', 'Come', 'Made', 'May', 'Part'
  ];
  
  return !commonWords.includes(name);
}

/**
 * Calculate importance of a speaker based on frequency and content
 */
function calculateImportance(frequency: number, turns: ConversationTurn[]): 'high' | 'medium' | 'low' {
  const totalContent = turns.reduce((acc, turn) => acc + turn.content.length, 0);
  const avgContentLength = totalContent / turns.length;
  
  // High importance: frequent speaker with substantial content
  if (frequency >= 5 && avgContentLength > 50) return 'high';
  
  // Medium importance: moderate frequency or good content
  if (frequency >= 3 || avgContentLength > 100) return 'medium';
  
  return 'low';
}

/**
 * Determine if we should ask user for identity resolution
 */
function shouldAskForIdentityResolution(
  uncertainMappings: UncertainMapping[],
  turns: ConversationTurn[]
): 'ask_user' | 'auto_resolve' | 'skip' {
  
  const highImportanceCount = uncertainMappings.filter(m => m.importance === 'high').length;
  const mediumImportanceCount = uncertainMappings.filter(m => m.importance === 'medium').length;
  const totalMappings = uncertainMappings.length;
  
  // Ask if we have high-value mappings
  if (highImportanceCount >= 1) return 'ask_user';
  if (mediumImportanceCount >= 2) return 'ask_user';
  if (totalMappings >= 4) return 'ask_user';
  
  // Check for strategic content keywords
  const hasStrategicContent = turns.some(turn => {
    const content = turn.content.toLowerCase();
    return ['performance', 'promotion', 'feedback', 'concern', 'issue', 'decision', 'strategy', 'conflict', 'improvement', 'goal', 'problem', 'challenge'].some(keyword => content.includes(keyword));
  });
  
  if (hasStrategicContent && totalMappings >= 2) return 'ask_user';
  
  return 'skip';
}

/**
 * Generate user-friendly questions for identity resolution
 */
async function generateIdentityQuestions(
  uncertainMappings: UncertainMapping[],
  existingPeople: any[]
): Promise<IdentityQuestion[]> {
  
  const questions: IdentityQuestion[] = [];
  
  // Sort by importance and frequency
  const sortedMappings = uncertainMappings
    .sort((a, b) => {
      const importanceScore = { high: 3, medium: 2, low: 1 };
      return (importanceScore[b.importance] * 10 + b.frequency) - (importanceScore[a.importance] * 10 + a.frequency);
    })
    .slice(0, 4); // Limit to 4 questions max

  for (const [index, mapping] of sortedMappings.entries()) {
    const questionId = `identity-${index}`;
    
    if (mapping.possibleNames.length === 1) {
      // Single candidate - confirmation question
      questions.push({
        id: questionId,
        type: 'confirmation',
        question: `Is "${mapping.technicalId}" actually ${mapping.possibleNames[0]}?`,
        context: `They said: "${mapping.context.substring(0, 150)}${mapping.context.length > 150 ? '...' : ''}"`,
        importance: mapping.importance,
        technicalId: mapping.technicalId
      });
      
    } else if (mapping.possibleNames.length > 1) {
      // Multiple candidates - multiple choice
      questions.push({
        id: questionId,
        type: 'multiple_choice',
        question: `Who is "${mapping.technicalId}" in this conversation?`,
        options: [...mapping.possibleNames, 'Someone else (I\'ll type the name)', 'Skip this person'],
        context: `They said: "${mapping.context.substring(0, 150)}${mapping.context.length > 150 ? '...' : ''}"`,
        importance: mapping.importance,
        technicalId: mapping.technicalId
      });
      
    } else {
      // No candidates - open question
      questions.push({
        id: questionId,
        type: 'direct_mapping',
        question: `Who is "${mapping.technicalId}"? (This person spoke ${mapping.frequency} times)`,
        context: `They said: "${mapping.context.substring(0, 150)}${mapping.context.length > 150 ? '...' : ''}"`,
        importance: mapping.importance,
        technicalId: mapping.technicalId
      });
    }
  }
  
  return questions;
}

/**
 * Consolidate identity mappings to resolve conflicts
 */
function consolidateIdentityMappings(mappings: IdentityMapping[]): IdentityMapping[] {
  const consolidated: IdentityMapping[] = [];
  const seenTechnicalIds = new Set<string>();
  const seenResolvedNames = new Set<string>();
  
  // Sort by confidence descending
  const sortedMappings = mappings.sort((a, b) => b.confidence - a.confidence);
  
  for (const mapping of sortedMappings) {
    // Skip if we've already mapped this technical ID or resolved name
    if (seenTechnicalIds.has(mapping.technicalId) || seenResolvedNames.has(mapping.resolvedName)) {
      continue;
    }
    
    consolidated.push(mapping);
    seenTechnicalIds.add(mapping.technicalId);
    seenResolvedNames.add(mapping.resolvedName);
  }
  
  return consolidated;
}

/**
 * Apply identity mappings to transcript content
 */
function applyIdentityMappings(transcript: string, mappings: IdentityMapping[]): string {
  let processedTranscript = transcript;
  
  for (const mapping of mappings) {
    // Replace "Meeting Room B:" with "Mike:" throughout transcript
    const regex = new RegExp(`^${escapeRegex(mapping.technicalId)}:`, 'gm');
    processedTranscript = processedTranscript.replace(regex, `${mapping.resolvedName}:`);
    
    console.log('🔍 Applied identity mapping:', mapping.technicalId, '→', mapping.resolvedName);
  }
  
  return processedTranscript;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}