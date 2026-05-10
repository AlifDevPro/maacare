import type { Metadata, Viewport } from "next";

import "./globals.css";

import { RootProviders } from "@/components/providers/root-providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fdf6f3",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "MaaCare — AI Maternal Health Companion",
  description:
    "Personalized pregnancy guidance, symptom checks, and 24/7 AI support for expecting and new mothers.",
  authors: [{ name: "MaaCare" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen bg-background font-sans antialiased"
        suppressHydrationWarning
      >
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
