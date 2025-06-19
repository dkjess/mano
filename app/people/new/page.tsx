"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePeople } from '@/lib/contexts/people-context';
import Link from 'next/link';

type Step = 'name' | 'role' | 'relationship' | 'context' | 'complete';

export default function NewPersonPage() {
  const router = useRouter();
  const { addPerson } = usePeople();
  const [step, setStep] = useState<Step>('name');
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    relationship_type: '',
    context: ''
  });
  const [loading, setLoading] = useState(false);

  // Reset form when component mounts to prevent stale data
  useEffect(() => {
    setFormData({
      name: '',
      role: '',
      relationship_type: '',
      context: ''
    });
    setStep('name');
    setLoading(false);
  }, []);

  const createPerson = async (includeContext: boolean = true) => {
    if (!formData.name || !formData.relationship_type || loading) return;
    
    // Additional validation to prevent corrupted submissions
    const trimmedName = formData.name.trim();
    const trimmedRole = formData.role.trim();
    
    // Prevent submission with UI text fragments or invalid names
    if (trimmedName.length < 2 || 
        ['And', 'and', 'in', 'In', 'is', 'Is', 'your', 'Your'].includes(trimmedName) ||
        trimmedName.includes('is your') ||
        trimmedName.includes('And ')) {
      console.error('Invalid name detected:', trimmedName);
      alert('Please enter a valid name (at least 2 characters, not UI text)');
      return;
    }
    
    // Prevent submission with UI text fragments in role
    if (trimmedRole && ['in', 'In', 'is', 'Is', 'your', 'Your', 'And', 'and'].includes(trimmedRole)) {
      console.error('Invalid role detected:', trimmedRole);
      alert('Please enter a valid role or leave it empty');
      return;
    }
    
    setLoading(true);
    
    console.log('Creating person with validated data:', {
      name: trimmedName,
      role: trimmedRole || null,
      relationship_type: formData.relationship_type
    });
    
    try {
      const response = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          role: trimmedRole || null,
          relationship_type: formData.relationship_type
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Add person to context to avoid refetching
        addPerson(data.person);
        
        // If they provided context and want to include it, start a conversation
        if (includeContext && formData.context.trim()) {
          await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              person_id: data.person.id,
              message: formData.context
            })
          });
        }
        
        setStep('complete');
        setTimeout(() => {
          router.push(`/people/${data.person.id}`);
        }, 2000);
      } else {
        console.error('Error creating person:', data.error);
        alert('Failed to create person: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create person. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitWithContext = () => createPerson(true);
  const handleSkipContext = () => createPerson(false);

  const relationshipOptions = [
    { value: 'direct_report', label: 'Direct Report', emoji: '👥' },
    { value: 'manager', label: 'Manager', emoji: '👆' },
    { value: 'stakeholder', label: 'Stakeholder', emoji: '🤝' },
    { value: 'peer', label: 'Peer', emoji: '👋' }
  ];

  const renderStep = () => {
    switch (step) {
      case 'name':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-4">👋</div>
              <h2 className="text-xl font-medium-bold text-gray-900 mb-2">
                Let's add someone new to your team
              </h2>
              <p className="text-gray-600">What's their name?</p>
            </div>
            
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter their name"
              className="text-center font-sf text-lg"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && formData.name.trim()) {
                  setStep('role');
                }
              }}
            />
            
            <div className="flex justify-center">
              <Button 
                onClick={() => setStep('role')}
                disabled={!formData.name.trim()}
                className="font-medium-bold"
              >
                👍 Continue
              </Button>
            </div>
          </div>
        );

      case 'role':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-4">💼</div>
              <h2 className="text-xl font-medium-bold text-gray-900 mb-2">
                Great! What's {formData.name}'s role?
              </h2>
              <p className="text-gray-600">This helps me understand their responsibilities</p>
            </div>
            
            <Input
              type="text"
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
              placeholder="e.g. Product Manager, Senior Engineer..."
              className="text-center font-sf text-lg"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setStep('relationship');
                }
              }}
            />
            
            <div className="flex justify-center space-x-3">
              <Button 
                onClick={() => setStep('name')}
                variant="outline"
                className="font-medium-bold"
              >
                👈 Back
              </Button>
              <Button 
                onClick={() => setStep('relationship')}
                className="font-medium-bold"
              >
                👍 Continue
              </Button>
            </div>
          </div>
        );

      case 'relationship':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-4">🤝</div>
              <h2 className="text-xl font-medium-bold text-gray-900 mb-2">
                And {formData.name} is your...?
              </h2>
              <p className="text-gray-600">This helps me provide relevant advice</p>
            </div>
            
            <div className="space-y-3">
              {relationshipOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={formData.relationship_type === option.value ? "default" : "outline"}
                  className="w-full justify-start font-medium-bold text-left"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, relationship_type: option.value }));
                    setTimeout(() => setStep('context'), 100);
                  }}
                >
                  <span className="mr-3">{option.emoji}</span>
                  {option.label}
                </Button>
              ))}
            </div>
            
            <div className="flex justify-center">
              <Button 
                onClick={() => setStep('role')}
                variant="outline"
                className="font-medium-bold"
              >
                👈 Back
              </Button>
            </div>
          </div>
        );

      case 'context':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-4">💭</div>
              <h2 className="text-xl font-medium-bold text-gray-900 mb-2">
                Tell me one thing about {formData.name}
              </h2>
              <p className="text-gray-600">
                This helps me provide better guidance from day one
              </p>
            </div>
            
            <textarea
              value={formData.context}
              onChange={(e) => setFormData(prev => ({ ...prev, context: e.target.value }))}
              placeholder="e.g. They're stressed about Q2 deadlines, great at client relationships, looking to move into management..."
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md font-sf resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            
            <div className="flex justify-center space-x-3">
              <Button 
                onClick={() => setStep('relationship')}
                variant="outline"
                className="font-medium-bold"
              >
                👈 Back
              </Button>
              <Button 
                onClick={handleSubmitWithContext}
                disabled={loading}
                className="font-medium-bold"
              >
                {loading ? '🤞 Creating...' : '✨ Create & Start Conversation'}
              </Button>
            </div>
            
            <div className="text-center">
              <Button 
                onClick={handleSkipContext}
                variant="ghost"
                disabled={loading}
                className="text-sm text-gray-500"
              >
                Skip for now
              </Button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-medium-bold text-gray-900 mb-2">
              Perfect! {formData.name} has been added
            </h2>
            <p className="text-gray-600">
              Taking you to your conversation...
            </p>
            <div className="animate-spin text-2xl">🤚</div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex items-center justify-center p-6 font-sf">
      <div className="w-full">
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-8">
            <Link href="/people/general" className="text-gray-400 hover:text-gray-600">
              ✕
            </Link>
            <div className="text-sm text-gray-500">
              Add Person
            </div>
            <div></div>
          </div>
          
          {renderStep()}
        </div>
      </div>
    </div>
  );
}