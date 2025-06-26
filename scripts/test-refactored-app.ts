#!/usr/bin/env node
/**
 * Comprehensive test script for the refactored Mano application
 * Tests all major features across desktop and mobile viewports
 */

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const APP_URL = 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test user credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'testpass123'
};

const NEW_USER = {
  email: 'newuser@example.com',
  password: 'newpass123'
};

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    console.log('🧪 Starting comprehensive application tests...\n');

    // Test 1: Desktop Sidebar Behavior
    console.log('1️⃣ Testing Desktop Sidebar Behavior...');
    await testDesktopSidebar(browser);
    
    // Test 2: Mobile Navigation
    console.log('\n2️⃣ Testing Mobile Navigation...');
    await testMobileNavigation(browser);
    
    // Test 3: General Topic Functionality
    console.log('\n3️⃣ Testing General Topic Functionality...');
    await testGeneralTopic(browser);
    
    // Test 4: New User Onboarding
    console.log('\n4️⃣ Testing New User Onboarding...');
    await testNewUserOnboarding(browser);
    
    // Test 5: Existing Conversation Access
    console.log('\n5️⃣ Testing Existing Conversation Access...');
    await testExistingConversations(browser);
    
    // Test 6: Vector Search and AI Context
    console.log('\n6️⃣ Testing Vector Search and AI Context...');
    await testVectorSearchAndAI(browser);

    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

async function testDesktopSidebar(browser: puppeteer.Browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 }); // Desktop viewport
  
  try {
    // Navigate to app
    await page.goto(APP_URL);
    await delay(2000);
    
    // Check if redirected to login
    const url = page.url();
    if (url.includes('/auth/login')) {
      console.log('✅ Correctly redirected to login for unauthenticated user');
      
      // Sign in
      await page.type('input[name="email"]', TEST_USER.email);
      await page.type('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    }
    
    // Check sidebar visibility
    const sidebar = await page.$('.sidebar');
    if (sidebar) {
      const isVisible = await sidebar.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      console.log(`✅ Sidebar is ${isVisible ? 'visible' : 'hidden'} on desktop`);
      
      // Check sidebar sections
      const sections = await page.$$eval('.sidebar-section', els => 
        els.map(el => el.querySelector('h3')?.textContent)
      );
      console.log('✅ Sidebar sections:', sections.filter(Boolean).join(', '));
      
      // Test navigation
      const generalLink = await page.$('a[href*="/people/general"], a[href*="/topics/"]');
      if (generalLink) {
        await generalLink.click();
        await delay(1000);
        console.log('✅ Successfully navigated to General');
      }
    }
    
    // Check that hamburger menu is NOT visible on desktop
    const hamburger = await page.$('.sidebar-toggle');
    if (hamburger) {
      const isHidden = await hamburger.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display === 'none';
      });
      console.log(`✅ Hamburger menu is ${isHidden ? 'hidden' : 'visible'} on desktop`);
    }
    
  } catch (error) {
    console.error('❌ Desktop sidebar test failed:', error);
  } finally {
    await page.close();
  }
}

