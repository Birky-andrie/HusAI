import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Vestigial route. Supabase OAuth now redirects to the app origin and AuthContext
 * establishes the session + routes into the app directly. If anything still lands
 * here, just forward based on auth state.
 */
export default function OAuthCompletePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate(user ? '/dashboard' : '/login', { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="spinner" />
        <p className="auth-sub">Completing sign-in…</p>
      </div>
    </div>
  );
}
