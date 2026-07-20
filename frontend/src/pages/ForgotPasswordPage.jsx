import { useState } from 'react';
import { Link } from 'react-router-dom';
import { postJSON } from '../lib/api.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await postJSON('/api/auth/request-password-reset', { email }).catch(() => {});
    setBusy(false);
    setSent(true); // the API always answers ok — account existence is never revealed
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h2>Reset your password</h2>
        {sent ? (
          <div className="banner info">
            If an account exists for {email || 'that address'}, a reset link is on its way. Check your inbox (or the
            backend terminal in local dev).
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
