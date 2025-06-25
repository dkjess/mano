import puppeteer from 'puppeteer';

// --- Configuration ---
const BASE_URL = 'http://localhost:3000';
const LOGIN_URL = `${BASE_URL}/auth/login`;
const TARGET_URL = `${BASE_URL}/people`;
const USERNAME = 'testuser@example.com';
const PASSWORD = 'testuser123';

// iPhone 13 emulation settings
const IPHONE_CONFIG = {
  name: 'iPhone 13',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  viewport: {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false
  }
};

// --- Selectors ---
const MENU_BUTTON_SELECTOR = '.mobile-menu-button';
const SIDEBAR_SELECTOR = '.sidebar';
const SIDEBAR_OPEN_CLASS = 'mobile-open';
const SIDEBAR_CLOSE_BUTTON_SELECTOR = '.sidebar-close-button';
const OVERLAY_SELECTOR = '.mobile-overlay';
const NAV_LINK_SELECTOR = '.nav-item[href="/people/general"]';

// --- Helper Functions ---
const log = (message, status = 'INFO') => {
  const color = {
    'INFO': '\x1b[34m', // Blue
    'SUCCESS': '\x1b[32m', // Green
    'ERROR': '\x1b[31m', // Red
    'WARN': '\x1b[33m', // Yellow
    'RESET': '\x1b[0m'
  };
  console.log(`${color[status]}[${status}] ${message}${color.RESET}`);
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function runTest() {
  log('🚀 Starting Mobile Sidebar Test...');
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent(IPHONE_CONFIG.userAgent);
    await page.setViewport(IPHONE_CONFIG.viewport);
    
    // Enable console logging from the page
    page.on('console', msg => {
        if (msg.type() === 'error') {
            log(`PAGE ERROR: ${msg.text()}`, 'ERROR');
        } else if (msg.type() === 'warning') {
            log(`PAGE WARN: ${msg.text()}`, 'WARN');
        }
    });

    // 1. Login
    log(`Navigating to login page: ${LOGIN_URL}`);
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle0' });
    
    await page.type('#email', USERNAME);
    await page.type('#password', PASSWORD);
    
    log('Submitting login form...');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('button[type="submit"]')
    ]);

    // Wait for potential redirects after login
    await delay(2000);
    log(`Current URL after login: ${page.url()}`);
    
    // Check if we're logged in (should be at / or /people/general, not /auth/login)
    if (page.url().includes('/auth/login')) {
      log(`Login failed. Still at login page: ${page.url()}`, 'ERROR');
      await browser.close();
      return;
    }
    log('✅ Login successful.', 'SUCCESS');

    // 2. Navigate to target page
    log(`Navigating to target page: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });
    
    // Wait extra time for React hydration
    log('Waiting for React hydration...');
    await delay(3000);

    // --- TEST SUITE ---

    // Test Case 1: Close with '×' button
    log('--- Starting Test Case 1: Close with "×" button ---');
    await openSidebar(page);
    await page.waitForSelector(SIDEBAR_CLOSE_BUTTON_SELECTOR, { visible: true });
    log('Clicking close button...');
    await page.click(SIDEBAR_CLOSE_BUTTON_SELECTOR);
    await delay(500); // Wait for transition
    await assertSidebarClosed(page, 'Test Case 1');
    log('--- Test Case 1 Finished ---');

    // Test Case 2: Close with overlay
    log('--- Starting Test Case 2: Close with overlay click ---');
    await openSidebar(page);
    await page.waitForSelector(OVERLAY_SELECTOR, { visible: true });
    log('Clicking overlay...');
    // We click at a position as the overlay might have pointer-events: none on the element itself
    await page.mouse.click(5, 5);
    await delay(500); // Wait for transition
    await assertSidebarClosed(page, 'Test Case 2');
    log('--- Test Case 2 Finished ---');

    // Test Case 3: Close with nav link
    log('--- Starting Test Case 3: Close with nav link click ---');
    await openSidebar(page);
    await page.waitForSelector(NAV_LINK_SELECTOR, { visible: true });
    log('Clicking navigation link...');
    await page.click(NAV_LINK_SELECTOR);
    await delay(500); // Wait for transition
    await assertSidebarClosed(page, 'Test Case 3');
    log('--- Test Case 3 Finished ---');


  } catch (error) {
    log(`An error occurred: ${error.message}`, 'ERROR');
    console.error(error);
  } finally {
    if (browser) {
      await browser.close();
      log('Browser closed. Test finished.');
    }
  }
}

async function openSidebar(page) {
    log('Attempting to open sidebar...');
    
    // Check if menu button exists
    await page.waitForSelector(MENU_BUTTON_SELECTOR, { visible: true });
    log('✅ Menu button found and visible');
    
    // Click using the method that works with React
    log('Clicking menu button using direct element.click()...');
    await page.evaluate(() => {
        const button = document.querySelector('.mobile-menu-button');
        if (button) {
            button.click();
        }
    });
    
    // Wait for state change and animation
    await delay(500);
    
    // Check final state
    const finalState = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        return {
            sidebarExists: !!sidebar,
            sidebarClasses: sidebar ? sidebar.className : 'NOT_FOUND',
            hasMobileOpen: sidebar ? sidebar.classList.contains('mobile-open') : false
        };
    });
    
    log(`Final state: ${JSON.stringify(finalState)}`);
    
    if (finalState.hasMobileOpen) {
        log('✅ Sidebar is open.', 'SUCCESS');
    } else {
        // Take a screenshot for debugging
        await page.screenshot({ path: 'debug-sidebar-failed-to-open.png' });
        log('Screenshot saved to debug-sidebar-failed-to-open.png', 'WARN');
        throw new Error('Failed to open sidebar. "mobile-open" class not found.');
    }
}

async function assertSidebarClosed(page, testCase) {
    const sidebar = await page.$(SIDEBAR_SELECTOR);
    const isOpen = await sidebar.evaluate(node => node.classList.contains('mobile-open'));
    if (!isOpen) {
        log(`✅ ${testCase}: Sidebar is closed.`, 'SUCCESS');
    } else {
        log(`❌ ${testCase}: Sidebar FAILED to close.`, 'ERROR');
        // Capture screenshot for debugging
        const screenshotPath = `error-${testCase.replace(/\s+/g, '-')}.png`;
        await page.screenshot({ path: screenshotPath });
        log(`Screenshot saved to ${screenshotPath}`, 'WARN');
    }
}

runTest(); 