import { NextResponse } from 'next/server';
import { FileContentProcessor } from '@/lib/file-content-processor';

export async function POST() {
  try {
    console.log('🔄 Processing pending files...');
    
    // Create processor with service role (bypasses RLS)
    const processor = new FileContentProcessor();
    
    // Process up to 10 pending files
    await processor.processPendingFiles(10);
    
    // Get current stats
    const stats = await processor.getProcessingStats();
    
    console.log('✅ File processing completed. Stats:', stats);
    
    return NextResponse.json({
      success: true,
      message: 'Pending files processed',
      stats
    });

  } catch (error) {
    console.error('❌ Error processing pending files:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const processor = new FileContentProcessor();
    const stats = await processor.getProcessingStats();
    
    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting processing stats:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}