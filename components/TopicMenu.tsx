"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface TopicMenuProps {
  topicId: string;
  topicTitle: string;
  onRename: (newTitle: string) => Promise<void>;
  onArchive: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function TopicMenu({ topicId, topicTitle, onRename, onArchive, onDelete }: TopicMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(topicTitle);
  const [isLoading, setIsLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsRenaming(false);
        setNewTitle(topicTitle);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [topicTitle]);

  // Focus input when starting to rename
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRename = async () => {
    if (!newTitle.trim() || newTitle.trim() === topicTitle) {
      setIsRenaming(false);
      setNewTitle(topicTitle);
      return;
    }

    setIsLoading(true);
    try {
      await onRename(newTitle.trim());
      setIsRenaming(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to rename topic:', error);
      // Reset to original title on error
      setNewTitle(topicTitle);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Archive this topic? You can restore it later from the archived topics section.')) {
      return;
    }

    setIsLoading(true);
    try {
      await onArchive();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to archive topic:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    if (!confirm('Permanently delete this topic? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      await onDelete();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to delete topic:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setNewTitle(topicTitle);
    }
  };

  if (isRenaming) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleRename}
          disabled={isLoading}
          className="bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none text-lg font-medium px-1"
          style={{ width: `${Math.max(newTitle.length, 10)}ch` }}
        />
        {isLoading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="p-1 h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
      >
        ⋯
      </Button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[160px]">
          <div className="py-1">
            <button
              onClick={() => {
                setIsRenaming(true);
                setIsOpen(false);
              }}
              disabled={isLoading}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              ✏️ Rename topic
            </button>
            
            <button
              onClick={handleArchive}
              disabled={isLoading}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              📁 Archive topic
            </button>

            {onDelete && (
              <>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  🗑️ Delete topic
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}