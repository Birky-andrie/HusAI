import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, postJSON, getTokens, setTokens, clearTokens } from '../lib/api.js';

const AuthContext = createContext(null);

/**
 * Session state for the whole app. Tokens live in localStorage (works across
 * web AND Electron's file:// origin, where cookies don't); apiFetch handles
 * transparent refresh, and its `husai:logout` event lands here when a session
 * is beyond saving.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null); // { hasPassword, providers, settings }
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const data = await api.get('/api/me');
    setUser(data.user);
    setAccount({ hasPassword: data.hasPassword, providers: data.providers, settings: data.settings });
    return data;
  }, []);

  // Restore the session on app load.
  useEffect(() => {
    const { accessToken, refreshToken } = getTokens();
    if (!accessToken && !refreshToken) {
      setLoading(false);
      return;
    }
    refreshMe()
      .catch(() => {
        clearTokens();
        setUser(null);
        setAccount(null);
      })
      .finally(() => setLoading(false));
  }, [refreshMe]);

  // apiFetch signals an unrecoverable session here.
  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      setAccount(null);
    };
    window.addEventListener('husai:logout', onLogout);
    return () => window.removeEventListener('husai:logout', onLogout);
  }, []);

  const adoptSession = useCallback(
    async (session) => {
      setTokens(session);
      setUser(session.user);
      await refreshMe().catch(() => {}); // pull the rich account payload
    },
    [refreshMe]
  );

  const login = useCallback(
    async (email, password) => adoptSession(await postJSON('/api/auth/login', { email, password })),
    [adoptSession]
  );

  const register = useCallback(
    async (email, password, displayName) =>
      adoptSession(await postJSON('/api/auth/register', { email, password, displayName })),
    [adoptSession]
  );

  const completeOAuth = useCallback(
    async (ticket) => adoptSession(await postJSON('/api/auth/oauth/complete', { ticket })),
    [adoptSession]
  );

  const logout = useCallback(async () => {
    const { refreshToken } = getTokens();
    await postJSON('/api/auth/logout', { refreshToken }).catch(() => {});
    clearTokens();
    setUser(null);
    setAccount(null);
  }, []);

  const value = useMemo(
    () => ({ user, account, loading, login, register, completeOAuth, logout, refreshMe }),
    [user, account, loading, login, register, completeOAuth, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
