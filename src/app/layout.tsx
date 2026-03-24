import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Café Scheduler',
  description: 'Polish café shift scheduling application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
