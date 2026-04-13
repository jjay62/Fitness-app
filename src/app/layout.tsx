import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './Providers';
import BottomNav from '../components/BottomNav';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'AI Diet Planner',
  description: 'Mobile-first diet tracking with Gemini AI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>
          <div className="max-w-[600px] mx-auto min-h-screen relative pb-28">
            <main className="p-4 pt-8">
              {children}
            </main>
            <BottomNav />
          </div>
        </Providers>
      </body>
    </html>
  );
}
