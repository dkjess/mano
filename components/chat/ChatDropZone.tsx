"use client";

import { ReactNode } from 'react';
import { DroppedFile } from '@/lib/hooks/useFileDropZone';

interface ChatDropZoneProps {
  children: ReactNode;
  isDragActive: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export function ChatDropZone({ 
  children,
  isDragActive,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  fileInputRef,
  onFileInputChange,
  disabled = false 
}: ChatDropZoneProps) {
  return (
    <div
      className={`chat-drop-zone ${isDragActive ? 'drag-active' : ''} ${disabled ? 'disabled' : ''}`}
      onDragEnter={disabled ? undefined : onDragEnter}
      onDragLeave={disabled ? undefined : onDragLeave}
      onDragOver={disabled ? undefined : onDragOver}
      onDrop={disabled ? undefined : onDrop}
    >
      {children}
      
      {/* Drop overlay */}
      {isDragActive && !disabled && (
        <div className="drop-overlay">
          <div className="drop-content">
            <div className="drop-icon">📁</div>
            <div className="drop-text">Drop files here to share with Mano</div>
            <div className="drop-subtext">
              Images, transcripts, and documents supported
            </div>
          </div>
        </div>
      )}
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt,.json,.vtt,.pdf,.md,.csv"
        onChange={onFileInputChange}
        style={{ display: 'none' }}
      />
    </div>
  );
} 