'use client';

import { ThemeProvider } from 'next-themes';
import { AppProvider } from '../context/AppContext';
import { AuthProvider } from '../context/AuthContext';
import { LocaleProvider } from '../context/LocaleContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="port62-theme">
      <AuthProvider>
        <LocaleProvider>
          <AppProvider>{children}</AppProvider>
        </LocaleProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
