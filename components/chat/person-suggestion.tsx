'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DetectedPerson } from '@/lib/person-detection'

interface PersonSuggestionProps {
  detectedPeople: DetectedPerson[];
  onPersonAdded: (person: any) => void;
  onDismiss: () => void;
}

// Simple name input component for quick person creation
function SimpleNamePrompt({ 
  suggestedName = "", 
  onConfirm, 
  onCancel 
}: { 
  suggestedName?: string; 
  onConfirm: (name: string) => void; 
  onCancel: () => void;
}) {
  const [name, setName] = useState(suggestedName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
    }
  };

  return (
    <div className="person-suggestion">
      <div className="person-suggestion-content">
        <span className="person-suggestion-emoji">👤</span>
        <div className="person-suggestion-text">
          <form onSubmit={handleSubmit} className="inline-prompt">
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Person's name"
              className="person-name-input"
              autoFocus
            />
            <button 
              type="submit"
              disabled={!name.trim()}
              className="person-suggestion-btn person-suggestion-btn--primary"
            >
              Add Person
            </button>
          </form>
        </div>
      </div>
      
      <div className="person-suggestion-actions">
        <button
          onClick={onCancel}
          className="person-suggestion-btn person-suggestion-btn--dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function PersonSuggestion({ 
  detectedPeople, 
  onPersonAdded, 
  onDismiss 
}: PersonSuggestionProps) {
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Create a new person and start conversational profiling
  const createPersonProfileChat = async (personName: string) => {
    setIsCreating(true);
    
    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Create the person through the API to ensure server-side logic runs
      console.log('🟣 PersonSuggestion: Creating person via API:', personName);
      const response = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: personName,
          role: null,
          relationship_type: 'peer' // Default, will be updated through conversation
        })
      });
      console.log('🟣 PersonSuggestion: API response status:', response.status);

      if (!response.ok) {
        throw new Error('Failed to create person');
      }

      const { person } = await response.json();

      // Notify parent component
      onPersonAdded(person);
      
      // Navigate to the new person's chat to continue profiling
      router.push(`/people/${person.id}`);
      
    } catch (error) {
      console.error('Error creating person profile chat:', error);
      alert('Failed to create person. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Generate initial profiling message
  const generateInitialProfileMessage = (personName: string): string => {
    return `Great! I've added ${personName} to your team. Let me help you get immediate value from this profile.

**Quick Setup (30 seconds):**
Let's gather just enough context to make our first conversation useful.

1️⃣ **Their role**: What's ${personName}'s job title?
2️⃣ **Your relationship**: Is ${personName} your direct report, peer, manager, or other stakeholder?
3️⃣ **Current situation**: What's the most important thing happening with ${personName} right now? (e.g., "struggling with new responsibilities", "high performer wanting growth", "difficult relationship")

You can answer all three in one message - keep it brief! I'll use this to give you immediate, actionable insights.`;
  };

  if (detectedPeople.length === 0) return null;

  const primaryPerson = detectedPeople[0];

  return (
    <SimpleNamePrompt
      suggestedName={primaryPerson.name}
      onConfirm={createPersonProfileChat}
      onCancel={onDismiss}
    />
  );
} 