// Responsive Sidebar Testing Script
// Run this in browser console to test the new responsive sidebar functionality

console.log('🧪 Mano Responsive Sidebar Testing Script');
console.log('=========================================');

// Test 1: Check if sidebar toggle button is visible on mobile
function testSidebarToggleButton() {
  console.log('\n🔍 Testing Sidebar Toggle Button...');
  
  const toggleButton = document.querySelector('.sidebar-toggle');
  if (!toggleButton) {
    console.error('❌ Sidebar toggle button not found');
    return false;
  }
  
  const styles = window.getComputedStyle(toggleButton);
  const isVisible = styles.display !== 'none';
  
  console.log(isVisible ? '✅ Sidebar toggle button visible' : '❌ Sidebar toggle button hidden');
  
  // Test button dimensions
  const rect = toggleButton.getBoundingClientRect();
  const hasGoodTouchTarget = rect.width >= 44 && rect.height >= 44;
  console.log(hasGoodTouchTarget ? '✅ Good touch target size' : `❌ Touch target too small (${rect.width}x${rect.height})`);
  
  // Test if button has click handler
  const hasClickHandler = toggleButton.onclick !== null || toggleButton.getAttribute('onclick') !== null;
  console.log(hasClickHandler ? '✅ Toggle button has click handler' : '❌ Toggle button missing click handler');
  
  return isVisible && hasGoodTouchTarget;
}

// Test 2: Check sidebar structure and classes
function testSidebarStructure() {
  console.log('\n🔍 Testing Sidebar Structure...');
  
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  const closeButton = document.querySelector('.sidebar-close');
  
  if (!sidebar) {
    console.error('❌ Sidebar not found');
    return false;
  }
  
  console.log('✅ Sidebar element found');
  
  if (!overlay) {
    console.error('❌ Sidebar overlay not found');
    return false;
  }
  
  console.log('✅ Sidebar overlay found');
  
  if (!closeButton) {
    console.error('❌ Sidebar close button not found');
    return false;
  }
  
  console.log('✅ Sidebar close button found');
  
  // Check initial state
  const isInitiallyOpen = sidebar.classList.contains('open');
  const overlayInitiallyActive = overlay.classList.contains('active');
  
  console.log(isInitiallyOpen ? '⚠️ Sidebar starts open' : '✅ Sidebar starts closed');
  console.log(overlayInitiallyActive ? '⚠️ Overlay starts active' : '✅ Overlay starts inactive');
  
  return true;
}

// Test 3: Test sidebar opening functionality
function testSidebarOpening() {
  console.log('\n🔍 Testing Sidebar Opening...');
  
  return new Promise((resolve) => {
    const toggleButton = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (!toggleButton || !sidebar || !overlay) {
      console.error('❌ Required elements not found');
      resolve(false);
      return;
    }
    
    // Record initial state
    const initiallyOpen = sidebar.classList.contains('open');
    const initiallyOverlayActive = overlay.classList.contains('active');
    
    console.log(`📊 Initial state: sidebar=${initiallyOpen ? 'open' : 'closed'}, overlay=${initiallyOverlayActive ? 'active' : 'inactive'}`);
    
    // Click the toggle button
    console.log('🖱️ Clicking toggle button...');
    toggleButton.click();
    
    // Wait for animation
    setTimeout(() => {
      const afterClickOpen = sidebar.classList.contains('open');
      const afterClickOverlayActive = overlay.classList.contains('active');
      
      console.log(`📊 After click: sidebar=${afterClickOpen ? 'open' : 'closed'}, overlay=${afterClickOverlayActive ? 'active' : 'inactive'}`);
      
      const openedCorrectly = !initiallyOpen && afterClickOpen;
      const overlayActivatedCorrectly = !initiallyOverlayActive && afterClickOverlayActive;
      
      console.log(openedCorrectly ? '✅ Sidebar opens correctly' : '❌ Sidebar did not open');
      console.log(overlayActivatedCorrectly ? '✅ Overlay activates correctly' : '❌ Overlay did not activate');
      
      resolve(openedCorrectly && overlayActivatedCorrectly);
    }, 500); // Wait for CSS transition
  });
}

