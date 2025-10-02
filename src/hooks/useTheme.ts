'use client';

import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('dark'); // Default je sada dark
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Učitaj sačuvanu temu iz localStorage
    const savedTheme = localStorage.getItem('fonflix-theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // Ako nema sačuvane teme, koristi dark kao default
      setTheme('dark');
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('fonflix-theme', newTheme);
  };

  return { theme, toggleTheme, mounted };
};
