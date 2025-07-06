import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadFile, validateFile, saveFileMetadata } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const messageId = formData.get('messageId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Upload file to storage
    const { path: storagePath, error: uploadError } = await uploadFile(file, user.id);
    if (uploadError) {
      return NextResponse.json({ error: uploadError }, { status: 500 });
    }

    // Save file metadata to database
    const { fileRecord, error: dbError } = await saveFileMetadata(
      user.id,
      messageId,
      file,
      storagePath
    );

    if (dbError || !fileRecord) {
      // Clean up uploaded file if database save failed
      const { deleteFile } = await import('@/lib/storage');
      await deleteFile(storagePath);
      return NextResponse.json({ error: dbError || 'Failed to save file' }, { status: 500 });
    }

    // Trigger content processing in background
    try {
      console.log(`🔄 FILE PROCESSING: Starting background processing for file ${fileRecord.id} (${fileRecord.original_name})`);
      const { FileContentProcessor } = await import('@/lib/file-content-processor');
      const processor = new FileContentProcessor(supabase);
      
      // Process file content asynchronously (don't await to avoid blocking the response)
      processor.processUploadedFile(fileRecord.id).then(result => {
        console.log(`✅ FILE PROCESSING: Completed for file ${fileRecord.id}:`, {
          success: result.success,
          hasContent: !!result.extractedContent,
          contentLength: result.extractedContent?.length || 0,
          error: result.error
        });
      }).catch(error => {
        console.error(`❌ FILE PROCESSING: Failed for file ${fileRecord.id}:`, error);
      });
    } catch (error) {
      console.error('❌ FILE PROCESSING: Error starting file content processing:', error);
      // Don't fail the upload if processing setup fails
    }

    return NextResponse.json({
      success: true,
      file: {
        id: fileRecord.id,
        filename: fileRecord.filename,
        originalName: fileRecord.original_name,
        fileType: fileRecord.file_type,
        contentType: fileRecord.content_type,
        fileSize: fileRecord.file_size,
        createdAt: fileRecord.created_at,
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle multiple file uploads
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const messageId = formData.get('messageId') as string;

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // Get all files from form data
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file') && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const results = [];
    const errors = [];

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
          errors.push({ file: file.name, error: validation.error });
          continue;
        }

        // Upload file to storage
        const { path: storagePath, error: uploadError } = await uploadFile(file, user.id);
        if (uploadError) {
          errors.push({ file: file.name, error: uploadError });
          continue;
        }

        // Save file metadata to database
        const { fileRecord, error: dbError } = await saveFileMetadata(
          user.id,
          messageId,
          file,
          storagePath
        );

        if (dbError || !fileRecord) {
          // Clean up uploaded file if database save failed
          const { deleteFile } = await import('@/lib/storage');
          await deleteFile(storagePath);
          errors.push({ file: file.name, error: dbError || 'Failed to save file' });
          continue;
        }

        results.push({
          id: fileRecord.id,
          filename: fileRecord.filename,
          originalName: fileRecord.original_name,
          fileType: fileRecord.file_type,
          contentType: fileRecord.content_type,
          fileSize: fileRecord.file_size,
          createdAt: fileRecord.created_at,
        });

        // Trigger content processing in background
        try {
          console.log(`🔄 BATCH FILE PROCESSING: Starting background processing for file ${fileRecord.id} (${fileRecord.original_name})`);
          const { FileContentProcessor } = await import('@/lib/file-content-processor');
          const processor = new FileContentProcessor(supabase);
          
          // Process file content asynchronously
          processor.processUploadedFile(fileRecord.id).then(result => {
            console.log(`✅ BATCH FILE PROCESSING: Completed for file ${fileRecord.id}:`, {
              success: result.success,
              hasContent: !!result.extractedContent,
              contentLength: result.extractedContent?.length || 0,
              error: result.error
            });
          }).catch(error => {
            console.error(`❌ BATCH FILE PROCESSING: Failed for file ${fileRecord.id}:`, error);
          });
        } catch (error) {
          console.error('❌ BATCH FILE PROCESSING: Error starting file content processing:', error);
        }

      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        errors.push({ 
          file: file.name, 
          error: error instanceof Error ? error.message : 'Processing failed' 
        });
      }
    }

    return NextResponse.json({
      success: results.length > 0,
      files: results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: files.length,
        successful: results.length,
        failed: errors.length
      }
    });

  } catch (error) {
    console.error('Multiple file upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}