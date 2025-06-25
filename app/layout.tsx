import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegistration from "../components/ServiceWorkerRegistration";
import InstallPrompt from "../components/InstallPrompt";
import DebugPanel from '@/components/debug/debug-panel'

export const metadata: Metadata = {
  title: "Mano - Your helping hand in management",
  description: "AI-powered management assistant to help you build better relationships with your team",
  manifest: "/manifest.json",
  themeColor: "#000000",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mano",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/appicons/android/android-launchericon-192-192.png", sizes: "192x192", type: "image/png" },
      { url: "/appicons/ios/256.png", sizes: "256x256", type: "image/png" },
      { url: "/appicons/ios/512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/appicons/ios/57.png", sizes: "57x57", type: "image/png" },
      { url: "/appicons/ios/60.png", sizes: "60x60", type: "image/png" },
      { url: "/appicons/ios/72.png", sizes: "72x72", type: "image/png" },
      { url: "/appicons/ios/76.png", sizes: "76x76", type: "image/png" },
      { url: "/appicons/ios/114.png", sizes: "114x114", type: "image/png" },
      { url: "/appicons/ios/120.png", sizes: "120x120", type: "image/png" },
      { url: "/appicons/ios/144.png", sizes: "144x144", type: "image/png" },
      { url: "/appicons/ios/152.png", sizes: "152x152", type: "image/png" },
      { url: "/appicons/ios/180.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* iOS Safari specific meta tags for better PWA experience */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Mano" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Viewport meta tag for responsive design - optimized for mobile */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />
        
        {/* Prevent iOS from detecting phone numbers */}
        <meta name="format-detection" content="telephone=no" />
        
        {/* iOS splash screen images */}
        <link rel="apple-touch-startup-image" href="/apple-splash-2048-2732.jpg" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1668-2388.jpg" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1536-2048.jpg" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1125-2436.jpg" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1242-2688.jpg" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-750-1334.jpg" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-828-1792.jpg" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
      </head>
      <body>
        <ServiceWorkerRegistration />
        <InstallPrompt />
        {children}
        <DebugPanel />
      </body>
    </html>
  );
}