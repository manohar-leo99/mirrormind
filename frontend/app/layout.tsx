import { getServerSession } from "next-auth/next";
import type { Metadata } from "next";
import localFont from "next/font/local";

import { AppProviders } from "@/components/providers/AppProviders";
import { authOptions } from "@/lib/auth";
import "./globals.css";

const inter = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
});

const jetBrainsMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "MirrorMind",
  description: "Your Team's AI Second Brain",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetBrainsMono.variable} dark`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <AppProviders session={session}>{children}</AppProviders>
      </body>
    </html>
  );
}
