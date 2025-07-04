import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface UserProfile {
  id: string;
  user_id: string;
  preferred_name: string | null;
  call_name: string | null;
  job_role: string | null;
  company: string | null;
  onboarding_completed: boolean;
  onboarding_step: string | number;
  created_at: string;
  updated_at: string;
}

export interface OnboardingContext {
  isNewUser: boolean;
  currentStep: string;
  hasPreferredName: boolean;
  teamMemberCount: number;
  conversationCount: number;
}

export class OnboardingService {
  constructor(private supabase: SupabaseClient) {}

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  }

  async getOnboardingContext(userId: string): Promise<OnboardingContext> {
    const [profile, peopleCount, messageCount] = await Promise.all([
      this.getUserProfile(userId),
      this.getTeamMemberCount(userId),
      this.getConversationCount(userId)
    ]);

    const isNewUser = !profile?.onboarding_completed && messageCount === 0;

    return {
      isNewUser,
      currentStep: profile?.onboarding_step || 'welcome',
      hasPreferredName: !!profile?.preferred_name,
      teamMemberCount: peopleCount,
      conversationCount: messageCount
    };
  }

  async updatePreferredName(userId: string, name: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        preferred_name: name,
        onboarding_step: 'team_building'
      });

    if (error) {
      console.error('Error updating preferred name:', error);
    }
  }

  async updateOnboardingStep(userId: string, step: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_profiles')
      .update({
        onboarding_step: step,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating onboarding step:', error);
    }
  }

  async completeOnboarding(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_profiles')
      .update({
        onboarding_completed: true,
        onboarding_step: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error completing onboarding:', error);
    }
  }

  async shouldCompleteOnboarding(userId: string): Promise<boolean> {
    const context = await this.getOnboardingContext(userId);
    
    // Complete onboarding if user has:
    // 1. Set a preferred name
    // 2. Added at least one team member
    // 3. Had at least 3 meaningful exchanges
    return context.hasPreferredName && 
           context.teamMemberCount >= 1 && 
           context.conversationCount >= 6; // 3 exchanges = 6 messages
  }

  private async getTeamMemberCount(userId: string): Promise<number> {
    const { count } = await this.supabase
      .from('people')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return count || 0;
  }

  private async getConversationCount(userId: string): Promise<number> {
    const { count } = await this.supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return count || 0;
  }

  extractNameFromMessage(message: string): string | null {
    // Simple name extraction patterns
    const patterns = [
      /call me (\w+)/i,
      /i'm (\w+)/i,
      /my name is (\w+)/i,
      /just (\w+)/i,
      /(\w+) is fine/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const name = match[1].toLowerCase();
        // Skip common non-names
        if (!['just', 'call', 'fine', 'good'].includes(name)) {
          return this.capitalizeFirstLetter(name);
        }
      }
    }

    // If message is short and looks like a name
    const words = message.trim().split(/\s+/);
    if (words.length === 1 && words[0].length > 2 && words[0].length < 15) {
      const word = words[0].toLowerCase();
      if (!['yes', 'no', 'ok', 'okay', 'sure', 'thanks'].includes(word)) {
        return this.capitalizeFirstLetter(word);
      }
    }

    return null;
  }

  detectTeamMemberMention(message: string): Array<{
    name: string;
    role?: string;
    relationship?: string;
  }> {
    const mentions: Array<{
      name: string;
      role?: string;
      relationship?: string;
    }> = [];

    // Pattern: "I manage Alex and Jordan"
    const managePattern = /I manage (\w+)(?: and (\w+))?/i;
    const manageMatch = message.match(managePattern);
    if (manageMatch) {
      mentions.push({
        name: this.capitalizeFirstLetter(manageMatch[1]),
        relationship: 'direct_report'
      });
      if (manageMatch[2]) {
        mentions.push({
          name: this.capitalizeFirstLetter(manageMatch[2]),
          relationship: 'direct_report'
        });
      }
    }

    // Pattern: "My team: Alex (developer), Jordan (designer)"
    const teamPattern = /(\w+)\s*\(([^)]+)\)/g;
    let teamMatch;
    while ((teamMatch = teamPattern.exec(message)) !== null) {
      mentions.push({
        name: this.capitalizeFirstLetter(teamMatch[1]),
        role: teamMatch[2].trim(),
        relationship: 'direct_report'
      });
    }

    // Pattern: "Alex and Jordan are developers"
    const rolePattern = /(\w+)(?: and (\w+))? (?:are?|is) (\w+)/i;
    const roleMatch = message.match(rolePattern);
    if (roleMatch) {
      mentions.push({
        name: this.capitalizeFirstLetter(roleMatch[1]),
        role: roleMatch[3]
      });
      if (roleMatch[2]) {
        mentions.push({
          name: this.capitalizeFirstLetter(roleMatch[2]),
          role: roleMatch[3]
        });
      }
    }

    return mentions;
  }

  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
} 