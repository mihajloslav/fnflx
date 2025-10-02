import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Theme } from '@/hooks/useTheme';

interface ThemeToggleProps {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, toggleTheme }) => {
  return (
    <button
      onClick={toggleTheme}
      className="p-3 rounded-full transition-all duration-300 hover:scale-110"
      style={{
        background: theme === 'light' 
          ? 'linear-gradient(145deg, #f0f4f8, #d1d9e6)'
          : 'linear-gradient(135deg, rgba(25, 34, 70, 0.8) 0%, rgba(33, 14, 23, 0.8) 100%)',
        boxShadow: theme === 'light'
          ? '6px 6px 12px #c5d1dc, -6px -6px 12px #ffffff'
          : '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        backdropFilter: theme === 'dark' ? 'blur(8px)' : 'none',
        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : 'none',
        color: theme === 'light' ? '#004B7C' : '#e2e8f0'
      }}
      onMouseEnter={(e) => {
        if (theme === 'light') {
          e.currentTarget.style.boxShadow = 'inset 3px 3px 6px #c5d1dc, inset -3px -3px 6px #ffffff';
        } else {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(25, 34, 70, 0.9) 0%, rgba(33, 14, 23, 0.9) 100%)';
        }
      }}
      onMouseLeave={(e) => {
        if (theme === 'light') {
          e.currentTarget.style.boxShadow = '6px 6px 12px #c5d1dc, -6px -6px 12px #ffffff';
        } else {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(25, 34, 70, 0.8) 0%, rgba(33, 14, 23, 0.8) 100%)';
        }
      }}
      title={theme === 'light' ? 'Prebaci na tamnu temu' : 'Prebaci na svetlu temu'}
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
};
