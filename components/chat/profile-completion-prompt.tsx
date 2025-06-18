'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
        <span className="profile-completion-emoji">📝</span>
        <div className="profile-completion-content">
          <h3 className="profile-completion-title">Help me understand {personName} better</h3>
          <p className="profile-completion-question">{prompt.prompt}</p>
        </div>
      </div>

      <div className="profile-completion-input-section">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Tell me more..."
          className="profile-completion-textarea"
          rows={3}
        />

        {prompt.examples && prompt.examples.length > 0 && (
          <div className="profile-completion-examples">
            <span className="profile-completion-examples-label">Examples:</span>
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
          className="profile-completion-btn profile-completion-btn--secondary"
          disabled={isSubmitting}
        >
          Skip for now
        </button>
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isSubmitting}
          className="profile-completion-btn profile-completion-btn--primary"
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
} 