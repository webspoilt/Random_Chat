import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Random Chat - Anonymous Conversations",
  description: "Connect with random people around the world for anonymous conversations.",
  keywords: ["Random Chat", "Anonymous Chat", "Online Chat", "Meet Strangers", "Random Video Chat"],
  authors: [{ name: "Random Chat Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Random Chat",
    description: "Connect with random people for anonymous conversations",
    siteName: "Random Chat",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Random Chat",
    description: "Connect with random people for anonymous conversations",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
