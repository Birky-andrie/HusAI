import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await resetPasswordForEmail(email).catch(() => {});
    setBusy(false);
    setSent(true); // always report success — account existence is never revealed
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h2>Reset your password</h2>
        {sent ? (
          <div className="banner info">
            If an account exists for {email || 'that address'}, a reset link is on its way. Open it and you&apos;ll be
            taken straight to a page to choose a new password.
          </div>
        ) : (
          <>
            <p className="auth-sub">Enter your account email and we&apos;ll send a reset link.</p>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        )}
        <div className="auth-links">
          <Link to="/login">Back to sign in</Link>
        </div>
      </form>
    </div>
  );
}
