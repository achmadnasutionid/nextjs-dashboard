import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { FloatingCalculator } from "@/components/ui/floating-calculator";
import { FloatingCalendar } from "@/components/ui/floating-calendar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  title: "Financial Master Dashboard",
  description: "A comprehensive financial analytics and reporting dashboard",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Finance Dashboard",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'none',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="dashboard-theme"
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors />
          <FloatingCalculator />
          <FloatingCalendar />
        </ThemeProvider>
      </body>
    </html>
  );
}
