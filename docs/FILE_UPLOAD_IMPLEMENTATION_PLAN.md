# File Upload Implementation Plan

**Created**: 2025-06-27  
**Status**: Planning Phase  
**Current Phase**: Analysis Complete

## Overview

This document tracks the implementation of a proper file upload system for Mano. Currently, files are processed client-side and converted to text, but we need true file storage and attachment functionality.

## Current State Analysis

### ✅ What's Already Implemented

#### **UI Components** (Excellent Foundation)
- **ChatDropZone**: Drag-and-drop interface with visual feedback
- **FilePreview**: File display with icons, metadata, and removal
- **EnhancedChatInput**: Integrated file attachment UI
- **useFileDropZone**: Robust file handling hook

#### **File Type Support**
- **Images**: `jpeg`, `png`, `gif`, `webp` (with preview generation)
- **Transcripts**: `txt`, `json`, `vtt`, `ppt` 
- **Documents**: `pdf`, `md`, `csv`
- **Validation**: 10MB size limit, type checking, error handling

#### **Type Definitions**
```typescript
interface DroppedFile {
  id: string;
  file: File;
  type: 'image' | 'transcript' | 'document' | 'unknown';
  preview?: string;
  isProcessing?: boolean;
  error?: string;
}

interface MessageFile {
  id: string;
  name: string;
  type: 'image' | 'transcript' | 'document';
  size: number;
  url?: string;
  icon: string;
}
```

### ❌ Critical Missing Infrastructure

1. **No File Upload API**: Files aren't stored server-side
2. **No Database Schema**: No tables for file storage/relationships
3. **No Cloud Storage**: No Supabase Storage integration
4. **No File Persistence**: Files discarded after text extraction
5. **Missing CSS**: File components reference non-existent styles

## Implementation Plan

## Phase 1: Core Infrastructure ✅ **COMPLETED**

**Goal**: Establish file storage foundation

### 1.1 Database Schema ✅
```sql
-- File storage table
CREATE TABLE message_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  content_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE message_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own files" ON message_files
  FOR ALL USING (auth.uid() = user_id);
```

### 1.2 Supabase Storage Setup ✅
- ✅ Created `message-attachments` bucket
- ✅ Configured RLS policies for user-based access
- ✅ Set up file path structure with user folders

### 1.3 File Upload API ✅
**Endpoints Created**:
- ✅ `POST /api/files/upload` - Single file upload
- ✅ `PUT /api/files/upload` - Multiple file upload  
- ✅ `GET /api/files/[messageId]` - Get files for message
- ✅ File validation, storage, and metadata saving
- ✅ Error handling and cleanup on failures

### 1.4 Message-File Relationships ✅
- ✅ Updated `messages` table with `file_count` column
- ✅ Created `message_files` table with full metadata
- ✅ Added database triggers for file count maintenance
- ✅ Updated UI to fetch and display file attachments
- ✅ Modified message handling flow to upload files separately

**Success Criteria**: ✅ **ALL COMPLETED**
- ✅ Files uploaded and stored in Supabase Storage
- ✅ File metadata saved in database  
- ✅ Files linked to messages
- ✅ Basic file display in chat
- ✅ File access control implemented

---

## Phase 2: Pragmatic Knowledge Integration ⏸️

**Goal**: Fix immediate file content issues by extending existing systems, building foundation for future sophistication

### 2.1 Extend Existing Vector System
```sql
-- Add document content support to existing message_files table
ALTER TABLE message_files 
ADD COLUMN extracted_content TEXT,
ADD COLUMN content_hash TEXT,
ADD COLUMN processing_status TEXT DEFAULT 'pending',
ADD COLUMN processed_at TIMESTAMPTZ;

-- Extend existing conversation_embeddings to include file content
ALTER TABLE conversation_embeddings 
ADD COLUMN file_id UUID REFERENCES message_files(id),
ADD COLUMN content_type TEXT DEFAULT 'message', -- 'message' | 'file_content' | 'file_chunk'
ADD COLUMN chunk_index INTEGER DEFAULT 0;

-- Index for efficient file content searches
CREATE INDEX idx_conversation_embeddings_file_content 
ON conversation_embeddings (user_id, content_type, file_id);
```

