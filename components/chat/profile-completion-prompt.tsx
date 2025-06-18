'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Person } from '@/types/database'

interface ProfileCompletionPromptProps {
  personId: string;
  personName: string;
  prompt: {
    field: string;
    prompt: string;
    examples?: string[];
  };
  onComplete: (field: string, value: string) => void;
  onDismiss: () => void;
}

interface ProfileCompletenessProps {
  person: Person;
  showPercentage?: boolean;
}

interface PersonSetupChatHeaderProps {
  person: Person;
  chatId: string;
  onEditProfile: () => void;
}

// Profile completeness indicator component
export function ProfileCompleteness({ person, showPercentage = true }: ProfileCompletenessProps) {
  const requiredFields = ['role', 'relationship_type'];
  const optionalFields = ['team', 'location', 'notes'];
  const allFields = [...requiredFields, ...optionalFields];
  
  const completedFields = allFields.filter(field => {
    const value = person[field as keyof Person];
    return value !== null && value !== undefined && value !== '';
  });
  
  const percentage = Math.round((completedFields.length / allFields.length) * 100);
  const isComplete = requiredFields.every(field => {
    const value = person[field as keyof Person];
    return value !== null && value !== undefined && value !== '';
  });
  
  return (
    <div className="profile-completeness">
      {showPercentage && (
        <span className={`percentage ${isComplete ? 'complete' : 'incomplete'}`}>
          {percentage}% complete
        </span>
      )}
      <div className="progress-bar">
        <div 
          className={`progress ${isComplete ? 'complete' : 'incomplete'}`}
          style={{width: `${percentage}%`}}
        />
      </div>
    </div>
  );
}

// Enhanced chat header for person setup chats
export function PersonSetupChatHeader({ person, chatId, onEditProfile }: PersonSetupChatHeaderProps) {
  return (
    <div className="person-setup-chat-header">
      <div className="person-info">
        <h2 className="person-name">{person.name}</h2>
        <div className="person-details">
          {person.role && <span className="person-role">{person.role}</span>}
          {person.team && <span className="person-team">at {person.team}</span>}
        </div>
        <ProfileCompleteness person={person} />
      </div>
      
      <div className="header-actions">
        <button 
          onClick={onEditProfile}
          className="edit-profile-btn"
          title="Edit profile details"
        >
          ✏️ Edit Profile
        </button>
      </div>
    </div>
  );
}

export default function ProfileCompletionPrompt({
  personId,
  personName,
  prompt,
  onComplete,
  onDismiss
}: ProfileCompletionPromptProps) {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const handleSubmit = async () => {
    if (!value.trim()) return;

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('people')
        .update({ 
          [prompt.field]: value.trim(),
          last_profile_prompt: new Date().toISOString()
        })
        .eq('id', personId);

      if (error) throw error;

      onComplete(prompt.field, value.trim());
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setValue(example);
  };

  return (
    <div className="profile-completion-prompt">
      <div className="profile-completion-header">
        <div className="profile-completion-emoji">💡</div>
        <div className="profile-completion-content">
          <div className="profile-completion-title">
            Complete {personName}'s Profile
          </div>
          <div className="profile-completion-question">
            {prompt.prompt}
          </div>
        </div>
      </div>

      <div className="profile-completion-input-section">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter your response..."
          className="profile-completion-textarea"
          rows={3}
        />

        {prompt.examples && prompt.examples.length > 0 && (
          <div className="profile-completion-examples">
            <label className="profile-completion-examples-label">
              Quick options:
            </label>
            <div className="profile-completion-examples-list">
              {prompt.examples.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(example)}
                  className="profile-completion-example-btn"
                  type="button"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="profile-completion-actions">
        <button
          onClick={onDismiss}
          disabled={isSubmitting}
          className="profile-completion-btn profile-completion-btn--secondary"
        >
          Skip for now
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !value.trim()}
          className="profile-completion-btn profile-completion-btn--primary"
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
} 