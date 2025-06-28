import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testStorage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('Testing storage access...');
  
  // List buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets, 'Error:', bucketsError);
  
  // Try to list files in message-attachments bucket
  const { data: files, error: filesError } = await supabase.storage
    .from('message-attachments')
    .list();
  
  console.log('Files in message-attachments:', files, 'Error:', filesError);
  
  // Try to upload a test file
  const testContent = 'This is a test file content';
  const testFile = new Blob([testContent], { type: 'text/plain' });
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('message-attachments')
    .upload('test/test-file.txt', testFile);
  
  console.log('Upload result:', uploadData, 'Error:', uploadError);
  
  // If upload succeeded, try to download it
  if (uploadData?.path) {
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('message-attachments')
      .download(uploadData.path);
    
    console.log('Download result:', downloadData ? 'Success' : 'Failed', 'Error:', downloadError);
    
    if (downloadData) {
      const content = await downloadData.text();
      console.log('Downloaded content:', content);
    }
  }
}

testStorage().catch(console.error);