import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';

async function runMobileTest() {
  console.log('🚀 Running Mobile Sidebar Test...\n');
  
  let browser;
  let page;
  
  try {
    browser = await puppeteer.launch({ 
      headless: false,
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 375, height: 667 });
    
    console.log('📱 Set mobile viewport (375x667)');
    
    // Navigate to the app
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    console.log('🌐 Navigated to home page');
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if we need to login
    const currentUrl = await page.url();
    if (currentUrl.includes('/auth/login')) {
      console.log('🔑 Logging in with test credentials...');
      
      await page.type('input[type="email"]', 'testuser@example.com');
      await page.type('input[type="password"]', 'testuser123');
      await page.click('button[type="submit"]');
      
      // Wait for redirect
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Navigate to a page with sidebar
    await page.goto('http://localhost:3000/people/general', { waitUntil: 'networkidle2' });
    console.log('🌐 Navigated to people/general page');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Read and inject the test script
    const testScript = readFileSync('scripts/test-mobile-fixes.js', 'utf8');
    
    console.log('📝 Injecting test script...');
    
    // Capture console logs
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log(`🖥️  ${text}`);
    });
    
    // Inject and run the test script
    await page.evaluate(testScript);
    
    // Wait for tests to complete
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('\n📊 Test completed! Check the output above for results.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

runMobileTest(); 