import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Google sign-in (Supabase OAuth). Hidden inside Electron for now — the OAuth
 * redirect returns to a web origin, not the packaged file:// app; desktop users
 * sign in with email/password until deep-link handling lands.
 */
export function OAuthButtons({ label = 'or continue with' }) {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const isDesktop = Boolean(window.electronAPI?.isDesktop);
  if (isDesktop) return null;

  const google = async () => {
    setError('');
    try {
      await signInWithGoogle(); // redirects away on success
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="oauth-block">
      <div className="oauth-divider">{label}</div>
      {error && <div className="banner error">{error}</div>}
      <div className="oauth-buttons">
        <button type="button" className="oauth-button" onClick={google}>
          Google
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { user, login, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const from = location.state?.from || '/dashboard';

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNeedsConfirm(false);
    setResent(false);
    setBusy(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      if (err.code === 'email_not_confirmed') setNeedsConfirm(true);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await resendConfirmation(email);
      setResent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h2>Welcome back</h2>
        <p className="auth-sub">Sign in to your HusAI account.</p>
        {error && <div className="banner error">{error}</div>}
        {needsConfirm && !resent && (
          <button type="button" className="link-inline" onClick={resend}>
            Resend confirmation email
          </button>
        )}
        {resent && <div className="banner info">Confirmation email sent — check your inbox.</div>}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <OAuthButtons />
        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <span>
            New here? <Link to="/register">Create an account</Link>
          </span>
        </div>
      </form>
    </div>
  );
}
