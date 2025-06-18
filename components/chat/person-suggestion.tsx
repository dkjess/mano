'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DetectedPerson } from '@/lib/person-detection'

interface PersonSuggestionProps {
  detectedPeople: DetectedPerson[];
  onPersonAdded: (person: any) => void;
  onDismiss: () => void;
}

export default function PersonSuggestion({ 
  detectedPeople, 
  onPersonAdded, 
  onDismiss 
}: PersonSuggestionProps) {
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const supabase = createClient();

  const handleAddPerson = async (detectedPerson: DetectedPerson) => {
    setIsAdding(detectedPerson.name);
    
    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('people')
        .insert({
          name: detectedPerson.name,
          role: detectedPerson.role || null,
          relationship_type: detectedPerson.relationshipType || 'peer',
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      onPersonAdded(data);
    } catch (error) {
      console.error('Error adding person:', error);
      alert('Failed to add person. Please try again.');
    } finally {
      setIsAdding(null);
    }
  };

  if (detectedPeople.length === 0) return null;

  const primaryPerson = detectedPeople[0];
  const hasMultiple = detectedPeople.length > 1;

  return (
    <div className="person-suggestion">
      <div className="person-suggestion-content">
        <span className="person-suggestion-emoji">👤</span>
        <div className="person-suggestion-text">
          <span className="person-suggestion-message">
            Add <strong>{primaryPerson.name}</strong>
            {primaryPerson.role && ` (${primaryPerson.role})`}
            {hasMultiple && ` and ${detectedPeople.length - 1} other${detectedPeople.length > 2 ? 's' : ''}`}
            {' '}to your team?
          </span>
        </div>
      </div>
      
      <div className="person-suggestion-actions">
        {hasMultiple ? (
          <>
            <button
              onClick={() => handleAddPerson(primaryPerson)}
              disabled={isAdding !== null}
              className="person-suggestion-btn person-suggestion-btn--primary"
            >
              {isAdding === primaryPerson.name ? 'Adding...' : `Add ${primaryPerson.name}`}
            </button>
            <button
              onClick={() => {
                // TODO: Show expanded view for multiple people
                console.log('Show all detected people:', detectedPeople);
              }}
              disabled={isAdding !== null}
              className="person-suggestion-btn person-suggestion-btn--secondary"
            >
              Add All ({detectedPeople.length})
            </button>
          </>
        ) : (
          <button
            onClick={() => handleAddPerson(primaryPerson)}
            disabled={isAdding !== null}
            className="person-suggestion-btn person-suggestion-btn--primary"
          >
            {isAdding === primaryPerson.name ? 'Adding...' : 'Add'}
          </button>
        )}
        
        <button
          onClick={onDismiss}
          disabled={isAdding !== null}
          className="person-suggestion-btn person-suggestion-btn--dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
} 