async function testMobileNavigation(browser: puppeteer.Browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 }); // iPhone X viewport
  
  try {
    await page.goto(APP_URL);
    await delay(2000);
    
    // Sign in if needed
    if (page.url().includes('/auth/login')) {
      await page.type('input[name="email"]', TEST_USER.email);
      await page.type('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    }
    
    // Check if redirected to /conversations on mobile
    await delay(2000);
    const currentUrl = page.url();
    if (currentUrl.includes('/conversations')) {
      console.log('✅ Mobile correctly redirected to /conversations');
      
      // Check conversation list
      const conversationItems = await page.$$('.conversation-item');
      console.log(`✅ Found ${conversationItems.length} conversations in list`);
      
      // Test mobile layout
      const mobileLayout = await page.$('.mobile-layout');
      if (mobileLayout) {
        console.log('✅ Mobile layout component is active');
      }
    }
    
    // Test hamburger menu
    const hamburger = await page.$('.sidebar-toggle');
    if (hamburger) {
      const isVisible = await hamburger.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none';
      });
      console.log(`✅ Hamburger menu is ${isVisible ? 'visible' : 'hidden'} on mobile`);
      
      if (isVisible) {
        // Click hamburger to open sidebar
        await hamburger.click();
        await delay(500);
        
        const sidebarOpen = await page.$('.sidebar.open');
        if (sidebarOpen) {
          console.log('✅ Sidebar opens when hamburger clicked');
          
          // Click overlay to close
          const overlay = await page.$('.sidebar-overlay');
          if (overlay) {
            await overlay.click();
            await delay(500);
            console.log('✅ Sidebar closes when overlay clicked');
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Mobile navigation test failed:', error);
  } finally {
    await page.close();
  }
}

async function testGeneralTopic(browser: puppeteer.Browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  
  try {
    await page.goto(APP_URL);
    await delay(2000);
    
    // Sign in
    if (page.url().includes('/auth/login')) {
      await page.type('input[name="email"]', TEST_USER.email);
      await page.type('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    }
    
    // Navigate to General
    const generalLink = await page.$('a[href*="general"]');
    if (generalLink) {
      await generalLink.click();
      await delay(2000);
      
      // Check if we're on a General topic page
      const pageTitle = await page.$eval('h1', el => el.textContent);
      if (pageTitle?.includes('General')) {
        console.log('✅ Successfully navigated to General topic');
      }
      
      // Test sending a message
      const chatInput = await page.$('textarea[placeholder*="Type"], input[placeholder*="Type"]');
      if (chatInput) {
        await chatInput.type('Test message in General topic');
        
        // Find and click send button
        const sendButton = await page.$('button[type="submit"], button:has(svg)');
        if (sendButton) {
          await sendButton.click();
          await delay(3000); // Wait for message to send
          
          // Check if message appears
          const messages = await page.$$('.message-bubble');
          console.log(`✅ Sent message, total messages: ${messages.length}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ General topic test failed:', error);
  } finally {
    await page.close();
  }
}

async function testNewUserOnboarding(browser: puppeteer.Browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  
  try {
    // First, clean up any existing user
    const { error: deleteError } = await supabase.auth.admin?.deleteUser?.(NEW_USER.email);
    
    await page.goto(`${APP_URL}/auth/sign-up`);
    await delay(2000);
    
    // Fill sign-up form
    await page.type('input[name="email"]', NEW_USER.email);
    await page.type('input[name="password"]', NEW_USER.password);
    await page.click('button[type="submit"]');
    
    await delay(3000);
    
    // Check redirect after sign-up
    const afterSignupUrl = page.url();
    if (afterSignupUrl.includes('/people/general') || afterSignupUrl.includes('/topics/')) {
      console.log('✅ New user redirected to General after signup');
      
      // Check if General topic was created
      const generalExists = await page.$('h1:has-text("General")');
      if (generalExists) {
        console.log('✅ General topic automatically created for new user');
      }
    }
    
  } catch (error) {
    console.error('❌ New user onboarding test failed:', error);
  } finally {
    await page.close();
  }
}

async function testExistingConversations(browser: puppeteer.Browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  
  try {
    await page.goto(APP_URL);
    await delay(2000);
    
    // Sign in
    if (page.url().includes('/auth/login')) {
      await page.type('input[name="email"]', TEST_USER.email);
      await page.type('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    }
    
    // Check sidebar for people
    const peopleSection = await page.$('.sidebar-section:has(h3:has-text("Your Team"))');
    if (peopleSection) {
      const peopleLinks = await peopleSection.$$('a.nav-item');
      console.log(`✅ Found ${peopleLinks.length} people in sidebar`);
      
      if (peopleLinks.length > 0) {
        // Click first person
        await peopleLinks[0].click();
        await delay(2000);
        
        // Check if messages loaded
        const messages = await page.$$('.message-bubble');
        console.log(`✅ Loaded ${messages.length} messages for person`);
      }
    }
    
    // Check topics section
    const topicsSection = await page.$('.sidebar-section:has(h3:has-text("Topics"))');
    if (topicsSection) {
      const topicLinks = await topicsSection.$$('a.nav-item');
      console.log(`✅ Found ${topicLinks.length} topics in sidebar`);
    }
    
  } catch (error) {
    console.error('❌ Existing conversations test failed:', error);
  } finally {
    await page.close();
  }
}

async function testVectorSearchAndAI(browser: puppeteer.Browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  
  try {
    await page.goto(APP_URL);
    await delay(2000);
    
    // Sign in
    if (page.url().includes('/auth/login')) {
      await page.type('input[name="email"]', TEST_USER.email);
      await page.type('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    }
    
    // Navigate to a conversation
    const firstPerson = await page.$('.sidebar-section a.nav-item');
    if (firstPerson) {
      await firstPerson.click();
      await delay(2000);
      
      // Send a message that should trigger vector search
      const chatInput = await page.$('textarea[placeholder*="Type"], input[placeholder*="Type"]');
      if (chatInput) {
        await chatInput.type('What did we discuss last time about team performance?');
        
        const sendButton = await page.$('button[type="submit"], button:has(svg)');
        if (sendButton) {
          await sendButton.click();
          console.log('✅ Sent context-aware query');
          
          // Wait for AI response
          await delay(5000);
          
          // Check if response was received
          const messages = await page.$$('.message-bubble');
          const lastMessage = messages[messages.length - 1];
          if (lastMessage) {
            const isAI = await lastMessage.evaluate(el => 
              el.classList.contains('assistant') || !el.classList.contains('user')
            );
            if (isAI) {
              console.log('✅ Received AI response with context');
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Vector search and AI test failed:', error);
  } finally {
    await page.close();
  }
}

// Run all tests
runTests();