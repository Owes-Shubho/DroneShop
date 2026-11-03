import { useEffect, useState } from 'react';
import { Sun, Moon } from './Icons.jsx';

const initial = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(initial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch { /* storage unavailable */ }
  }, [theme]);

  const dark = theme === 'dark';
  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}