// Test 4: Test sidebar closing via close button
function testSidebarClosingViaButton() {
  console.log('\n🔍 Testing Sidebar Closing via Close Button...');
  
  return new Promise((resolve) => {
    const closeButton = document.querySelector('.sidebar-close');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (!closeButton || !sidebar || !overlay) {
      console.error('❌ Required elements not found');
      resolve(false);
      return;
    }
    
    // Ensure sidebar is open first
    if (!sidebar.classList.contains('open')) {
      console.log('📝 Opening sidebar first...');
      const toggleButton = document.querySelector('.sidebar-toggle');
      toggleButton?.click();
      
      setTimeout(() => {
        testCloseButton();
      }, 500);
    } else {
      testCloseButton();
    }
    
    function testCloseButton() {
      const beforeCloseOpen = sidebar.classList.contains('open');
      const beforeCloseOverlayActive = overlay.classList.contains('active');
      
      console.log(`📊 Before close: sidebar=${beforeCloseOpen ? 'open' : 'closed'}, overlay=${beforeCloseOverlayActive ? 'active' : 'inactive'}`);
      
      // Click the close button
      console.log('🖱️ Clicking close button...');
      closeButton.click();
      
      // Wait for animation
      setTimeout(() => {
        const afterCloseOpen = sidebar.classList.contains('open');
        const afterCloseOverlayActive = overlay.classList.contains('active');
        
        console.log(`📊 After close: sidebar=${afterCloseOpen ? 'open' : 'closed'}, overlay=${afterCloseOverlayActive ? 'active' : 'inactive'}`);
        
        const closedCorrectly = beforeCloseOpen && !afterCloseOpen;
        const overlayDeactivatedCorrectly = beforeCloseOverlayActive && !afterCloseOverlayActive;
        
        console.log(closedCorrectly ? '✅ Sidebar closes correctly via button' : '❌ Sidebar did not close via button');
        console.log(overlayDeactivatedCorrectly ? '✅ Overlay deactivates correctly' : '❌ Overlay did not deactivate');
        
        resolve(closedCorrectly && overlayDeactivatedCorrectly);
      }, 500);
    }
  });
}

// Test 5: Test sidebar closing via overlay click
function testSidebarClosingViaOverlay() {
  console.log('\n🔍 Testing Sidebar Closing via Overlay Click...');
  
  return new Promise((resolve) => {
    const overlay = document.querySelector('.sidebar-overlay');
    const sidebar = document.querySelector('.sidebar');
    
    if (!overlay || !sidebar) {
      console.error('❌ Required elements not found');
      resolve(false);
      return;
    }
    
    // Ensure sidebar is open first
    if (!sidebar.classList.contains('open')) {
      console.log('📝 Opening sidebar first...');
      const toggleButton = document.querySelector('.sidebar-toggle');
      toggleButton?.click();
      
      setTimeout(() => {
        testOverlayClick();
      }, 500);
    } else {
      testOverlayClick();
    }
    
    function testOverlayClick() {
      const beforeCloseOpen = sidebar.classList.contains('open');
      const beforeCloseOverlayActive = overlay.classList.contains('active');
      
      console.log(`📊 Before overlay click: sidebar=${beforeCloseOpen ? 'open' : 'closed'}, overlay=${beforeCloseOverlayActive ? 'active' : 'inactive'}`);
      
      // Click the overlay
      console.log('🖱️ Clicking overlay...');
      overlay.click();
      
      // Wait for animation
      setTimeout(() => {
        const afterCloseOpen = sidebar.classList.contains('open');
        const afterCloseOverlayActive = overlay.classList.contains('active');
        
        console.log(`📊 After overlay click: sidebar=${afterCloseOpen ? 'open' : 'closed'}, overlay=${afterCloseOverlayActive ? 'active' : 'inactive'}`);
        
        const closedCorrectly = beforeCloseOpen && !afterCloseOpen;
        const overlayDeactivatedCorrectly = beforeCloseOverlayActive && !afterCloseOverlayActive;
        
        console.log(closedCorrectly ? '✅ Sidebar closes correctly via overlay' : '❌ Sidebar did not close via overlay');
        console.log(overlayDeactivatedCorrectly ? '✅ Overlay deactivates correctly' : '❌ Overlay did not deactivate');
        
        resolve(closedCorrectly && overlayDeactivatedCorrectly);
      }, 500);
    }
  });
}

