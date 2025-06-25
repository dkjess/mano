// Comprehensive Mobile Debug Test Suite
// Run this script in your browser's console to debug mobile issues

class MobileDebugger {
  constructor() {
    this.results = [];
    this.issues = [];
  }

  log(message, type = 'info') {
    const result = { message, type, timestamp: new Date().toISOString() };
    this.results.push(result);
    
    const emoji = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
    console.log(`${emoji} ${message}`);
    
    if (type === 'error') {
      this.issues.push(message);
    }
  }

  // Test 1: Check viewport and meta tags
  testViewport() {
    this.log('🧪 Testing Viewport Configuration...', 'info');
    
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      this.log('Missing viewport meta tag', 'error');
      return;
    }
    
    const content = viewport.getAttribute('content');
    this.log(`Viewport: ${content}`, 'info');
    
    // Check for mobile-friendly settings
    if (!content.includes('width=device-width')) {
      this.log('Viewport missing width=device-width', 'error');
    }
    
    if (!content.includes('user-scalable=no')) {
      this.log('Viewport allows scaling (may cause iOS zoom)', 'warning');
    }
  }

  // Test 2: Check scrolling capability
  testScrolling() {
    this.log('🧪 Testing Scrolling Capability...', 'info');
    
    const body = document.body;
    const html = document.documentElement;
    
    // Check if elements have proper overflow settings
    const testElements = ['.conversation-app', '.main-content', '.conversation-messages'];
    
    testElements.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        const styles = window.getComputedStyle(element);
        const overflow = styles.getPropertyValue('overflow');
        const overflowY = styles.getPropertyValue('overflow-y');
        const height = styles.getPropertyValue('height');
        const maxHeight = styles.getPropertyValue('max-height');
        
        this.log(`${selector}: overflow=${overflow}, overflow-y=${overflowY}, height=${height}`, 'info');
        
        if (overflow === 'hidden' && overflowY === 'hidden') {
          this.log(`${selector} has overflow hidden - may prevent scrolling`, 'error');
        }
      } else {
        this.log(`Element ${selector} not found`, 'warning');
      }
    });
    
    // Test actual scrolling
    const scrollHeight = Math.max(body.scrollHeight, html.scrollHeight);
    const clientHeight = Math.max(body.clientHeight, html.clientHeight);
    
    this.log(`Scroll height: ${scrollHeight}, Client height: ${clientHeight}`, 'info');
    
    if (scrollHeight <= clientHeight) {
      this.log('Content may not be tall enough to scroll', 'warning');
    }
  }

  // Test 3: Check mobile menu functionality
  testMobileMenu() {
    this.log('🧪 Testing Mobile Menu...', 'info');
    
    const menuButton = document.querySelector('.mobile-menu-button');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    
    if (!menuButton) {
      this.log('Mobile menu button not found', 'error');
      return;
    }
    
    const menuStyles = window.getComputedStyle(menuButton);
    const isVisible = menuStyles.display !== 'none';
    
    this.log(`Mobile menu button visible: ${isVisible}`, isVisible ? 'info' : 'error');
    
    // Check touch target size
    const rect = menuButton.getBoundingClientRect();
    const hasGoodTouchTarget = rect.width >= 44 && rect.height >= 44;
    this.log(`Menu button size: ${rect.width}x${rect.height} (min 44x44 recommended)`, 
      hasGoodTouchTarget ? 'info' : 'warning');
    
    // Test menu functionality
    try {
      menuButton.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
      menuButton.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
      menuButton.click();
      
      // Check if sidebar opens
      setTimeout(() => {
        const sidebarStyles = window.getComputedStyle(sidebar);
        const transform = sidebarStyles.getPropertyValue('transform');
        const isOpen = !transform.includes('translateX(-100%)') && transform !== 'none';
        
        this.log(`Sidebar opens on menu click: ${isOpen}`, isOpen ? 'info' : 'error');
      }, 300);
      
    } catch (error) {
      this.log(`Menu button click failed: ${error.message}`, 'error');
    }
  }

  // Test 4: Check chat input functionality
  testChatInput() {
    this.log('🧪 Testing Chat Input...', 'info');
    
    const textarea = document.querySelector('.message-textarea');
    const inputContainer = document.querySelector('.input-container');
    
    if (!textarea) {
      this.log('Chat textarea not found', 'error');
      return;
    }
    
    // Check if textarea is properly positioned and styled
    const textareaStyles = window.getComputedStyle(textarea);
    const fontSize = parseFloat(textareaStyles.fontSize);
    
    this.log(`Textarea font-size: ${fontSize}px (should be 16px+ to prevent iOS zoom)`, 
      fontSize >= 16 ? 'info' : 'error');
    
    // Test input focus and typing
    try {
      textarea.focus();
      
      // Simulate typing
      textarea.value = 'Test message';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      
      const isFocused = document.activeElement === textarea;
      this.log(`Textarea focus works: ${isFocused}`, isFocused ? 'info' : 'error');
      
      // Check if input container is properly positioned
      if (inputContainer) {
        const containerRect = inputContainer.getBoundingClientRect();
        const isFixed = textareaStyles.position === 'fixed' || 
          window.getComputedStyle(inputContainer.closest('.conversation-input')).position === 'fixed';
        
        this.log(`Input container positioned: ${isFixed ? 'fixed' : 'relative'}`, 'info');
        this.log(`Input container bottom: ${window.innerHeight - containerRect.bottom}px from bottom`, 'info');
      }
      
      // Clear test input
      textarea.value = '';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      
    } catch (error) {
      this.log(`Input test failed: ${error.message}`, 'error');
    }
  }

  // Test 5: Check for iOS Safari specific issues
  testIOSCompatibility() {
    this.log('🧪 Testing iOS Safari Compatibility...', 'info');
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    this.log(`Device: iOS=${isIOS}, Safari=${isSafari}`, 'info');
    
    if (isIOS) {
      // Check for viewport height issues
      if (window.visualViewport) {
        const viewport = window.visualViewport;
        this.log(`Visual viewport: ${viewport.width}x${viewport.height}`, 'info');
        this.log(`Window inner: ${window.innerWidth}x${window.innerHeight}`, 'info');
        
        // Test for keyboard resize handling
        const originalHandler = () => {
          this.log(`Viewport resized: ${viewport.width}x${viewport.height}`, 'info');
        };
        
        viewport.addEventListener('resize', originalHandler);
        setTimeout(() => viewport.removeEventListener('resize', originalHandler), 5000);
      }
      
      // Check for safe area support
      const testElement = document.createElement('div');
      testElement.style.paddingTop = 'env(safe-area-inset-top)';
      document.body.appendChild(testElement);
      
      const computedPadding = window.getComputedStyle(testElement).paddingTop;
      const hasSafeArea = computedPadding !== '0px';
      
      this.log(`Safe area insets supported: ${hasSafeArea}`, hasSafeArea ? 'info' : 'warning');
      
      document.body.removeChild(testElement);
    }
  }

  // Test 6: Check touch event handling
  testTouchEvents() {
    this.log('🧪 Testing Touch Event Handling...', 'info');
    
    const testElements = ['.mobile-menu-button', '.message-textarea', '.nav-item'];
    
    testElements.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        const styles = window.getComputedStyle(element);
        const touchAction = styles.getPropertyValue('touch-action');
        const tapHighlight = styles.getPropertyValue('-webkit-tap-highlight-color');
        
        this.log(`${selector}: touch-action=${touchAction}, tap-highlight=${tapHighlight}`, 'info');
        
        // Test touch event support
        try {
          const hasTouch = 'ontouchstart' in element;
          this.log(`${selector} supports touch events: ${hasTouch}`, hasTouch ? 'info' : 'warning');
        } catch (error) {
          this.log(`Touch test failed for ${selector}: ${error.message}`, 'error');
        }
      }
    });
  }

  // Run all tests
  async runAllTests() {
    this.log('🚀 Starting Mobile Debug Test Suite...', 'info');
    this.log('=' .repeat(50), 'info');
    
    this.testViewport();
    this.testScrolling();
    this.testMobileMenu();
    this.testChatInput();
    this.testIOSCompatibility();
    this.testTouchEvents();
    
    this.log('=' .repeat(50), 'info');
    this.log(`✅ Tests completed. Found ${this.issues.length} issues.`, 'info');
    
    if (this.issues.length > 0) {
      this.log('🔧 Issues to fix:', 'error');
      this.issues.forEach((issue, index) => {
        this.log(`${index + 1}. ${issue}`, 'error');
      });
    }
    
    return {
      totalTests: this.results.length,
      issues: this.issues,
      results: this.results
    };
  }

  // Generate fix suggestions
  generateFixSuggestions() {
    const suggestions = [];
    
    this.issues.forEach(issue => {
      if (issue.includes('overflow hidden')) {
        suggestions.push('Remove overflow:hidden from scrollable containers');
      }
      if (issue.includes('font-size')) {
        suggestions.push('Set input font-size to 16px or larger to prevent iOS zoom');
      }
      if (issue.includes('Mobile menu button not found')) {
        suggestions.push('Ensure mobile menu button is properly rendered in mobile view');
      }
      if (issue.includes('viewport meta tag')) {
        suggestions.push('Add proper viewport meta tag with mobile-friendly settings');
      }
    });
    
    return [...new Set(suggestions)]; // Remove duplicates
  }
}

// Initialize and run tests
const mobileDebugger = new MobileDebugger();

// Auto-run tests
console.log('🧪 Mano Mobile Debugger');
console.log('=====================');
console.log('Running comprehensive mobile tests...');

mobileDebugger.runAllTests().then(results => {
  console.log('\n📋 Fix Suggestions:');
  const suggestions = mobileDebugger.generateFixSuggestions();
  suggestions.forEach((suggestion, index) => {
    console.log(`${index + 1}. ${suggestion}`);
  });
  
  // Make debugger available globally for manual testing
  window.manoDebugger = mobileDebugger;
  console.log('\n💡 Debugger available as window.manoDebugger for manual testing');
});

// Export for use in other contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileDebugger;
} 