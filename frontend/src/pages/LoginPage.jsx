import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
} from '../components/ui/AuthGlass.jsx';

/**
 * Google sign-in (Supabase OAuth). Hidden inside Electron for now — the OAuth
 * redirect returns to a web origin, not the packaged file:// app; desktop users
 * sign in with email/password until deep-link handling lands.
 *
 * Kept in its original form because RegisterPage imports it; the sign-in page
 * below uses its own glass-styled button against the same signInWithGoogle().
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

/**
 * Sign in — a glass auth surface adapted from the pasted reference.
 *
 * Deliberate departures from that reference, all because it was written as a
 * sign-UP screen:
 *  - No confirm-password field. You confirm a password when you choose one, not
 *    when you present one you already have.
 *  - No confetti/"Welcome Aboard" celebration. Signing in is a return, not an
 *    arrival, and the reference's version fired on a fake setTimeout with no
 *    real auth behind it.
 *  - Email and password sit on one screen rather than behind the reference's
 *    step-by-step reveal. Progressive disclosure suits sign-UP, where each
 *    answer is being composed; a returning visitor already has both credentials
 *    and password managers expect to fill them together.
 *
 * Everything underneath is the existing Supabase flow, untouched: real login,
 * the unconfirmed-email path with its resend, redirect back to wherever the
 * visitor was headed, and Google OAuth hidden on desktop.
 */
export default function LoginPage() {
  const { user, login, resendConfirmation, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const from = location.state?.from || '/dashboard';

  const isDesktop = Boolean(window.electronAPI?.isDesktop);

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
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

  const google = async () => {
    setError('');
    try {
      await signInWithGoogle(); // redirects away on success
    } catch (err) {
      setError(err.message);
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
    <AuthGlassShell>
      <h1 className="auth-glass-title">Welcome back</h1>
      <p className="auth-glass-sub">Sign in to your HusAI account.</p>

      {error && <div className="banner error auth-glass-banner">{error}</div>}
      {needsConfirm && !resent && (
        <button type="button" className="link-inline auth-glass-resend" onClick={resend}>
          Resend confirmation email
        </button>
      )}
      {resent && <div className="banner info auth-glass-banner">Confirmation email sent — check your inbox.</div>}

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
          icon={<IMail />}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          autoFocus
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
          placeholder="Password"
          autoComplete="current-password"
          required
          aria-label="Password"
        />

        <button type="submit" className="auth-glass-submit" disabled={busy} aria-busy={busy}>
          {busy ? <span className="glass-go-spin" /> : <IArrow />}
          <span>{busy ? 'Signing in…' : 'Sign in'}</span>
        </button>
      </form>

      <div className="auth-glass-links">
        <Link to="/forgot-password">Forgot password?</Link>
        <span>
          New here? <Link to="/register">Create an account</Link>
        </span>
      </div>
    </AuthGlassShell>
  );
}
