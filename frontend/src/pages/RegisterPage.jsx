import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  AuthGlassShell,
  GlassField,
  GoogleMark,
  IArrow,
  IEye,
  IEyeOff,
  ILock,
  IMail,
  IMailSent,
  IUser,
} from '../components/ui/AuthGlass.jsx';

const MIN_PASSWORD = 8;

/**
 * Create account — the same glass surface as sign-in, carrying the three fields
 * the existing Supabase registration already takes: name, email, password.
 *
 * The confirmation screen is rendered into the same shell rather than bouncing
 * to a differently-styled page, so finishing sign-up does not feel like being
 * handed off to another product.
 */
export default function RegisterPage() {
  const { user, register, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const isDesktop = Boolean(window.electronAPI?.isDesktop);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
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

  const google = async () => {
    setError('');
    try {
      await signInWithGoogle(); // redirects away on success
    } catch (err) {
      setError(err.message);
    }
  };

  if (sent) {
    return (
      <AuthGlassShell>
        <span className="auth-glass-icon" aria-hidden="true"><IMailSent /></span>
        <h1 className="auth-glass-title">Check your email</h1>
        <p className="auth-glass-sub auth-glass-sub-wrap">
          We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account, then sign in.
        </p>
        <Link to="/login" className="auth-glass-submit as-link">
          <IArrow />
          <span>Go to sign in</span>
        </Link>
        <div className="auth-glass-links">
          <span>Didn&apos;t get it? Check spam, or try signing in to resend.</span>
        </div>
      </AuthGlassShell>
    );
  }

  return (
    <AuthGlassShell>
      <h1 className="auth-glass-title">Create your account</h1>
      <p className="auth-glass-sub">Every call becomes coaching.</p>

      {error && <div className="banner error auth-glass-banner">{error}</div>}

      {!isDesktop && (
        <>
          <button type="button" className="glass-btn auth-glass-google" onClick={google}>
            <GoogleMark />
            <span>Continue with Google</span>
          </button>
          <div className="auth-glass-divider"><span>or</span></div>
        </>
      )}

      <form onSubmit={submit} className="auth-glass-form">
        <GlassField
          icon={<IUser />}
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Name"
          autoComplete="name"
          autoFocus
          aria-label="Name"
        />

        <GlassField
          icon={<IMail />}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
          aria-label="Email"
        />

        <GlassField
          icon={password ? (showPassword ? <IEyeOff /> : <IEye />) : <ILock />}
          toggle
          onToggle={() => setShowPassword((v) => !v)}
          toggleDisabled={!password}
          toggleLabel={showPassword ? 'Hide password' : 'Show password'}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`Password (${MIN_PASSWORD}+ characters)`}
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          required
          aria-label="Password"
        />

        <button type="submit" className="auth-glass-submit" disabled={busy} aria-busy={busy}>
          {busy ? <span className="glass-go-spin" /> : <IArrow />}
          <span>{busy ? 'Creating account…' : 'Create account'}</span>
        </button>
      </form>

      <div className="auth-glass-links">
        <span>
          Already have an account? <Link to="/login">Sign in</Link>
        </span>
      </div>
    </AuthGlassShell>
  );
}
