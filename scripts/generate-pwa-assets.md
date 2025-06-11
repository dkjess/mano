# PWA Assets Generation Guide

This guide will help you generate all the required assets for your iOS PWA.

## Required Icons

You'll need to create the following icon sizes. Start with a high-resolution square image (1024x1024 or higher) of your app icon:

### Standard PWA Icons (for manifest.json)
- `icon-192x192.png` - 192x192px
- `icon-256x256.png` - 256x256px  
- `icon-384x384.png` - 384x384px
- `icon-512x512.png` - 512x512px

### Apple Touch Icons (for iOS home screen)
- `apple-icon-57x57.png` - 57x57px
- `apple-icon-60x60.png` - 60x60px
- `apple-icon-72x72.png` - 72x72px
- `apple-icon-76x76.png` - 76x76px
- `apple-icon-114x114.png` - 114x114px
- `apple-icon-120x120.png` - 120x120px
- `apple-icon-144x144.png` - 144x144px
- `apple-icon-152x152.png` - 152x152px
- `apple-icon-180x180.png` - 180x180px

### Shortcut Icons
- `shortcut-people.png` - 96x96px (for the People shortcut)

## Required Splash Screens

Create splash screens for different iOS device sizes. These should match your app's branding:

- `apple-splash-2048-2732.jpg` - iPad Pro 12.9" (2048x2732px)
- `apple-splash-1668-2388.jpg` - iPad Pro 11" (1668x2388px)
- `apple-splash-1536-2048.jpg` - iPad 10.2" (1536x2048px)
- `apple-splash-1125-2436.jpg` - iPhone X/XS (1125x2436px)
- `apple-splash-1242-2688.jpg` - iPhone XS Max (1242x2688px)
- `apple-splash-750-1334.jpg` - iPhone 8 (750x1334px)
- `apple-splash-828-1792.jpg` - iPhone XR (828x1792px)

## Screenshots for App Store-like experience

- `screenshot-wide.png` - 1280x720px (desktop/tablet view)
- `screenshot-narrow.png` - 750x1334px (mobile view)

## Tools for Asset Generation

### Option 1: PWA Asset Generator (Recommended)
```bash
npx pwa-asset-generator [path-to-your-logo] public --opaque false --padding "0px" --background "#ffffff"
```

### Option 2: ImageMagick (Command Line)
```bash
# Install ImageMagick first
brew install imagemagick

# Generate different sizes from a source image
convert source-icon.png -resize 192x192 public/icon-192x192.png
convert source-icon.png -resize 256x256 public/icon-256x256.png
# ... repeat for all sizes
```

### Option 3: Online Tools
- [Favicon Generator](https://www.favicon-generator.org/)
- [PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator)
- [App Icon Generator](https://appicon.co/)

## Splash Screen Design Tips

1. Keep splash screens simple - just your logo/brand mark centered
2. Use your app's primary background color
3. Ensure the design works on both light and dark backgrounds
4. Test on actual iOS devices to ensure proper scaling

## Next Steps

1. Generate all the required assets
2. Place them in the `public/` directory
3. Test your PWA on iOS Safari
4. Use Safari's "Add to Home Screen" feature to test the full experience

## Testing Checklist

- [ ] App icon appears correctly on home screen
- [ ] Splash screen displays when launching
- [ ] App runs in standalone mode (no browser UI)
- [ ] Service worker caches content for offline use
- [ ] Install prompt appears on supported browsers
- [ ] App shortcuts work correctly 