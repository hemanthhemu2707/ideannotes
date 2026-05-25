'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'slate' | 'light' | 'cyberpunk' | 'ocean' | 'forest' | 'obsidian';

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
    { id: 'light', name: 'Light Pristine', color: '#FFFFFF' },
    { id: 'cyberpunk', name: 'Cyberpunk Neo', color: '#EC4899' },
    { id: 'ocean', name: 'Ocean Glass', color: '#06B6D4' },
    { id: 'forest', name: 'Forest Emerald', color: '#10B981' },
    { id: 'obsidian', name: 'Midnight Obsidian', color: '#121212' }
  ];

  useEffect(() => {
    const savedTheme = localStorage.getItem('devnotes-theme') as Theme;
    if (savedTheme && ['slate', 'light', 'cyberpunk', 'ocean', 'forest', 'obsidian'].includes(savedTheme)) {
      setThemeState(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Remove all theme classes
    const classes = ['theme-slate', 'theme-light', 'theme-cyberpunk', 'theme-ocean', 'theme-forest', 'theme-obsidian'];
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
