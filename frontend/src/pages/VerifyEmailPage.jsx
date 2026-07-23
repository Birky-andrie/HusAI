import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Fallback page. Email confirmation is handled by Supabase: clicking the link
 * signs the user in and AuthContext routes them into the app. A user only lands
 * here from an old/manual link, so we just orient them.
 */
export default function VerifyEmailPage() {
  const { user } = useAuth();
  // Supabase surfaces confirmation failures as query/hash params on the redirect.
  const params = new URLSearchParams(window.location.search || window.location.hash.replace(/^#/, ''));
  const errorDesc = params.get('error_description');

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Email confirmation</h2>
        {errorDesc ? (
          <>
            <div className="banner error">{decodeURIComponent(errorDesc.replace(/\+/g, ' '))}</div>
            <p className="auth-sub">The link may have expired. Sign in to request a fresh confirmation email.</p>
          </>
        ) : user ? (
          <div className="banner info">✓ You&apos;re signed in. Your email is confirmed.</div>
        ) : (
          <p className="auth-sub">
            Click the confirmation link in your email to activate your account. Once confirmed, you can sign in.
          </p>
        )}
        <Link className="link-button" to={user ? '/dashboard' : '/login'}>
          {user ? 'Go to dashboard' : 'Sign in'}
        </Link>
      </div>
    </div>
  );
}
