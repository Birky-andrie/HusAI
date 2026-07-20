// Web dev: empty base + Vite proxy. Electron (file://) and deployed web MUST set
// VITE_API_BASE_URL at build time — relative /api has no origin under file://.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const ACCESS_KEY = 'husai.accessToken';
const REFRESH_KEY = 'husai.refreshToken';

export function getTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_KEY) || '',
    refreshToken: localStorage.getItem(REFRESH_KEY) || '',
  };
}

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function toError(resp) {
  let message = `HTTP ${resp.status}`;
  let code = '';
  try {
    const data = await resp.json();
    if (data.message) message = data.message;
    if (data.error) code = data.error;
  } catch {
    /* non-JSON error body */
  }
  const err = new Error(message);
  err.status = resp.status;
  err.code = code;
  return err;
}

/** Un-authenticated JSON POST (lifeline/transcribe keep using this). */
export async function postJSON(path, body) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw await toError(resp);
  return resp.json();
}

// Single-flight refresh: concurrent 401s share one refresh request instead of
// racing (a second rotation attempt with the same token would trip the
// reuse-breach revocation on the server).
let refreshPromise = null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { refreshToken } = getTokens();
      if (!refreshToken) throw new Error('no-refresh-token');
      const resp = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!resp.ok) throw await toError(resp);
      const session = await resp.json();
      setTokens(session);
      return session;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Authenticated fetch: attaches the access token; on 401 refreshes the session
 * once and retries. If the refresh itself fails the session is dead — tokens
 * are cleared and a `husai:logout` event tells AuthContext to reset.
 */
export async function apiFetch(path, { method = 'GET', body } = {}) {
  const doFetch = async () => {
    const { accessToken } = getTokens();
    return fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  };

  let resp = await doFetch();
  if (resp.status === 401) {
    try {
      await refreshSession();
    } catch {
      clearTokens();
      window.dispatchEvent(new Event('husai:logout'));
      throw Object.assign(new Error('Please sign in again.'), { status: 401, code: 'session-expired' });
    }
    resp = await doFetch();
  }
  if (!resp.ok) throw await toError(resp);
  return resp.json();
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body = {}) => apiFetch(path, { method: 'POST', body }),
  patch: (path, body = {}) => apiFetch(path, { method: 'PATCH', body }),
  del: (path) => apiFetch(path, { method: 'DELETE' }),
};
