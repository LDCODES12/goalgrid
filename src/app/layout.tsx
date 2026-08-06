import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Anchor — Science-based accountability",
  description:
    "Build habits that actually stick with science-backed accountability. Track goals with friends, stay consistent, and celebrate progress together.",
  keywords: ["habit tracker", "accountability", "goals", "productivity", "habits", "consistency", "streak tracking", "group accountability"],
  authors: [{ name: "Anchor" }],
  creator: "Anchor",
  publisher: "Anchor",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Anchor — Build habits that actually stick",
    description:
      "Science-backed accountability to help you and your friends stay consistent. Track goals, build streaks, and celebrate progress together.",
    url: "/",
    siteName: "Anchor",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/icon.svg",
        width: 512,
        height: 512,
        alt: "Anchor - Habit tracking and accountability",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anchor — Build habits that actually stick",
    description:
      "Science-backed accountability for goals and habits. Track with friends, stay consistent, celebrate together.",
    images: ["/icon.svg"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Anchor",
  },
  formatDetection: {
    telephone: false,
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