### 2.2 Simple Content Processing Pipeline
```typescript
// Extend existing storage utilities
class FileContentProcessor {
  async processUploadedFile(fileId: string): Promise<void> {
    // 1. Download file from storage
    // 2. Extract text content based on file type
    // 3. Store content in message_files.extracted_content
    // 4. Generate embeddings using existing VectorService
    // 5. Store in conversation_embeddings with file reference
  }
  
  async extractTextContent(file: File): Promise<string> {
    // Simple text extraction for common types
    if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
      return await file.text();
    }
    // Add PDF, Office extraction later
    return '[File content extraction not yet supported for this type]';
  }
}
```

### 2.3 Integrate with Existing Vector Search
```typescript
// Extend existing VectorService class
class VectorService {
  // ... existing methods ...
  
  async storeFileContentEmbedding(
    userId: string,
    fileId: string,
    content: string,
    messageId: string
  ): Promise<void> {
    const embedding = await this.generateEmbedding(content);
    
    await this.supabase
      .from('conversation_embeddings')
      .insert({
        user_id: userId,
        message_id: messageId,
        file_id: fileId,
        content: content,
        embedding: embedding,
        content_type: 'file_content'
      });
  }
  
  async searchWithFileContent(
    userId: string,
    query: string,
    includeFiles: boolean = true
  ): Promise<SearchResult[]> {
    // Existing search but include file content results
    // Already implemented - just need to enable file content inclusion
  }
}
```

### 2.4 Fix Immediate AI Integration
```typescript
// Fix current file reading issue in streaming API
// Instead of complex download, use extracted content from database

// In chat/stream/route.ts:
if (hasFiles && userMessageRecord) {
  try {
    const { data: messageFiles } = await supabase
      .from('message_files')
      .select('*, extracted_content')
      .eq('message_id', userMessageRecord.id);
    
    if (messageFiles && messageFiles.length > 0) {
      fileContext = `\n\n[Attached files:]\n`;
      
      messageFiles.forEach((file: any) => {
        fileContext += `\n--- File: ${file.original_name} ---\n`;
        if (file.extracted_content) {
          fileContext += `Content:\n${file.extracted_content}\n`;
        } else {
          fileContext += `[Content extraction pending or not supported]\n`;
        }
        fileContext += `--- End of ${file.original_name} ---\n`;
      });
    }
  } catch (error) {
    console.error('Error fetching file content:', error);
  }
}
```

**Success Criteria**:
- ✅ Mano can immediately read uploaded file contents
- ✅ File content stored in database for persistence
- ✅ File content included in vector search across conversations
- ✅ Foundation for future knowledge architecture
- ✅ Simple, debuggable, extendable approach

---

## Phase 3: File Management UI ⏸️

**Goal**: Rich file interaction and management

### 3.1 Enhanced File Display
- File type-specific icons and previews
- Download/view functionality
- File metadata tooltips
- Inline preview for supported formats

### 3.2 File Management Features
- File browser/gallery view
- Bulk operations (delete, download)
- File search and filtering
- Storage usage tracking

### 3.3 CSS Implementation
```css
/* Missing styles that need implementation */
.chat-drop-zone { }
.file-preview { }
.drop-overlay { }
.file-attachment { }
.file-icon { }
.file-metadata { }
```

**Success Criteria**:
- ✅ Rich file preview system
- ✅ File management interface
- ✅ Complete CSS styling
- ✅ Responsive file display

---

## Phase 4: Advanced Features ⏸️

**Goal**: AI integration and advanced file handling

### 4.1 AI File Analysis
- Content summarization
- Automatic tagging
- File content search
- Integration with chat context

