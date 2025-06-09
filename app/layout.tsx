import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mano - Your helping hand in management",
  description: "AI-powered management assistant to help you build better relationships with your team",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-mano-bg font-sf antialiased">
        {children}
      </body>
    </html>
  );
}