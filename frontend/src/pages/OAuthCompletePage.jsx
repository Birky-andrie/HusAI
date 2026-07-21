import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

/** Landing spot for the backend's OAuth redirect: swaps the 60s ticket for a session. */
export default function OAuthCompletePage() {
  const [searchParams] = useSearchParams();
  const { completeOAuth } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const ranRef = useRef(false); // ticket is single-shot; StrictMode must not spend it twice

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const ticket = searchParams.get('ticket');
    if (!ticket) {
      setFailed(true);
      return;
    }
    completeOAuth(ticket)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-card">
        {failed ? (
          <>
            <div className="banner error">Sign-in didn&apos;t complete. Please try again.</div>
            <Link className="link-button" to="/login">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <div className="spinner" />
            <p className="auth-sub">Completing sign-in…</p>
          </>
        )}
      </div>
    </div>
  );
}
