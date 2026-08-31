import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Enc2MusicXML Web — Encore para MusicXML',
  description: 'Converta arquivos Encore (.enc) em MusicXML diretamente no navegador.',
  authors: [
    { name: 'Leon Vinken', url: 'https://github.com/lvinken/Enc2MusicXML' },
    { name: 'Prof. Glauber Santiago — UFSCar' },
  ],
  creator: 'Prof. Glauber Santiago — UFSCar',
  publisher: 'Prof. Glauber Santiago — UFSCar',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
