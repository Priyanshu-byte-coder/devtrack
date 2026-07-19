'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon, Eye, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

export default function ThemeAccessibilityController() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [fontSizeDelta, setFontSizeDelta] = useState<number>(0);

  // 1. Client-side Theme Preferences Initialization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('devtrack_theme') as 'light' | 'dark' | null;
      const savedContrast = localStorage.getItem('devtrack_contrast') === 'true';
      
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      }
      setHighContrast(savedContrast);
      document.documentElement.classList.toggle('contrast-high', savedContrast);
    }
  }, []);

  // 2. Toggle Dark Mode Preferences Engine
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('devtrack_theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  // 3. Toggle High Contrast Framework Mode
  const toggleContrast = () => {
    const nextContrast = !highContrast;
    setHighContrast(nextContrast);
    localStorage.setItem('devtrack_contrast', String(nextContrast));
    document.documentElement.classList.toggle('contrast-high', nextContrast);
  };

  // 4. Handle Zoom Font Adjustments
  const adjustFontSize = (action: 'increase' | 'decrease' | 'reset') => {
    let nextDelta = fontSizeDelta;
    if (action === 'increase' && fontSizeDelta < 4) nextDelta += 2;
    if (action === 'decrease' && fontSizeDelta > -2) nextDelta -= 2;
    if (action === 'reset') nextDelta = 0;

    setFontSizeDelta(nextDelta);
    document.documentElement.style.fontSize = nextDelta === 0 ? '' : `${100 + nextDelta * 10}%`;
  };

  return (
    <div className="w-full p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span>Interface Customization & Accessibility Controls</span>
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Configure WCAG 2.1 compliant themes, contrast indices, and responsive display scale parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        {/* Toggle Theme Control Button */}
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode visual preference`}
          aria-pressed={theme === 'dark'}
          className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-xl transition-all shadow-sm text-gray-700 dark:text-gray-200"
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-amber-500" /> : <Sun className="w-4 h-4 text-amber-600" />}
            <span>Theme Option</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-bold">
            {theme}
          </span>
        </button>

        {/* Toggle High Contrast Button */}
        <button
          onClick={toggleContrast}
          aria-label="Toggle high contrast visibility filters"
          aria-pressed={highContrast}
          className={`flex items-center justify-between p-3 border rounded-xl transition-all shadow-sm ${
            highContrast
              ? 'border-emerald-500 bg-emerald-50/10 text-emerald-600 dark:text-emerald-400'
              : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Eye className="w-4 h-4" />
            <span>High Contrast</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold bg-gray-100 dark:bg-zinc-800">
            {highContrast ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Font Zoom Scale Controls Matrix */}
        <div className="flex items-center justify-between border border-gray-200 dark:border-gray-800 rounded-xl p-1.5 bg-gray-50/50 dark:bg-zinc-950/20 shadow-sm">
          <button
            onClick={() => adjustFontSize('decrease')}
            aria-label="Decrease interface text font size"
            className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg text-gray-600 dark:text-gray-400 transition-all"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => adjustFontSize('reset')}
            aria-label="Reset font sizing settings back to default parameters"
            className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg text-gray-500 dark:text-gray-400 text-xs font-bold transition-all flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>100%</span>
          </button>
          <button
            onClick={() => adjustFontSize('increase')}
            aria-label="Increase interface text font size"
            className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg text-gray-600 dark:text-gray-400 transition-all"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

