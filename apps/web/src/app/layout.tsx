import type { Metadata, Viewport } from 'next';
import type React from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: 'Zihinbulut',
  description:
    'Kişisel AI bulut bilgisayarınız: dosyalar, sohbet, terminal, otomasyonlar ve hosting tek çalışma alanında.',
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <a href="#main-content" className="skip-link">
          Ana içeriğe geç
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

