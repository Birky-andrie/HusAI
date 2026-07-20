import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { postJSON } from '../lib/api.js';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const token = searchParams.get('token') || '';

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await postJSON('/api/auth/reset-password', { token, newPassword: password });
      navigate('/login', { replace: true, state: { message: 'Password updated — sign in with your new password.' } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h2>Choose a new password</h2>
        {!token && <div className="banner error">This reset link is missing its token — request a new one.</div>}
        {error && <div className="banner error">{error}</div>}
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
          />
        </label>
        <label>
          Confirm new password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
        </label>
        <button className="primary" type="submit" disabled={busy || !token}>
          {busy ? 'Updating…' : 'Update password'}
        </button>
        <div className="auth-links">
          <Link to="/forgot-password">Request a new link</Link>
        </div>
      </form>
    </div>
  );
}
