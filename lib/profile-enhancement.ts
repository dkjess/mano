import { createClient } from '@/lib/supabase/client'
import { analyzeProfileCompleteness, shouldPromptForCompletion, ProfileSuggestion } from './profile-completeness'

export interface ProfileEnhancementResult {
  shouldPrompt: boolean;
  suggestion?: ProfileSuggestion;
  completenessScore: number;
}

export class ProfileEnhancementService {
  constructor(private supabase = createClient()) {}

  async checkIfProfileNeedsCompletion(
    personId: string,
    userId: string
  ): Promise<ProfileEnhancementResult> {
    // Get person details
    const { data: person } = await this.supabase
      .from('people')
      .select('*')
      .eq('id', personId)
      .eq('user_id', userId)
      .single();

    if (!person) {
      return { shouldPrompt: false, completenessScore: 0 };
    }

    // Get conversation count for this person
    const { count: conversationCount } = await this.supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', personId);

    // Analyze completeness
    const completeness = analyzeProfileCompleteness(person);
    
    // Check if we should prompt
    const shouldPrompt = shouldPromptForCompletion(
      person,
      conversationCount || 0,
      person.last_profile_prompt
    );

    // Update completeness score in database
    await this.supabase
      .from('people')
      .update({ profile_completion_score: completeness.score })
      .eq('id', personId);

    return {
      shouldPrompt,
      suggestion: shouldPrompt ? completeness.suggestions[0] : undefined,
      completenessScore: completeness.score
    };
  }

  async updateProfileField(
    personId: string,
    field: string,
    value: string,
    userId: string
  ): Promise<boolean> {
    try {
      const updateData: any = { [field]: value };
      
      // If this was prompted, update the last prompt date
      updateData.last_profile_prompt = new Date().toISOString();

      const { error } = await this.supabase
        .from('people')
        .update(updateData)
        .eq('id', personId)
        .eq('user_id', userId);

      if (error) throw error;

      // Recalculate and update completeness score
      const { data: updatedPerson } = await this.supabase
        .from('people')
        .select('*')
        .eq('id', personId)
        .eq('user_id', userId)
        .single();

      if (updatedPerson) {
        const completeness = analyzeProfileCompleteness(updatedPerson);
        await this.supabase
          .from('people')
          .update({ profile_completion_score: completeness.score })
          .eq('id', personId);
      }

      return true;
    } catch (error) {
      console.error('Error updating profile field:', error);
      return false;
    }
  }

  extractValueFromMessage(message: string, field: string): string | null {
    // Simple extraction patterns - could be enhanced with AI
    const lowerMessage = message.toLowerCase();
    
    switch (field) {
      case 'role':
        // Look for role indicators
        const rolePatterns = [
          /(?:is a|is an|works as|job title is|role is)\s+([^,.!?]+)/i,
          /(?:he|she|they)(?:'s| is)\s+(?:a |an )?([^,.!?]+?)(?:\s+at|\s+in|$)/i
        ];
        
        for (const pattern of rolePatterns) {
          const match = message.match(pattern);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
        break;
        
      case 'team':
        const teamPatterns = [
          /(?:on the|in the|part of|works in)\s+([^,.!?]+?)\s+team/i,
          /(?:team is|department is)\s+([^,.!?]+)/i
        ];
        
        for (const pattern of teamPatterns) {
          const match = message.match(pattern);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
        break;
        
      case 'notes':
        // For notes, use the whole message if it's descriptive
        if (message.length > 10 && message.length < 200) {
          return message.trim();
        }
        break;
    }
    
    return null;
  }

  async getProfileAnalytics(userId: string): Promise<any> {
    try {
      const { data } = await this.supabase
        .from('people_profile_analytics')
        .select('*')
        .eq('user_id', userId)
        .single();

      return data;
    } catch (error) {
      console.error('Error fetching profile analytics:', error);
      return null;
    }
  }

  async getIncompleteProfiles(userId: string, limit: number = 5): Promise<any[]> {
    try {
      const { data } = await this.supabase
        .from('people')
        .select('id, name, role, relationship_type, profile_completion_score')
        .eq('user_id', userId)
        .lt('profile_completion_score', 80)
        .order('profile_completion_score', { ascending: true })
        .limit(limit);

      return data || [];
    } catch (error) {
      console.error('Error fetching incomplete profiles:', error);
      return [];
    }
  }
} 