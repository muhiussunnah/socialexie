import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import { announcementInitScript } from "@/components/marketing/announcement-bar";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import { site } from "@/lib/site";
import "./globals.css";

const display = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const sans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  // Cheap, accurate entity signals — retrieval pipelines read these for
  // attribution before they reach the body copy.
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  publisher: site.name,
  alternates: {
    canonical: "/",
    types: { "application/atom+xml": "/feed.xml" },
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: site.name,
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Without max-snippet: -1 we would be capping how much of our own page an
      // engine is allowed to quote, which throttles AI citations.
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c10" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <script
          // Runs before first paint so neither the theme nor the announcement
          // bar can flash in and shift the layout.
          dangerouslySetInnerHTML={{
            __html: `${themeInitScript}\n${announcementInitScript}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-fg">
        {/* Visible only on keyboard focus — the first thing a screen-reader or
            keyboard user needs on a page with a long nav. */}
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-[100] focus-visible:rounded-lg focus-visible:bg-signal focus-visible:px-4 focus-visible:py-2 focus-visible:text-[13px] focus-visible:font-semibold focus-visible:text-signal-fg"
        >
          Skip to content
        </a>
        <ThemeProvider>{children}</ThemeProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
