import type { Metadata } from 'next';
import { Newsreader, Inter } from 'next/font/google';
import './globals.css';

const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
});

const inter = Inter({
  variable: '--font-inter',
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
        className={`${newsreader.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
