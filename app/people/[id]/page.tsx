"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Person } from '@/types/database';
import { usePeople } from '@/lib/contexts/people-context';
import { useUnifiedConversation } from '@/lib/hooks/useUnifiedConversation';
import { ConversationContainer } from '@/components/conversation/ConversationContainer';
import PersonSuggestion from '@/components/chat/person-suggestion';
import ProfileCompletionPrompt from '@/components/chat/profile-completion-prompt';
import ProfileEditForm from '@/components/profile-edit-form';
import PersonEditMenu from '@/components/person-edit-menu';

export default function PersonDetailPage() {
  const params = useParams();
  const personId = params.id as string;
  
  // Use context and unified conversation hook
  const { people, getPerson, updatePerson, addPerson, deletePerson } = usePeople();
  const {
    conversation: person,
    messages,
    isLoading: conversationLoading,
    error,
    sendMessage,
    refreshMessages,
    refreshConversation: refreshPerson
  } = useUnifiedConversation(personId, 'person');

  // Person-specific state
  const [loading, setLoading] = useState(false); // Only for initial person setup
  const [personSuggestion, setPersonSuggestion] = useState<{detectedPeople: any[]} | null>(null);
  const [profilePrompt, setProfilePrompt] = useState<any>(null);
  const [showProfileEditForm, setShowProfileEditForm] = useState(false);
  const [showPersonEditMenu, setShowPersonEditMenu] = useState(false);

  // Reset component state when personId changes
  useEffect(() => {
    setPersonSuggestion(null);
    setProfilePrompt(null);
    setShowProfileEditForm(false);
    setShowPersonEditMenu(false);
  }, [personId]);

  // Profile completion handlers
  const handleProfileComplete = (field: string, value: string) => {
    console.log('Profile field completed:', field, value);
    setProfilePrompt(null);
    // The profile update is already handled by the ProfileCompletionPrompt component
  };

  const handleProfileDismiss = () => {
    console.log('Profile prompt dismissed');
    setProfilePrompt(null);
  };

  // Person suggestion handlers
  const handlePersonAdded = (newPerson: Person) => {
    console.log('New person added:', newPerson);
    setPersonSuggestion(null);
    addPerson(newPerson);
  };

  const handleDismissSuggestion = () => {
    console.log('Person suggestion dismissed');
    setPersonSuggestion(null);
  };

  // Server-side intelligence handlers
  const handleServerPersonSuggestions = (suggestions: any[]) => {
    console.log('🧠 SERVER: Person suggestions received:', suggestions);
    if (suggestions && suggestions.length > 0) {
      setPersonSuggestion({ detectedPeople: suggestions });
    }
  };

  const handleServerProfileCompletion = (prompt: any) => {
    console.log('🧠 SERVER: Profile completion prompt received:', prompt);
    if (prompt) {
      setProfilePrompt(prompt);
    }
  };

  // Profile edit handlers
  const handleOpenProfileForm = () => {
    setShowProfileEditForm(true);
  };

  const handleCloseProfileForm = () => {
    setShowProfileEditForm(false);
  };

  // Person edit menu handlers
  const handleOpenPersonEditMenu = () => {
    setShowPersonEditMenu(true);
  };

  const handleClosePersonEditMenu = () => {
    setShowPersonEditMenu(false);
  };

  const handlePersonUpdated = (updatedPerson: Person) => {
    updatePerson(updatedPerson);
    refreshPerson(); // Refresh the conversation data too
  };

  const handlePersonDeleted = () => {
    if (person) {
      deletePerson((person as Person).id);
    }
  };

  // Helper functions
  const getRelationshipEmoji = (relationshipType: string) => {
    switch (relationshipType) {
      case 'direct_report': return '👥';
      case 'manager': return '👆';
      case 'stakeholder': return '🤝';
      case 'peer': return '👋';
      default: return '🙋';
    }
  };

  const getRelationshipLabel = (relationshipType: string) => {
    switch (relationshipType) {
      case 'direct_report': return 'Direct Report';
      case 'manager': return 'Manager';
      case 'stakeholder': return 'Stakeholder';
      case 'peer': return 'Peer';
      default: return relationshipType;
    }
  };

  if (loading || conversationLoading) {
    return (
      <div className="loading-state">
        <div className="loading-emoji">🤲</div>
        <div className="loading-text">Loading conversation...</div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="empty-state">
        <div className="empty-state-emoji">🤷</div>
        <h3 className="empty-state-title">Person not found</h3>
        <p className="empty-state-subtitle">
          {error || 'This person may have been deleted or you may not have access to them.'}
        </p>
        <Link href="/conversations" className="add-person-button">
          👈 Back to Conversations
        </Link>
      </div>
    );
  }

  const personData = person as Person;

  // Special components for person conversations
  const specialComponents = (
    <>
      {personSuggestion && (
        <PersonSuggestion
          detectedPeople={personSuggestion.detectedPeople}
          onPersonAdded={handlePersonAdded}
          onDismiss={handleDismissSuggestion}
        />
      )}

      {profilePrompt && (
        <ProfileCompletionPrompt
          personId={personData.id}
          personName={personData.name}
          prompt={profilePrompt}
          onComplete={handleProfileComplete}
          onDismiss={handleProfileDismiss}
        />
      )}
    </>
  );

  return (
    <>
      <ConversationContainer
        conversationId={personId}
        conversationType="person"
        header={{
          title: `${getRelationshipEmoji(personData.relationship_type)} ${personData.name}`,
          subtitle: getRelationshipLabel(personData.relationship_type),
          rightAction: (
            <PersonEditMenu
              person={personData}
              onEdit={handleOpenProfileForm}
              onUpdate={handlePersonUpdated}
              onDelete={handlePersonDeleted}
            />
          )
        }}
        features={{
          fileAttachments: true,
          profileManagement: true,
          personSuggestions: true
        }}
        messages={messages}
        isLoading={conversationLoading}
        onSendMessage={sendMessage}
        onRefreshMessages={refreshMessages}
        specialComponents={specialComponents}
        onPersonSuggestions={handleServerPersonSuggestions}
        onProfileCompletion={handleServerProfileCompletion}
      />

      {/* Profile Edit Form Modal */}
      {showProfileEditForm && (
        <ProfileEditForm
          person={personData}
          onSave={handlePersonUpdated}
          onClose={handleCloseProfileForm}
        />
      )}

      {/* Person Edit Menu Modal */}
      {showPersonEditMenu && (
        <PersonEditMenu
          person={personData}
          onEdit={handleOpenProfileForm}
          onUpdate={handlePersonUpdated}
          onDelete={handlePersonDeleted}
        />
      )}
    </>
  );
}