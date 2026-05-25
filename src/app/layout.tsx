import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeContext";
import AppLayout from "@/components/AppLayout";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "DevNotes Hub — Premium Developer Notes & Interview Preparation",
  description: "A highly structured, distraction-free knowledge workspace for software engineering interview preparation focused on .NET, SQL, React, System Design, and Security. Built for developers by developers.",
  keywords: ["Interview Prep", ".NET Core", "React", "SQL", "System Design", "Design Patterns", "Developer Notes", "Next.js", "Obsidian", "Notion"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <ToastProvider>
            <AppLayout>
              {children}
            </AppLayout>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
