'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Person } from '@/types/database'

interface ProfileEditFormProps {
  person: Person;
  onSave: (updatedPerson: Person) => void;
  onClose: () => void;
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

function FormField({ 
  label, 
  value, 
  onChange, 
  type = 'text', 
  options = [], 
  placeholder, 
  required = false 
}: FormFieldProps) {
  const fieldId = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="form-field">
      <label htmlFor={fieldId} className="form-label">
        {label}
        {required && <span className="required-indicator">*</span>}
      </label>
      
      {type === 'textarea' ? (
        <textarea
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="form-textarea"
          rows={4}
        />
      ) : type === 'select' ? (
        <select
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="form-select"
        >
          <option value="">Select {label.toLowerCase()}...</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="form-input"
        />
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function ProfileEditForm({ person, onSave, onClose }: ProfileEditFormProps) {
  const [formData, setFormData] = useState({
    name: person.name || '',
    role: person.role || '',
    relationship_type: person.relationship_type || '',
    team: person.team || '',
    location: person.location || '',
    notes: person.notes || '',
    communication_style: person.communication_style || '',
    goals: person.goals || '',
    strengths: person.strengths || '',
    challenges: person.challenges || ''
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  const relationshipOptions = [
    { value: 'direct_report', label: 'Direct Report' },
    { value: 'manager', label: 'Manager' },
    { value: 'peer', label: 'Peer' },
    { value: 'stakeholder', label: 'Stakeholder' }
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.relationship_type) {
      alert('Name and relationship are required fields.');
      return;
    }

    setIsSaving(true);
    
    try {
      // Prepare update data (only include non-empty values)
      const updateData: Partial<Person> = {};
      
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'name' || key === 'relationship_type') {
          // Required fields
          updateData[key as keyof Person] = value as any;
        } else if (value && value.trim()) {
          // Optional fields (only if they have values)
          updateData[key as keyof Person] = value as any;
        } else {
          // Clear empty optional fields
          updateData[key as keyof Person] = null as any;
        }
      });

      const { data, error } = await supabase
        .from('people')
        .update(updateData)
        .eq('id', person.id)
        .select()
        .single();

      if (error) throw error;

      onSave(data);
    } catch (error) {
      console.error('Error updating person:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSave} className="profile-edit-form">
        <div className="form-header">
          <h3 className="form-title">Edit {person.name}'s Profile</h3>
          <button
            type="button"
            onClick={onClose}
            className="form-close-btn"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="form-content">
          <div className="form-section">
            <h4 className="form-section-title">Basic Information</h4>
            
            <FormField 
              label="Name"
              value={formData.name}
              onChange={(value) => setFormData({...formData, name: value})}
              placeholder="Enter their name"
              required
            />
            
            <FormField 
              label="Role/Title"
              value={formData.role}
              onChange={(value) => setFormData({...formData, role: value})}
              placeholder="e.g. Senior Engineer, Product Manager"
            />
            
            <FormField 
              label="Relationship"
              value={formData.relationship_type}
              onChange={(value) => setFormData({...formData, relationship_type: value})}
              type="select"
              options={relationshipOptions}
              required
            />
            
            <FormField 
              label="Company/Team"
              value={formData.team}
              onChange={(value) => setFormData({...formData, team: value})}
              placeholder="e.g. Google, Marketing Team"
            />
            
            <FormField 
              label="Location"
              value={formData.location}
              onChange={(value) => setFormData({...formData, location: value})}
              placeholder="e.g. San Francisco, Remote"
            />
          </div>

          <div className="form-section">
            <h4 className="form-section-title">Additional Details</h4>
            
            <FormField 
              label="Communication Style"
              value={formData.communication_style}
              onChange={(value) => setFormData({...formData, communication_style: value})}
              placeholder="e.g. Prefers email, Direct communicator"
            />
            
            <FormField 
              label="Goals"
              value={formData.goals}
              onChange={(value) => setFormData({...formData, goals: value})}
              type="textarea"
              placeholder="What are their current goals or objectives?"
            />
            
            <FormField 
              label="Strengths"
              value={formData.strengths}
              onChange={(value) => setFormData({...formData, strengths: value})}
              type="textarea"
              placeholder="What are they particularly good at?"
            />
            
            <FormField 
              label="Challenges"
              value={formData.challenges}
              onChange={(value) => setFormData({...formData, challenges: value})}
              type="textarea"
              placeholder="Any areas where they need support?"
            />
            
            <FormField 
              label="Notes"
              value={formData.notes}
              onChange={(value) => setFormData({...formData, notes: value})}
              type="textarea"
              placeholder="Any other important details to remember"
            />
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            onClick={onClose}
            disabled={isSaving}
            className="form-btn form-btn--secondary"
          >
            Cancel
          </button>
          <button 
            type="submit"
            disabled={isSaving || !formData.name.trim() || !formData.relationship_type}
            className="form-btn form-btn--primary"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
} 