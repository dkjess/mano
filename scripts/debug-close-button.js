// Debug script to add to browser console on mobile device
// This will help us understand if the close button is working

console.log('🔍 Mobile Close Button Debug Script');

// Find the close button
const closeButton = document.querySelector('.sidebar-close-button');
if (closeButton) {
    console.log('✅ Close button found:', closeButton);
    
    // Add debug click listener
    closeButton.addEventListener('click', function(e) {
        console.log('🎯 Close button clicked!', e);
        console.log('Event details:', {
            type: e.type,
            target: e.target,
            currentTarget: e.currentTarget,
            bubbles: e.bubbles,
            cancelable: e.cancelable
        });
    });
    
    // Add debug touch listeners
    closeButton.addEventListener('touchstart', function(e) {
        console.log('👆 Touch start on close button', e);
    });
    
    closeButton.addEventListener('touchend', function(e) {
        console.log('👆 Touch end on close button', e);
    });
    
    // Check button properties
    const styles = window.getComputedStyle(closeButton);
    console.log('Close button styles:', {
        display: styles.display,
        pointerEvents: styles.pointerEvents,
        zIndex: styles.zIndex,
        position: styles.position,
        opacity: styles.opacity,
        visibility: styles.visibility
    });
    
    // Check if button is covered by anything
    const rect = closeButton.getBoundingClientRect();
    const elementAtCenter = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
    );
    
    console.log('Element at button center:', elementAtCenter);
    console.log('Is it the close button?', elementAtCenter === closeButton);
    
} else {
    console.log('❌ Close button not found!');
}

// Check sidebar state
const sidebar = document.querySelector('.sidebar');
if (sidebar) {
    console.log('Sidebar classes:', sidebar.className);
    console.log('Sidebar has mobile-open:', sidebar.classList.contains('mobile-open'));
}

// Add a manual test function
window.testCloseButton = function() {
    console.log('🧪 Manual close button test');
    const button = document.querySelector('.sidebar-close-button');
    if (button) {
        button.click();
        console.log('Manual click triggered');
    }
};

console.log('💡 Run window.testCloseButton() to manually test the close button'); 