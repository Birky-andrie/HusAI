import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { API_BASE } from '../lib/api.js';

/** Google/Microsoft buttons — rendered only for providers the backend reports as configured, and never inside Electron (providers block embedded-webview OAuth). */
export function OAuthButtons({ label = 'or continue with' }) {
  const [providers, setProviders] = useState(null);
  const isDesktop = Boolean(window.electronAPI?.isDesktop);

  useEffect(() => {
    if (isDesktop) return;
    fetch(`${API_BASE}/api/auth/providers`)
      .then((r) => r.json())
      .then((d) => setProviders(d.providers))
      .catch(() => setProviders(null));
  }, [isDesktop]);

  if (isDesktop || !providers) return null;
  const enabled = Object.entries(providers).filter(([, on]) => on);
  if (!enabled.length) return null;

  return (
    <div className="oauth-block">
      <div className="oauth-divider">{label}</div>
      <div className="oauth-buttons">
        {enabled.map(([name]) => (
          <a key={name} className="oauth-button" href={`${API_BASE}/api/auth/oauth/${name}/start`}>
            {name === 'google' ? 'Google' : 'Microsoft'}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    searchParams.get('error') === 'oauth-failed'
      ? 'Sign-in with that provider failed. Try again or use your email and password.'
      : searchParams.get('error') === 'oauth-no-email'
        ? 'That provider account has no email address we can use. Try another sign-in method.'
        : ''
  );
  const [busy, setBusy] = useState(false);
  const from = location.state?.from || '/call';

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h2>Welcome back</h2>
        <p className="auth-sub">Sign in to your HusAI account.</p>
        {error && <div className="banner error">{error}</div>}
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
