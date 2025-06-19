"use client";

import { useState, useCallback, useRef, DragEvent } from 'react';

export interface DroppedFile {
  id: string;
  file: File;
  type: 'image' | 'transcript' | 'document' | 'unknown';
  preview?: string;
  isProcessing?: boolean;
  error?: string;
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_TRANSCRIPT_TYPES = ['text/plain', 'application/json', 'text/vtt', 'application/vnd.ms-powerpoint'];
const SUPPORTED_DOCUMENT_TYPES = ['application/pdf', 'text/markdown', 'text/csv'];

export function useFileDropZone() {
  const [files, setFiles] = useState<DroppedFile[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileType = (file: File): DroppedFile['type'] => {
    if (SUPPORTED_IMAGE_TYPES.includes(file.type)) return 'image';
    if (SUPPORTED_TRANSCRIPT_TYPES.includes(file.type)) return 'transcript';
    if (SUPPORTED_DOCUMENT_TYPES.includes(file.type)) return 'document';
    return 'unknown';
  };

  const createFilePreview = async (file: File): Promise<string | undefined> => {
    if (SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    }
    return undefined;
  };

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: DroppedFile[] = [];
    
    for (const file of Array.from(fileList)) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        console.warn(`File ${file.name} is too large (max 10MB)`);
        continue;
      }

      const fileType = getFileType(file);
      const preview = await createFilePreview(file);
      
      const droppedFile: DroppedFile = {
        id: `file-${Date.now()}-${Math.random()}`,
        file,
        type: fileType,
        preview,
        isProcessing: false
      };

      // Validate file type
      if (fileType === 'unknown') {
        droppedFile.error = 'Unsupported file type';
      }

      newFiles.push(droppedFile);
    }

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragActive(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragActive(false);
      }
      return newCounter;
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragActive(false);
    setDragCounter(0);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input
      e.target.value = '';
    }
  }, [processFiles]);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    files,
    isDragActive,
    fileInputRef,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
    removeFile,
    clearFiles,
    openFileDialog
  };
} 