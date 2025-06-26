'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { personDeletionService, type DeletePersonData } from '@/lib/person-deletion'
import type { Person } from '@/types/database'
import { getHomeUrl } from '@/lib/navigation-helpers'

interface PersonEditMenuProps {
  person: Person;
  chatId: string;
  onClose: () => void;
  onPersonUpdated?: (person: Person) => void;
  onPersonDeleted?: () => void;
}



// Modal component
function Modal({ children, onClose, className = '' }: { 
  children: React.ReactNode; 
  onClose: () => void; 
  className?: string;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content person-edit-menu ${className}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// Profile Edit Section Component
function ProfileEditSection({ 
  person, 
  onUpdate 
}: { 
  person: Person; 
  onUpdate: (person: Person) => void;
}) {
  const [formData, setFormData] = useState({
    name: person.name || '',
    role: person.role || '',
    relationship_type: person.relationship_type || '',
    team: person.team || '',
    location: person.location || '',
    communication_style: person.communication_style || '',
    goals: person.goals || '',
    strengths: person.strengths || '',
    challenges: person.challenges || '',
    notes: person.notes || ''
  });
  
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  const relationshipOptions = [
    { value: 'direct_report', label: 'Direct Report' },
    { value: 'manager', label: 'Manager' },
    { value: 'peer', label: 'Peer' },
    { value: 'stakeholder', label: 'Stakeholder' }
  ];

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

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

      onUpdate(data);
      setIsDirty(false);
      
      // Show success message (you could use a toast library here)
      console.log('Profile updated successfully');
    } catch (error) {
      console.error('Error updating person:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const FormField = ({ 
    label, 
    field, 
    type = 'text', 
    options = [], 
    placeholder = '',
    required = false
  }: {
    label: string;
    field: string;
    type?: 'text' | 'textarea' | 'select';
    options?: { value: string; label: string }[];
    placeholder?: string;
    required?: boolean;
  }) => {
    const fieldId = `field-${field}`;

    return (
      <div className="form-field">
        <label htmlFor={fieldId} className="form-label">
          {label}
          {required && <span className="required-indicator">*</span>}
        </label>
        
        {type === 'textarea' ? (
          <textarea
            id={fieldId}
            value={formData[field as keyof typeof formData]}
            onChange={(e) => handleChange(field, e.target.value)}
            placeholder={placeholder}
            className="form-textarea"
            rows={3}
          />
        ) : type === 'select' ? (
          <select
            id={fieldId}
            value={formData[field as keyof typeof formData]}
            onChange={(e) => handleChange(field, e.target.value)}
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
            value={formData[field as keyof typeof formData]}
            onChange={(e) => handleChange(field, e.target.value)}
            placeholder={placeholder}
            className="form-input"
          />
        )}
      </div>
    );
  };

  return (
    <div className="profile-edit-section">
      <form onSubmit={handleSave}>
        <div className="form-section">
          <h4 className="form-section-title">Basic Information</h4>
          
          <FormField 
            label="Name"
            field="name"
            placeholder="Enter their name"
            required
          />
          
          <FormField 
            label="Role/Title"
            field="role"
            placeholder="e.g. Senior Engineer, Product Manager"
          />
          
          <FormField 
            label="Relationship"
            field="relationship_type"
            type="select"
            options={relationshipOptions}
            required
          />
          
          <FormField 
            label="Company/Team"
            field="team"
            placeholder="e.g. Google, Marketing Team"
          />
          
          <FormField 
            label="Location"
            field="location"
            placeholder="e.g. San Francisco, Remote"
          />
        </div>

        <div className="form-section">
          <h4 className="form-section-title">Additional Details</h4>
          
          <FormField 
            label="Communication Style"
            field="communication_style"
            placeholder="e.g. Prefers email, Direct communicator"
          />
          
          <FormField 
            label="Goals"
            field="goals"
            type="textarea"
            placeholder="What are their current goals or objectives?"
          />
          
          <FormField 
            label="Strengths"
            field="strengths"
            type="textarea"
            placeholder="What are they particularly good at?"
          />
          
          <FormField 
            label="Challenges"
            field="challenges"
            type="textarea"
            placeholder="Any areas where they need support?"
          />
          
          <FormField 
            label="Notes"
            field="notes"
            type="textarea"
            placeholder="Any other important details to remember"
          />
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            onClick={() => setFormData({
              name: person.name || '',
              role: person.role || '',
              relationship_type: person.relationship_type || '',
              team: person.team || '',
              location: person.location || '',
              communication_style: person.communication_style || '',
              goals: person.goals || '',
              strengths: person.strengths || '',
              challenges: person.challenges || '',
              notes: person.notes || ''
            })}
            disabled={!isDirty || isSaving}
            className="form-btn form-btn--secondary"
          >
            Reset
          </button>
          <button 
            type="submit"
            disabled={!isDirty || isSaving}
            className="form-btn form-btn--primary"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Person Actions Section Component
function PersonActionsSection({ 
  person, 
  chatId, 
  onDelete,
  onArchiveChat,
  onMarkInactive 
}: { 
  person: Person; 
  chatId: string;
  onDelete: () => void;
  onArchiveChat?: () => void;
  onMarkInactive?: () => void;
}) {
  return (
    <div className="person-actions-section">
      <div className="action-group">
        <h4>Chat Management</h4>
        <button 
          className="action-btn secondary"
          onClick={onArchiveChat}
          disabled={!onArchiveChat}
        >
          📁 Archive this chat
        </button>
        <p className="action-description">
          Hide this chat from your main list but keep the person profile
        </p>
      </div>
      
      <div className="action-group">
        <h4>Person Status</h4>
        <button 
          className="action-btn secondary"
          onClick={onMarkInactive}
          disabled={!onMarkInactive}
        >
          ⏸️ Mark as inactive
        </button>
        <p className="action-description">
          Keep the profile but mark them as no longer actively involved
        </p>
      </div>
      
      <div className="action-group danger">
        <h4>Delete Person</h4>
        <button 
          className="action-btn danger"
          onClick={onDelete}
        >
          🗑️ Delete {person.name}
        </button>
        <p className="action-description">
          Remove this person and decide what to do with their references
        </p>
      </div>
    </div>
  );
}

// Delete Person Dialog Component
function DeletePersonDialog({ 
  person, 
  chatId, 
  onConfirm, 
  onCancel 
}: { 
  person: Person; 
  chatId: string;
  onConfirm: (deleteData: DeletePersonData) => void;
  onCancel: () => void;
}) {
  const [deleteReason, setDeleteReason] = useState('');
  const [referenceAction, setReferenceAction] = useState<'keep' | 'archive' | 'remove'>('keep');
  const [showReasonInput, setShowReasonInput] = useState(false);
  
  const reasonOptions = [
    { value: 'left_company', label: 'Left the company' },
    { value: 'no_longer_relevant', label: 'No longer relevant to my work' },
    { value: 'duplicate', label: 'Duplicate person' },
    { value: 'mistake', label: 'Added by mistake' },
    { value: 'other', label: 'Other reason' }
  ];
  
  const referenceOptions = [
    { 
      value: 'keep' as const, 
      label: 'Keep references', 
      description: 'Maintain mentions in other chats but remove dedicated profile' 
    },
    { 
      value: 'archive' as const, 
      label: 'Archive references', 
      description: 'Convert to archived mentions that can be searched but not actively used' 
    },
    { 
      value: 'remove' as const, 
      label: 'Remove all references', 
      description: 'Delete all mentions and connections (cannot be undone)' 
    }
  ];
  
  const handleConfirm = () => {
    const deleteData: DeletePersonData = {
      personId: person.id,
      chatId: chatId,
      reason: deleteReason,
      referenceAction: referenceAction
    };
    
    onConfirm(deleteData);
  };
  
  return (
    <Modal onClose={onCancel} className="delete-person-dialog">
      <div className="dialog-header">
        <h3>Delete {person.name}?</h3>
        <p>This action will remove their dedicated chat and profile.</p>
      </div>
      
      <div className="dialog-content">
        <div className="section">
          <label className="form-label">Why are you removing {person.name}?</label>
          <select 
            value={deleteReason}
            onChange={(e) => {
              setDeleteReason(e.target.value);
              setShowReasonInput(e.target.value === 'other');
            }}
            className="form-select"
          >
            <option value="">Select a reason</option>
            {reasonOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          {showReasonInput && (
            <textarea 
              value={deleteReason}
              placeholder="Please specify the reason"
              onChange={(e) => setDeleteReason(e.target.value)}
              className="form-textarea"
              rows={3}
            />
          )}
        </div>
        
        <div className="section">
          <label className="form-label">What should happen to existing references?</label>
          <div className="reference-options">
            {referenceOptions.map(option => (
              <div key={option.value} className="reference-option">
                <input 
                  type="radio"
                  name="referenceAction"
                  value={option.value}
                  checked={referenceAction === option.value}
                  onChange={(e) => setReferenceAction(e.target.value as 'keep' | 'archive' | 'remove')}
                />
                <div className="option-content">
                  <strong>{option.label}</strong>
                  <p>{option.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="dialog-actions">
        <button onClick={onCancel} className="form-btn form-btn--secondary">
          Cancel
        </button>
        <button 
          onClick={handleConfirm} 
          className="form-btn form-btn--danger"
          disabled={!deleteReason}
        >
          Delete {person.name}
        </button>
      </div>
    </Modal>
  );
}

// Main Person Edit Menu Component
export default function PersonEditMenu({ 
  person, 
  chatId, 
  onClose, 
  onPersonUpdated, 
  onPersonDeleted 
}: PersonEditMenuProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'actions'>('profile');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleProfileUpdate = (updatedPerson: Person) => {
    onPersonUpdated?.(updatedPerson);
    // You could show a toast notification here
    console.log('Profile updated successfully');
  };

  const handleDelete = async (deleteData: DeletePersonData) => {
    setIsDeleting(true);
    
    try {
      // Use the deletion service for better handling
      const result = await personDeletionService.deletePerson(deleteData);
      
      if (result.success) {
        onPersonDeleted?.();
        onClose();
        
        // Navigate to home
        getHomeUrl().then(url => router.push(url));
        
        // Show success message (you could use a toast library here)
        console.log(result.message);
      } else {
        throw new Error(result.message);
      }
      
    } catch (error) {
      console.error('Error deleting person:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete person. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleArchiveChat = () => {
    // Placeholder - implement chat archiving logic
    console.log('Archive chat functionality not yet implemented');
    alert('Archive chat functionality coming soon!');
  };

  const handleMarkInactive = () => {
    // Placeholder - implement inactive marking logic
    console.log('Mark inactive functionality not yet implemented');
    alert('Mark as inactive functionality coming soon!');
  };

  return (
    <>
      <Modal onClose={onClose} className="person-edit-menu">
        <div className="menu-header">
          <h3>Manage {person.name}</h3>
          <button 
            onClick={onClose}
            className="form-close-btn"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Edit Profile
          </button>
          <button 
            className={`tab-btn ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            Actions
          </button>
        </div>
        
        <div className="menu-content">
          {activeTab === 'profile' && (
            <ProfileEditSection 
              person={person} 
              onUpdate={handleProfileUpdate} 
            />
          )}
          
          {activeTab === 'actions' && (
            <PersonActionsSection 
              person={person}
              chatId={chatId}
              onDelete={() => setShowDeleteConfirm(true)}
              onArchiveChat={handleArchiveChat}
              onMarkInactive={handleMarkInactive}
            />
          )}
        </div>
      </Modal>
      
      {showDeleteConfirm && (
        <DeletePersonDialog
          person={person}
          chatId={chatId}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      
      {isDeleting && (
        <Modal onClose={() => {}} className="loading-modal">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p>Deleting {person.name}...</p>
          </div>
        </Modal>
      )}
    </>
  );
} 