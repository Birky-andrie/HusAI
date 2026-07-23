import { supabase } from './supabase.js';

// Web dev: empty base + Vite proxy. Electron (file://) and deployed web MUST set
// VITE_API_BASE_URL at build time — relative /api has no origin under file://.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

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

/** Un-authenticated JSON POST (lifeline/transcribe are public, quota-guarded). */
export async function postJSON(path, body) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw await toError(resp);
  return resp.json();
}

async function currentAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

/**
 * Authenticated fetch: attaches the Supabase access token. supabase-js refreshes
 * the token in the background, but on a 401 we force one refresh + retry; if that
 * still fails the session is dead, so we sign out.
 */
export async function apiFetch(path, { method = 'GET', body } = {}) {
  const run = (token) =>
    fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  let resp = await run(await currentAccessToken());
  if (resp.status === 401) {
    const { data } = await supabase.auth.refreshSession();
    const token = data.session?.access_token || '';
    if (token) resp = await run(token);
    if (!token || resp.status === 401) {
      await supabase.auth.signOut().catch(() => {});
      throw Object.assign(new Error('Please sign in again.'), { status: 401, code: 'session-expired' });
    }
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