// Test 6: Test responsive behavior
function testResponsiveBehavior() {
  console.log('\n🔍 Testing Responsive Behavior...');
  
  const sidebar = document.querySelector('.sidebar');
  const toggleButton = document.querySelector('.sidebar-toggle');
  
  if (!sidebar || !toggleButton) {
    console.error('❌ Required elements not found');
    return false;
  }
  
  // Check current screen size behavior
  const sidebarStyles = window.getComputedStyle(sidebar);
  const toggleStyles = window.getComputedStyle(toggleButton);
  
  const isDesktop = window.innerWidth > 768;
  const sidebarPosition = sidebarStyles.position;
  const toggleDisplay = toggleStyles.display;
  
  console.log(`📊 Screen width: ${window.innerWidth}px`);
  console.log(`📊 Sidebar position: ${sidebarPosition}`);
  console.log(`📊 Toggle button display: ${toggleDisplay}`);
  
  if (isDesktop) {
    const correctDesktopBehavior = sidebarPosition === 'relative' && toggleDisplay === 'none';
    console.log(correctDesktopBehavior ? '✅ Desktop behavior correct' : '❌ Desktop behavior incorrect');
    return correctDesktopBehavior;
  } else {
    const correctMobileBehavior = sidebarPosition === 'fixed' && toggleDisplay !== 'none';
    console.log(correctMobileBehavior ? '✅ Mobile behavior correct' : '❌ Mobile behavior incorrect');
    return correctMobileBehavior;
  }
}

// Test 7: Check console logging
function testConsoleLogging() {
  console.log('\n🔍 Testing Console Logging...');
  
  // Override console.log temporarily to capture logs
  const originalLog = console.log;
  const capturedLogs = [];
  
  console.log = function(...args) {
    capturedLogs.push(args.join(' '));
    originalLog.apply(console, args);
  };
  
  // Test toggle button click
  const toggleButton = document.querySelector('.sidebar-toggle');
  if (toggleButton) {
    toggleButton.click();
    
    setTimeout(() => {
      // Restore original console.log
      console.log = originalLog;
      
      // Check if we captured any sidebar-related logs
      const sidebarLogs = capturedLogs.filter(log => 
        log.includes('sidebar') || log.includes('Sidebar') || log.includes('🔄')
      );
      
      console.log(`📊 Captured ${sidebarLogs.length} sidebar-related console logs:`);
      sidebarLogs.forEach(log => console.log(`  ${log}`));
      
      const hasLogging = sidebarLogs.length > 0;
      console.log(hasLogging ? '✅ Console logging working' : '❌ No console logs detected');
      
      return hasLogging;
    }, 100);
  }
  
  return false;
}

