'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'slate' | 'light';

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: { id: Theme; name: string; color: string }[] | any[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>('slate');

  const themes = [
    { id: 'slate', name: 'Slate Dark', color: '#3B82F6' },
    { id: 'light', name: 'Light Pristine', color: '#FFFFFF' }
  ];

  useEffect(() => {
    const savedTheme = localStorage.getItem('devnotes-theme') as Theme;
    if (savedTheme && ['slate', 'light'].includes(savedTheme)) {
      setThemeState(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Remove all theme classes
    const classes = ['theme-slate', 'theme-light'];
    document.body.classList.remove(...classes);
    document.documentElement.classList.remove(...classes);

    // Add new theme class
    const themeClass = `theme-${theme}`;
    document.body.classList.add(themeClass);
    document.documentElement.classList.add(themeClass);

    localStorage.setItem('devnotes-theme', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

