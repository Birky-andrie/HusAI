import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Loud in dev; the app can't authenticate without these.
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — set them in frontend/.env');
}

/**
 * Whether this page load is the tail end of a Supabase auth redirect (OAuth,
 * email confirmation, or password recovery). Captured at module load — BEFORE
 * supabase-js's detectSessionInUrl strips the params from the URL — so
 * AuthContext can route the user appropriately once the session lands.
 */
export const arrivedViaAuthRedirect =
  /[?&](code|access_token|error|error_description)=/.test(window.location.search) ||
  /[#&](code|access_token|error|error_description)=/.test(window.location.hash);

export const supabase = createClient(url, anonKey, {
  auth: {
    // PKCE returns `?code=` in the query string (not the hash), so it doesn't
    // collide with HashRouter's `#/route` hash routing.
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'husai.auth',
  },
});