// Run all tests sequentially
async function runAllTests() {
  console.log('\n🚀 Running Responsive Sidebar Tests...\n');
  
  const results = {
    toggleButton: testSidebarToggleButton(),
    structure: testSidebarStructure(),
    responsive: testResponsiveBehavior()
  };
  
  // Run async tests
  try {
    results.opening = await testSidebarOpening();
    results.closingViaButton = await testSidebarClosingViaButton();
    results.closingViaOverlay = await testSidebarClosingViaOverlay();
  } catch (error) {
    console.error('❌ Error during async tests:', error);
    results.opening = false;
    results.closingViaButton = false;
    results.closingViaOverlay = false;
  }
  
  // Test console logging
  results.logging = testConsoleLogging();
  
  console.log('\n📊 Test Summary:');
  console.log('================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}`);
  });
  
  const allPassed = Object.values(results).every(Boolean);
  console.log(`\n${allPassed ? '🎉 All tests passed!' : '⚠️ Some tests failed'}`);
  
  if (!allPassed) {
    console.log('\n🔧 Debugging Tips:');
    if (!results.toggleButton) console.log('- Check if .sidebar-toggle button exists and is visible on mobile');
    if (!results.structure) console.log('- Check if .sidebar, .sidebar-overlay, and .sidebar-close elements exist');
    if (!results.opening) console.log('- Check if toggle button click handler is working');
    if (!results.closingViaButton) console.log('- Check if close button click handler is working');
    if (!results.closingViaOverlay) console.log('- Check if overlay click handler is working');
    if (!results.responsive) console.log('- Check CSS media queries and responsive behavior');
    if (!results.logging) console.log('- Check if console.log statements are present in sidebar functions');
  }
  
  return results;
}

// Manual testing functions
function manualToggleTest() {
  console.log('🔧 Manual Toggle Test');
  const button = document.querySelector('.sidebar-toggle');
  if (button) {
    console.log('Clicking toggle button...');
    button.click();
  } else {
    console.error('Toggle button not found');
  }
}

function manualCloseTest() {
  console.log('🔧 Manual Close Test');
  const button = document.querySelector('.sidebar-close');
  if (button) {
    console.log('Clicking close button...');
    button.click();
  } else {
    console.error('Close button not found');
  }
}

function manualOverlayTest() {
  console.log('🔧 Manual Overlay Test');
  const overlay = document.querySelector('.sidebar-overlay');
  if (overlay) {
    console.log('Clicking overlay...');
    overlay.click();
  } else {
    console.error('Overlay not found');
  }
}

function inspectSidebarState() {
  console.log('🔍 Current Sidebar State:');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  const toggle = document.querySelector('.sidebar-toggle');
  const close = document.querySelector('.sidebar-close');
  
  if (sidebar) {
    console.log(`Sidebar classes: ${sidebar.className}`);
    console.log(`Sidebar open: ${sidebar.classList.contains('open')}`);
  }
  
  if (overlay) {
    console.log(`Overlay classes: ${overlay.className}`);
    console.log(`Overlay active: ${overlay.classList.contains('active')}`);
  }
  
  if (toggle) {
    console.log(`Toggle display: ${window.getComputedStyle(toggle).display}`);
  }
  
  if (close) {
    console.log(`Close display: ${window.getComputedStyle(close).display}`);
  }
}

// Expose functions to global scope
window.manoSidebarTests = {
  runAllTests,
  testSidebarToggleButton,
  testSidebarStructure,
  testSidebarOpening,
  testSidebarClosingViaButton,
  testSidebarClosingViaOverlay,
  testResponsiveBehavior,
  testConsoleLogging,
  manualToggleTest,
  manualCloseTest,
  manualOverlayTest,
  inspectSidebarState
};

console.log('📱 Responsive Sidebar testing functions available:');
console.log('  manoSidebarTests.runAllTests() - Run all tests');
console.log('  manoSidebarTests.manualToggleTest() - Manually test toggle');
console.log('  manoSidebarTests.manualCloseTest() - Manually test close button');
console.log('  manoSidebarTests.manualOverlayTest() - Manually test overlay');
console.log('  manoSidebarTests.inspectSidebarState() - Check current state');

// Auto-run tests if this script is loaded
if (document.readyState === 'complete') {
  setTimeout(() => runAllTests(), 1000);
} else {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => runAllTests(), 1000);
  });
} 