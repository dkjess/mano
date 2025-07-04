import { createClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface FileProcessingResult {
  success: boolean;
  extractedContent?: string;
  contentHash?: string;
  error?: string;
}

export class FileContentProcessor {
  private supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    // Always use service role for file processing to bypass RLS
    this.supabase = supabase || this.createServiceRoleClient();
  }

  private createServiceRoleClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required for file processing');
    }

    const { createClient } = require('@supabase/supabase-js');
    return createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Process uploaded file by extracting text content and storing it
   */
  async processUploadedFile(fileId: string): Promise<FileProcessingResult> {
    try {
      // Get file record
      const { data: fileRecord, error: fetchError } = await this.supabase
        .from('message_files')
        .select('*')
        .eq('id', fileId)
        .single();

      if (fetchError || !fileRecord) {
        return { success: false, error: 'File record not found' };
      }

      // Check if already processed
      if (fileRecord.processing_status === 'completed' && fileRecord.extracted_content) {
        return { 
          success: true, 
          extractedContent: fileRecord.extracted_content,
          contentHash: fileRecord.content_hash 
        };
      }

      // Mark as processing
      await this.updateProcessingStatus(fileId, 'processing');

      // Download file from storage
      const { data: fileData, error: downloadError } = await this.supabase.storage
        .from('message-attachments')
        .download(fileRecord.storage_path);

      if (downloadError || !fileData) {
        await this.updateProcessingStatus(fileId, 'failed');
        return { success: false, error: `Failed to download file: ${downloadError?.message}` };
      }

      // Extract text content
      const extractedContent = await this.extractTextContent(fileData, fileRecord.content_type);
      
      if (!extractedContent) {
        await this.updateProcessingStatus(fileId, 'completed');
        return { success: false, error: 'No content could be extracted from file' };
      }

      // Generate content hash for deduplication
      const contentHash = this.generateContentHash(extractedContent);

      // Store extracted content
      const { error: updateError } = await this.supabase
        .from('message_files')
        .update({
          extracted_content: extractedContent,
          content_hash: contentHash,
          processing_status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', fileId);

      if (updateError) {
        await this.updateProcessingStatus(fileId, 'failed');
        return { success: false, error: `Failed to store extracted content: ${updateError.message}` };
      }

      // Generate and store embeddings for the file content
      try {
        await this.storeFileEmbeddings(fileRecord, extractedContent);
      } catch (embeddingError) {
        console.warn('Failed to store file embeddings (non-critical):', embeddingError);
        // Don't fail the entire process if embedding fails
      }

      return { 
        success: true, 
        extractedContent,
        contentHash 
      };

    } catch (error) {
      await this.updateProcessingStatus(fileId, 'failed');
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error during processing' 
      };
    }
  }

  /**
   * Extract text content from file based on content type
   */
  private async extractTextContent(fileData: Blob, contentType: string): Promise<string | null> {
    try {
      // Handle text-based files
      if (contentType.startsWith('text/') || 
          contentType === 'application/json' ||
          contentType === 'text/vtt' ||
          contentType === 'text/x-vtt') {
        return await fileData.text();
      }

      // Handle specific document types we can process
      if (contentType === 'application/json') {
        const jsonText = await fileData.text();
        try {
          // Pretty print JSON for better readability
          const parsed = JSON.parse(jsonText);
          return JSON.stringify(parsed, null, 2);
        } catch {
          return jsonText; // Return as-is if not valid JSON
        }
      }

      // For now, return null for unsupported types
      // Future: Add PDF, Office document processing here
      console.log(`Content extraction not yet supported for MIME type: ${contentType}`);
      return null;

    } catch (error) {
      console.error('Error extracting text content:', error);
      return null;
    }
  }

  /**
   * Generate hash of content for deduplication
   */
  private generateContentHash(content: string): string {
    return createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Update processing status of a file
   */
  private async updateProcessingStatus(fileId: string, status: string): Promise<void> {
    try {
      await this.supabase
        .from('message_files')
        .update({ 
          processing_status: status,
          processed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null
        })
        .eq('id', fileId);
    } catch (error) {
      console.error('Error updating processing status:', error);
    }
  }

  /**
   * Process multiple files (batch processing)
   */
  async processPendingFiles(limit: number = 10): Promise<void> {
    try {
      const { data: pendingFiles } = await this.supabase
        .from('message_files')
        .select('id')
        .eq('processing_status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (!pendingFiles || pendingFiles.length === 0) {
        return;
      }

      console.log(`Processing ${pendingFiles.length} pending files...`);

      // Process files one by one to avoid overwhelming the system
      for (const file of pendingFiles) {
        await this.processUploadedFile(file.id);
      }

    } catch (error) {
      console.error('Error processing pending files:', error);
    }
  }

  /**
   * Store vector embeddings for file content
   */
  private async storeFileEmbeddings(fileRecord: any, extractedContent: string): Promise<void> {
    try {
      // Vector embeddings are now handled by the Edge Function during streaming chat
      // No client-side embedding storage needed
      console.log('File embeddings will be stored by Edge Function during conversation')
      return;
    } catch (error) {
      console.error('Error in storeFileEmbeddings (disabled):', error);
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('message_files')
        .select('processing_status');

      if (error || !data) {
        return { pending: 0, processing: 0, completed: 0, failed: 0 };
      }

      const stats = data.reduce((acc, file) => {
        const status = file.processing_status || 'pending';
        acc[status as keyof typeof acc] = (acc[status as keyof typeof acc] || 0) + 1;
        return acc;
      }, { pending: 0, processing: 0, completed: 0, failed: 0 });

      return stats;

    } catch (error) {
      console.error('Error getting processing stats:', error);
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  }
}