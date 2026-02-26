import type { Metadata, Viewport } from "next";
import { Bangers, Comic_Neue, Space_Mono } from "next/font/google";

import { ClerkProvider } from "@clerk/nextjs";

import Footer from "@/components/Footer";
import { MobileUtilitiesFAB } from "@/components/MobileUtilitiesFAB";
import { Navigation } from "@/components/Navigation";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { PostHogProvider } from "@/components/PostHogProvider";
import { Providers } from "@/components/Providers";
import { ServiceWorkerProvider } from "@/components/ServiceWorkerProvider";

import "./globals.css";

// Pop Art / Lichtenstein Typography
const bangers = Bangers({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bangers",
  display: "swap",
});

const comicNeue = Comic_Neue({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-comic-neue",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Collectors Chest - Track, Value & Trade Your Comics",
  description:
    "The all-in-one comic collector's companion. Scan covers with technopathic recognition, track your collection's value, and buy or sell with fellow collectors.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Collectors Chest",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FFF200", // Pop Art Yellow
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${bangers.variable} ${comicNeue.variable} ${spaceMono.variable} font-body`}
        >
          <PostHogProvider>
            <ServiceWorkerProvider>
              <Providers>
                <div className="min-h-screen bg-pop-cream pb-20 md:pb-0">
                  <Navigation />
                  <main className="container mx-auto px-4 py-8">{children}</main>
                  <div className="container mx-auto px-4">
                    <Footer />
                  </div>
                  <MobileUtilitiesFAB />
                  <PWAInstallPrompt />
                </div>
              </Providers>
            </ServiceWorkerProvider>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
