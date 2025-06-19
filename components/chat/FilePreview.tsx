"use client";

import { DroppedFile } from '@/lib/hooks/useFileDropZone';

interface FilePreviewProps {
  file: DroppedFile;
  onRemove: (fileId: string) => void;
  isCompact?: boolean;
}

export function FilePreview({ file, onRemove, isCompact = false }: FilePreviewProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: DroppedFile['type']) => {
    switch (type) {
      case 'image': return '🖼️';
      case 'transcript': return '📝';
      case 'document': return '📄';
      default: return '📎';
    }
  };

  const getFileTypeLabel = (type: DroppedFile['type']) => {
    switch (type) {
      case 'image': return 'Image';
      case 'transcript': return 'Transcript';
      case 'document': return 'Document';
      default: return 'File';
    }
  };

  return (
    <div className={`file-preview ${isCompact ? 'compact' : ''} ${file.error ? 'error' : ''}`}>
      <div className="file-preview-content">
        {file.preview ? (
          <div className="file-image-preview">
            <img src={file.preview} alt={file.file.name} />
            <div className="file-image-overlay">
              <span className="file-type-icon">{getFileIcon(file.type)}</span>
            </div>
          </div>
        ) : (
          <div className="file-icon-preview">
            <span className="file-type-icon">{getFileIcon(file.type)}</span>
          </div>
        )}
        
        <div className="file-details">
          <div className="file-name" title={file.file.name}>
            {file.file.name}
          </div>
          <div className="file-meta">
            <span className="file-type">{getFileTypeLabel(file.type)}</span>
            <span className="file-size">{formatFileSize(file.file.size)}</span>
          </div>
          {file.error && (
            <div className="file-error">{file.error}</div>
          )}
        </div>
      </div>
      
      <button
        onClick={() => onRemove(file.id)}
        className="file-remove-button"
        aria-label="Remove file"
      >
        ✕
      </button>
      
      {file.isProcessing && (
        <div className="file-processing-overlay">
          <div className="processing-spinner"></div>
        </div>
      )}
    </div>
  );
}

interface FilePreviewListProps {
  files: DroppedFile[];
  onRemove: (fileId: string) => void;
  isCompact?: boolean;
}

export function FilePreviewList({ files, onRemove, isCompact = false }: FilePreviewListProps) {
  if (files.length === 0) return null;

  return (
    <div className={`file-preview-list ${isCompact ? 'compact' : ''}`}>
      {files.map(file => (
        <FilePreview
          key={file.id}
          file={file}
          onRemove={onRemove}
          isCompact={isCompact}
        />
      ))}
    </div>
  );
} 