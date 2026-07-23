import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Reached after clicking the password-recovery email link: Supabase establishes a
 * short-lived recovery session and AuthContext routes here on the PASSWORD_RECOVERY
 * event. We just collect the new password and call updateUser.
 */
export default function ResetPasswordPage() {
  const { user, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await updatePassword(password);
      navigate('/dashboard', { replace: true });
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
        {!user && (
          <div className="banner error">
            Open the reset link from your email to change your password — this page needs that secure session.
          </div>
        )}
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
        <button className="primary" type="submit" disabled={busy || !user}>
          {busy ? 'Updating…' : 'Update password'}
        </button>
        <div className="auth-links">
          <Link to="/forgot-password">Request a new link</Link>
        </div>
      </form>
    </div>
  );
}
