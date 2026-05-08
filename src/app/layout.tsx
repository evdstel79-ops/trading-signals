import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AlertsManager from "@/components/AlertsManager";
import LayoutShell from "@/components/LayoutShell";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import ThemeProvider from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trading Signals",
  description:
    "Political trades and SEC insider trades as actionable trading signals",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Signals",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <ThemeProvider>
          <ServiceWorkerRegistration />
          <AlertsManager />
          <LayoutShell>{children}</LayoutShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
