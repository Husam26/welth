import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = {
  title: {
    default: "Welth — AI-Powered Personal Finance Management",
    template: "%s | Welth",
  },
  description:
    "Welth is an AI-powered personal finance platform to track spending, scan receipts, manage budgets and get smart monthly insights.",
  keywords: [
    "personal finance",
    "budget tracker",
    "expense manager",
    "AI receipt scanner",
    "money management",
  ],
  icons: {
    favicon: "/favicon.ico", // Default favicon
    "32x32": "/favicon-32x32.png", // 32x32 favicon
    "16x16": "/favicon-16x16.png", // 16x16 favicon
    apple: "/apple-touch-icon.png", // Apple touch icon
    "192x192": "/android-chrome-192x192.png", // Android icon (192x192)
    "512x512": "/android-chrome-512x512.png", // Android icon (512x512)
  },
  manifest: "/site.webmanifest", // Site web manifest
};



export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors position="top-center" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