### 4.2 Collaboration Features
- File sharing between conversations
- Version management
- Collaborative editing
- Access permissions

### 4.3 Performance Optimization
- File compression
- CDN integration
- Lazy loading
- Caching strategies

**Success Criteria**:
- ✅ AI-powered file analysis
- ✅ Advanced sharing features
- ✅ Optimized performance
- ✅ Enterprise-ready file system

---

## Current Issues to Resolve

### 🐛 **Immediate Bug Fix**
**Issue**: `refreshMessages is not defined` error when uploading files
**Cause**: File handling expects different API response format
**Fix**: Update topic page to handle file uploads properly ✅ **COMPLETED**

### 🎯 **Next Priority**
1. Create database schema for file storage
2. Implement basic file upload API
3. Update UI to show attachments instead of extracting text
4. Add missing CSS styles

---

## File Flow Comparison

### Current Flow (Broken)
```
File Upload → Client Processing → Text Extraction → Message Text → API → Database
(Files discarded, only text preserved)
```

### Target Flow (Phase 1)
```
File Upload → Server Upload → Storage + Metadata → Message with File Links → Display Attachments
(Files preserved, accessible, downloadable)
```

---

## Implementation Notes

### File Size Considerations
- Current: 10MB limit
- Recommend: Tiered limits (5MB for images, 25MB for documents)
- Future: User-based quotas

### Storage Strategy
- Use Supabase Storage for reliability
- Implement file cleanup for deleted messages
- Consider CDN for frequently accessed files

### Security Requirements
- File type validation (magic numbers, not just extensions)
- Virus scanning for uploads
- Access control per file
- Audit logging for file access

---

## Progress Tracking

### ✅ Completed
- [x] Analysis of existing file handling system
- [x] Fixed immediate upload bug in topic page  
- [x] Comprehensive implementation plan created
- [x] **Phase 1: Core Infrastructure COMPLETE**
  - [x] Database schema with `message_files` table
  - [x] Supabase Storage bucket and RLS policies
  - [x] File upload API endpoints (/api/files/upload, /api/files/[messageId])
  - [x] Updated message handling flow
  - [x] UI updated to display file attachments
  - [x] TypeScript interfaces updated

### 🔄 In Progress
- [x] Phase 1: Core Infrastructure ✅ **COMPLETED 2025-06-27**

### ⏳ Planned
- [ ] Phase 2: Enhanced File Support  
- [ ] Phase 3: File Management UI
- [ ] Phase 4: Advanced Features

---

## Decision Log

**2025-06-27**: Decided to implement proper file storage instead of continuing text extraction approach. UI foundation is solid, focusing on backend infrastructure first.

**Latest Update**: 2025-06-27 - Phase 1 Complete

## Phase 1 Completion Summary

🎉 **Phase 1: Core Infrastructure is now complete!** 

### What Works Now:
- ✅ **File Upload**: Users can drag & drop or select files when sending messages
- ✅ **File Storage**: Files are stored securely in Supabase Storage with user-based access control
- ✅ **File Display**: Messages show file attachments with icons, names, and sizes
- ✅ **File Access**: Downloadable files with signed URLs for security
- ✅ **Database Integration**: Full file metadata tracking linked to messages

### Key Technical Achievements:
- **Database**: `message_files` table with RLS policies and automatic file counting
- **Storage**: Supabase Storage bucket with user folder structure 
- **APIs**: Complete file upload/retrieval endpoints with validation
- **UI**: MessageBubble component fetches and displays attachments
- **Flow**: Proper separation of message creation, file upload, and AI response

### Ready for Testing:
The file upload system is now ready for end-to-end testing. Users should be able to:
1. Upload text files, images, and documents
2. See file attachments in their messages  
3. Download/view uploaded files
4. Have files persist across sessions

**Next Review**: After Phase 2 planning or user testing feedback

---

*This document tracks the complete file upload implementation journey and should be updated after each phase.*