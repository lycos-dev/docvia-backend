import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('docvia-theme') as Theme;
    return saved || 'light';
  });

  useEffect(() => {
    localStorage.setItem('docvia-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const runWithViewTransition = useCallback((updateDom: () => void) => {
    if (typeof document === 'undefined') {
      updateDom();
      return;
    }
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => { finished: Promise<void> };
    };
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => {
        flushSync(updateDom);
      });
    } else {
      updateDom();
    }
  }, []);

  const toggleTheme = () => {
    runWithViewTransition(() => {
      setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
    });
  };

  const setTheme = (newTheme: Theme) => {
    runWithViewTransition(() => {
      setThemeState(newTheme);
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};