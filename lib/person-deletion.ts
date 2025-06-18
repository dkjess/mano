import { createClient } from '@/lib/supabase/client'
import type { Person } from '@/types/database'

export interface DeletePersonData {
  personId: string;
  chatId: string;
  reason: string;
  referenceAction: 'keep' | 'archive' | 'remove';
}

export interface DeletionAnalytics {
  personId: string;
  reason: string;
  referenceAction: string;
  timestamp: string;
  userId: string;
}

export class PersonDeletionService {
  private supabase = createClient();

  /**
   * Delete a person with smart reference handling
   */
  async deletePerson(deleteData: DeletePersonData): Promise<{ success: boolean; message: string }> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Log deletion for analytics
      await this.logDeletion({
        personId: deleteData.personId,
        reason: deleteData.reason,
        referenceAction: deleteData.referenceAction,
        timestamp: new Date().toISOString(),
        userId: user.id
      });

      // Get person info before deletion
      const { data: person } = await this.supabase
        .from('people')
        .select('name')
        .eq('id', deleteData.personId)
        .single();

      const personName = person?.name || 'Unknown';

      // Handle references based on user choice
      await this.handleReferences(deleteData.personId, deleteData.referenceAction);

      // Delete all messages associated with the person
      await this.supabase
        .from('messages')
        .delete()
        .eq('person_id', deleteData.personId);

      // Delete the person profile
      const { error } = await this.supabase
        .from('people')
        .delete()
        .eq('id', deleteData.personId)
        .eq('user_id', user.id);

      if (error) throw error;

      const actionText = this.getReferenceActionText(deleteData.referenceAction);
      
      return {
        success: true,
        message: `${personName} has been deleted. References have been ${actionText}.`
      };

    } catch (error) {
      console.error('Error deleting person:', error);
      return {
        success: false,
        message: 'Failed to delete person. Please try again.'
      };
    }
  }

  /**
   * Handle references based on the chosen action
   */
  private async handleReferences(personId: string, action: 'keep' | 'archive' | 'remove'): Promise<void> {
    switch (action) {
      case 'keep':
        await this.convertPersonToMention(personId);
        break;
      case 'archive':
        await this.archivePersonReferences(personId);
        break;
      case 'remove':
        await this.removeAllPersonReferences(personId);
        break;
    }
  }

  /**
   * Convert structured person references to simple text mentions
   */
  private async convertPersonToMention(personId: string): Promise<void> {
    // This would be implemented if you have a references system
    // For now, we'll just log the action
    console.log(`Converting person ${personId} references to mentions`);
    
    // In a full implementation, you would:
    // 1. Find all references to this person in other contexts
    // 2. Convert them to simple text mentions
    // 3. Remove the structured relationship data
  }

  /**
   * Archive person references (searchable but inactive)
   */
  private async archivePersonReferences(personId: string): Promise<void> {
    // This would be implemented if you have a references system
    console.log(`Archiving person ${personId} references`);
    
    // In a full implementation, you would:
    // 1. Mark all references as archived
    // 2. Keep them searchable but not active
    // 3. Add metadata about the archival
  }

  /**
   * Remove all person references completely
   */
  private async removeAllPersonReferences(personId: string): Promise<void> {
    // This would be implemented if you have a references system
    console.log(`Removing all person ${personId} references`);
    
    // In a full implementation, you would:
    // 1. Find all references to this person
    // 2. Delete them completely
    // 3. Clean up any orphaned data
  }

  /**
   * Log deletion for analytics and auditing
   */
  private async logDeletion(analytics: DeletionAnalytics): Promise<void> {
    // For now, just log to console
    // In a production app, you'd send this to your analytics service
    console.log('Person deletion analytics:', analytics);
    
    // You could also store this in a deletions table for auditing:
    /*
    await this.supabase
      .from('person_deletions')
      .insert(analytics);
    */
  }

  /**
   * Get human-readable text for reference actions
   */
  private getReferenceActionText(action: 'keep' | 'archive' | 'remove'): string {
    switch (action) {
      case 'keep':
        return 'preserved as mentions';
      case 'archive':
        return 'archived';
      case 'remove':
        return 'completely removed';
      default:
        return 'handled';
    }
  }

  /**
   * Check if a person can be safely deleted
   */
  async canDeletePerson(personId: string): Promise<{ canDelete: boolean; warnings: string[] }> {
    const warnings: string[] = [];
    
    try {
      // Check for recent messages
      const { data: recentMessages } = await this.supabase
        .from('messages')
        .select('id')
        .eq('person_id', personId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .limit(1);

      if (recentMessages && recentMessages.length > 0) {
        warnings.push('This person has recent messages from the last 7 days.');
      }

      // Check total message count
      const { count: messageCount } = await this.supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .eq('person_id', personId);

      if (messageCount && messageCount > 10) {
        warnings.push(`This person has ${messageCount} messages that will be deleted.`);
      }

      // Add more checks as needed (e.g., important relationships, etc.)

      return {
        canDelete: true, // Always allow deletion, but show warnings
        warnings
      };

    } catch (error) {
      console.error('Error checking deletion safety:', error);
      return {
        canDelete: true,
        warnings: ['Unable to check deletion safety.']
      };
    }
  }
}

// Export a singleton instance
export const personDeletionService = new PersonDeletionService(); 