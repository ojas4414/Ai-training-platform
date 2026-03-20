import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

export const useDarkMode = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) return stored;

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    localStorage.setItem('theme', theme);

    let effectiveTheme: 'light' | 'dark' = theme as 'light' | 'dark';
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.style.colorScheme = effectiveTheme;
    setResolvedTheme(effectiveTheme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'light';
      return 'dark';
    });
  };

  const setSystemTheme = () => setTheme('system');

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    setSystemTheme,
    isDark: resolvedTheme === 'dark',
  } as const;
};
