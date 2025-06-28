// Script to process pending files directly
import { FileContentProcessor } from '../lib/file-content-processor.js';

async function main() {
  try {
    console.log('🔄 Starting file processing...');
    
    const processor = new FileContentProcessor();
    
    // Get current stats first
    const statsBefore = await processor.getProcessingStats();
    console.log('📊 Stats before processing:', statsBefore);
    
    // Process pending files
    await processor.processPendingFiles(10);
    
    // Get stats after processing
    const statsAfter = await processor.getProcessingStats();
    console.log('📊 Stats after processing:', statsAfter);
    
    console.log('✅ File processing completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();