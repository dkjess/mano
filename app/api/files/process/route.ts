import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FileContentProcessor } from '@/lib/file-content-processor';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const processor = new FileContentProcessor(supabase);
    
    // Get processing stats before
    const statsBefore = await processor.getProcessingStats();
    
    // Process pending files
    await processor.processPendingFiles(10);
    
    // Get processing stats after
    const statsAfter = await processor.getProcessingStats();
    
    return NextResponse.json({
      success: true,
      statsBefore,
      statsAfter,
      processed: statsBefore.pending - statsAfter.pending
    });

  } catch (error) {
    console.error('File processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check processing stats
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const processor = new FileContentProcessor(supabase);
    const stats = await processor.getProcessingStats();
    
    // Also get some recent files for debugging
    const { data: recentFiles } = await supabase
      .from('message_files')
      .select('id, original_name, processing_status, file_type, created_at, processed_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    return NextResponse.json({
      stats,
      recentFiles
    });

  } catch (error) {
    console.error('Error getting processing stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}