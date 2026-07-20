import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { postJSON } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { user, refreshMe } = useAuth();
  const [state, setState] = useState('working'); // 'working' | 'done' | 'failed'
  const ranRef = useRef(false); // the token is single-use; StrictMode must not consume it twice

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const token = searchParams.get('token');
    if (!token) {
      setState('failed');
      return;
    }
    postJSON('/api/auth/verify-email', { token })
      .then(() => {
        setState('done');
        if (user) refreshMe().catch(() => {});
      })
      .catch(() => setState('failed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Email verification</h2>
        {state === 'working' && <p className="auth-sub">Verifying your email…</p>}
        {state === 'done' && (
          <>
            <div className="banner info">✓ Your email is verified. You're all set.</div>
            <Link className="link-button" to={user ? '/call' : '/login'}>
              {user ? 'Go to your coach' : 'Sign in'}
            </Link>
          </>
        )}
        {state === 'failed' && (
          <>
            <div className="banner error">This verification link is invalid or has expired.</div>
            <p className="auth-sub">You can request a fresh link from Settings after signing in.</p>
            <Link className="link-button" to="/login">
              Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
