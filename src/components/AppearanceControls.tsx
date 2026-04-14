'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

export function AppearanceControls() {
  const { resolvedTheme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="glass-panel h-28 animate-pulse" aria-hidden />
    );
  }

  const activeTheme = resolvedTheme === 'light' ? 'light' : 'dark';

  return (
    <div className="glass-panel">
      <div className="flex items-center gap-2 mb-4 text-violet-400">
        <Sun size={20} className="opacity-80" />
        <h2 className="text-lg font-bold uppercase tracking-wider">{t('appearance.title')}</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] text-muted uppercase font-bold mb-2">{t('appearance.theme')}</p>
          <div className="flex rounded-xl border border-[color:var(--glass-border)] p-1 bg-[color:var(--glass-bg)]">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTheme === 'light'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              <Sun size={18} />
              {t('appearance.light')}
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTheme === 'dark'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              <Moon size={18} />
              {t('appearance.dark')}
            </button>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-muted uppercase font-bold mb-2">{t('appearance.language')}</p>
          <div className="flex rounded-xl border border-[color:var(--glass-border)] p-1 bg-[color:var(--glass-bg)]">
            <button
              type="button"
              onClick={() => setLocale('en')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                locale === 'en' ? 'bg-violet-500 text-white shadow-md' : 'text-muted hover:text-foreground'
              }`}
            >
              {t('appearance.english')}
            </button>
            <button
              type="button"
              onClick={() => setLocale('nl')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                locale === 'nl' ? 'bg-violet-500 text-white shadow-md' : 'text-muted hover:text-foreground'
              }`}
            >
              {t('appearance.dutch')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
