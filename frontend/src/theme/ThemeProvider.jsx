import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'husai.theme'; // 'light' | 'dark' | 'system'

export function getStoredPreference() {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
}

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

/** Resolve a preference to the concrete theme actually applied. */
export function resolveTheme(pref) {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemPrefersDark() ? 'dark' : 'light';
}

/** Stamp the resolved theme on <html> so every token flips. Exported so the
 *  no-flash inline script in index.html and the provider share one code path. */
export function applyTheme(pref) {
  const resolved = resolveTheme(pref);
  document.documentElement.setAttribute('data-theme', resolved);
  return resolved;
}

/**
 * Owns the app-wide theme. Preference ('light' | 'dark' | 'system') persists in
 * localStorage; when 'system', the applied theme follows the OS and updates live
 * if the OS switches. Available to the whole app (authed and public).
 */
export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(getStoredPreference);
  const [resolved, setResolved] = useState(() => resolveTheme(getStoredPreference()));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, preference);
    setResolved(applyTheme(preference));
  }, [preference]);

  // Follow live OS changes while on 'system'.
  useEffect(() => {
    if (preference !== 'system' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(applyTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setTheme = useCallback((pref) => setPreference(pref), []);
  const value = useMemo(() => ({ preference, theme: resolved, setTheme }), [preference, resolved]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
