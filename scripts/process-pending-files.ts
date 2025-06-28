import { createClient } from '@supabase/supabase-js';
import { FileContentProcessor } from '../lib/file-content-processor';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function processPendingFiles() {
  console.log('🔄 Starting file processing...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // First, let's check if we can see the files directly
  const { data: allFiles, error: filesError } = await supabase
    .from('message_files')
    .select('id, original_name, processing_status, user_id')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('📁 Recent files:', allFiles?.length, 'files found');
  if (filesError) {
    console.error('Error fetching files:', filesError);
  } else if (allFiles && allFiles.length > 0) {
    console.log('Sample files:', allFiles.slice(0, 3).map(f => ({
      name: f.original_name,
      status: f.processing_status,
      user_id: f.user_id?.substring(0, 8) + '...'
    })));
  }

  const processor = new FileContentProcessor(supabase);
  
  // Get initial stats
  const statsBefore = await processor.getProcessingStats();
  console.log('📊 Stats before processing:', statsBefore);
  
  // Process pending files
  await processor.processPendingFiles(20);
  
  // Get stats after processing
  const statsAfter = await processor.getProcessingStats();
  console.log('📊 Stats after processing:', statsAfter);
  
  const processed = statsBefore.pending - statsAfter.pending;
  console.log(`✅ Processed ${processed} files`);
  
  // Show any failed files
  if (statsAfter.failed > 0) {
    const { data: failedFiles } = await supabase
      .from('message_files')
      .select('id, original_name, processing_status')
      .eq('processing_status', 'failed')
      .limit(10);
    
    console.log('❌ Failed files:', failedFiles);
  }
}

// Run the script
processPendingFiles().catch(console.error);