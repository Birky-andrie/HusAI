import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { OAuthButtons } from './LoginPage.jsx';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { needsConfirmation } = await register(email, password, displayName);
      if (needsConfirmation) {
        setSent(true); // confirmation required — no session yet
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2>Confirm your email</h2>
          <div className="banner info">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then sign in.
          </div>
          <p className="auth-sub">Didn&apos;t get it? Check spam, or try signing in to resend.</p>
          <Link className="link-button" to="/login">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h2>Create your account</h2>
        <p className="auth-sub">Every call becomes coaching. Every week, you get better.</p>
        {error && <div className="banner error">{error}</div>}
        <label>
          Name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How should we call you?" autoFocus />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="At least 8 characters"
          />
        </label>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <OAuthButtons label="or sign up with" />
        <div className="auth-links">
          <span>
            Already have an account? <Link to="/login">Sign in</Link>
          </span>
        </div>
      </form>
    </div>
  );
}
