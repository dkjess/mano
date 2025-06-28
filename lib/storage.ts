import { createClient } from '@/lib/supabase/server';
import { createClient as createClientClient } from '@/lib/supabase/client';
import type { MessageFile } from '@/types/database';

// File type mapping
export const FILE_TYPE_MAP = {
  // Images
  'image/jpeg': 'image',
  'image/jpg': 'image', 
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  
  // Documents
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/markdown': 'document',
  'text/csv': 'document',
  'application/rtf': 'document',
  
  // Transcripts
  'text/plain': 'transcript',
  'application/json': 'transcript',
  'text/vtt': 'transcript',
  'text/x-vtt': 'transcript', // Alternative VTT MIME type
  'application/x-subrip': 'transcript', // .srt files
  'text/srt': 'transcript', // .srt files alternative MIME type
  
  // PowerPoint (legacy support)
  'application/vnd.ms-powerpoint': 'transcript',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
} as const;

export const SUPPORTED_TYPES = Object.keys(FILE_TYPE_MAP);

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
export const BUCKET_NAME = 'message-attachments';

// Generate unique filename
export function generateFilename(originalName: string, userId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop() || '';
  return `${userId}/${timestamp}-${random}.${extension}`;
}

// Get file type from MIME type
export function getFileType(mimeType: string): 'image' | 'document' | 'transcript' | 'unknown' {
  return FILE_TYPE_MAP[mimeType as keyof typeof FILE_TYPE_MAP] || 'unknown';
}

// Get display icon for file type
export function getFileIcon(fileType: string, mimeType?: string): string {
  switch (fileType) {
    case 'image':
      return '🖼️';
    case 'document':
      if (mimeType?.includes('pdf')) return '📄';
      if (mimeType?.includes('word')) return '📝';
      if (mimeType?.includes('presentation')) return '📊';
      return '📄';
    case 'transcript':
      return '📝';
    default:
      return '📎';
  }
}

// Validate file
export function validateFile(file: File): { valid: boolean; error?: string } {
  console.log('Validating file:', {
    name: file.name,
    type: file.type,
    size: file.size,
    supportedTypes: SUPPORTED_TYPES
  });
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File size must be less than ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB` 
    };
  }
  
  // Check file type
  if (!SUPPORTED_TYPES.includes(file.type)) {
    console.error('Unsupported file type:', file.type, 'Supported types:', SUPPORTED_TYPES);
    return { 
      valid: false, 
      error: `File type '${file.type}' not supported. Supported types: ${SUPPORTED_TYPES.join(', ')}` 
    };
  }
  
  return { valid: true };
}

// Upload file to Supabase Storage (server-side)
export async function uploadFile(file: File, userId: string): Promise<{ path: string; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Generate unique filename
    const filename = generateFilename(file.name, userId);
    
    // Upload to storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      return { path: '', error: error.message };
    }
    
    return { path: data.path };
  } catch (error) {
    return { 
      path: '', 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}

// Get signed URL for file access (server-side)
export async function getFileUrl(path: string, expiresIn: number = 3600): Promise<string | null> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn);
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting file URL:', error);
    return null;
  }
}

// Get signed URL for file access (client-side)
export async function getFileUrlClient(path: string, expiresIn: number = 3600): Promise<string | null> {
  try {
    const supabase = createClientClient();
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn);
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting file URL:', error);
    return null;
  }
}

// Delete file from storage (server-side)
export async function deleteFile(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Delete failed' 
    };
  }
}

// Save file metadata to database
export async function saveFileMetadata(
  userId: string,
  messageId: string,
  file: File,
  storagePath: string
): Promise<{ fileRecord: MessageFile | null; error?: string }> {
  try {
    const supabase = await createClient();
    
    const fileType = getFileType(file.type);
    
    const fileData = {
      user_id: userId,
      message_id: messageId,
      filename: storagePath.split('/').pop() || '',
      original_name: file.name,
      file_type: fileType,
      content_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      metadata: {
        lastModified: file.lastModified,
        // Add more metadata as needed
      }
    };
    
    const { data, error } = await supabase
      .from('message_files')
      .insert(fileData)
      .select()
      .single();
    
    if (error) {
      return { fileRecord: null, error: error.message };
    }
    
    return { fileRecord: data };
  } catch (error) {
    return { 
      fileRecord: null, 
      error: error instanceof Error ? error.message : 'Failed to save file metadata' 
    };
  }
}

// Get files for a message
export async function getMessageFiles(messageId: string): Promise<MessageFile[]> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('message_files')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching message files:', error);
      return [];
    }
    
    // Add computed fields
    const filesWithUrls = await Promise.all(
      data.map(async (file) => ({
        ...file,
        url: await getFileUrl(file.storage_path),
        icon: getFileIcon(file.file_type, file.content_type)
      }))
    );
    
    return filesWithUrls;
  } catch (error) {
    console.error('Error getting message files:', error);
    return [];
  }
}